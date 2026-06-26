import { createContext, useContext, createElement, type ReactNode } from 'react'
import {
  useQuery as useReactQuery,
  useMutation as useReactMutation,
  useQueryClient,
  type QueryKey,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query'
import { VrixoClient, type AuthResponse, type Session, type User, type GenericResponse, type RealtimeChannel } from 'vrixo-sdk'

const VrixoContext = createContext<VrixoClient | null>(null)

export function VrixoProvider({ client, children }: { client: VrixoClient; children: ReactNode }) {
  return createElement(VrixoContext.Provider, { value: client }, children)
}

export function useVrixo(): VrixoClient {
  const client = useContext(VrixoContext)
  if (!client) {
    throw new Error('useVrixo must be used within a VrixoProvider')
  }
  return client
}

export function useSession(): {
  session: Session | null
  user: User | null
  isLoading: boolean
  error: Error | null
} {
  const vrixo = useVrixo()

  const { data, isLoading, error } = useReactQuery({
    queryKey: ['vrixo', 'session'],
    queryFn: async () => {
      const { data, error } = await vrixo.auth.getSession()
      if (error) throw error
      return data?.session ?? null
    },
    staleTime: 5 * 60 * 1000,
  })

  return {
    session: data ?? null,
    user: data?.user ?? null,
    isLoading,
    error: error as Error | null,
  }
}

export function useSignUp() {
  const vrixo = useVrixo()
  const queryClient = useQueryClient()

  return useReactMutation({
    mutationFn: async ({
      email,
      password,
      options,
    }: {
      email: string
      password: string
      options?: { redirectTo?: string; data?: Record<string, unknown> }
    }) => {
      const result = await vrixo.auth.signUp(email, password, options)
      if (result.error) throw result.error
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vrixo', 'session'] })
    },
  })
}

export function useSignIn() {
  const vrixo = useVrixo()
  const queryClient = useQueryClient()

  return useReactMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const result = await vrixo.auth.signIn(email, password)
      if (result.error) throw result.error
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vrixo', 'session'] })
    },
  })
}

export function useSignOut() {
  const vrixo = useVrixo()
  const queryClient = useQueryClient()

  return useReactMutation({
    mutationFn: async () => {
      const { error } = await vrixo.auth.signOut()
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vrixo', 'session'] })
      queryClient.clear()
    },
  })
}

export function useAuth() {
  const sessionData = useSession()
  const signUpMutation = useSignUp()
  const signInMutation = useSignIn()
  const signOutMutation = useSignOut()

  return {
    ...sessionData,
    signUp: signUpMutation.mutateAsync,
    signIn: signInMutation.mutateAsync,
    signOut: signOutMutation.mutateAsync,
    isSigningUp: signUpMutation.isPending,
    isSigningIn: signInMutation.isPending,
    isSigningOut: signOutMutation.isPending,
    signUpError: signUpMutation.error,
    signInError: signInMutation.error,
    signOutError: signOutMutation.error,
  }
}

export function useQuery<TData = Record<string, unknown>>(
  table: string,
  query?: (qb: ReturnType<VrixoClient['database']['from']>) => ReturnType<VrixoClient['database']['from']>,
  options?: Omit<UseQueryOptions<GenericResponse<TData[]>>, 'queryKey' | 'queryFn'>
) {
  const vrixo = useVrixo()

  return useReactQuery<GenericResponse<TData[]>>({
    queryKey: ['vrixo', 'db', table, query?.toString()],
    queryFn: async () => {
      let builder = vrixo.database.from(table)
      if (query) {
        builder = query(builder) as typeof builder
      }
      return builder
    },
    ...options,
  } as UseQueryOptions<GenericResponse<TData[]>>)
}

export function useMutation<TData = Record<string, unknown>, TVariables = unknown>(
  table: string,
  operation: 'insert' | 'update' | 'delete',
  options?: Omit<UseMutationOptions<GenericResponse<TData>, Error, TVariables>, 'mutationFn'>
) {
  const vrixo = useVrixo()
  const queryClient = useQueryClient()

  return useReactMutation<GenericResponse<TData>, Error, TVariables>({
    mutationFn: async (variables) => {
      const builder = vrixo.database.from(table)
      let result: GenericResponse<TData>

      switch (operation) {
        case 'insert':
          result = await (builder.insert(variables as Partial<TData> & Record<string, unknown>) as unknown as Promise<GenericResponse<TData>>)
          break
        case 'update':
          result = await (builder.update(variables as Partial<TData> & Record<string, unknown>) as unknown as Promise<GenericResponse<TData>>)
          break
        case 'delete':
          result = await (builder.delete() as unknown as Promise<GenericResponse<TData>>)
          break
        default:
          throw new Error(`Unknown operation: ${operation}`)
      }

      if (result.error) throw result.error
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vrixo', 'db', table] })
    },
    ...options,
  })
}

export function useSubscription(channelName: string, event: string) {
  const vrixo = useVrixo()

  const subscribe = (callback: (payload: unknown) => void): (() => void) => {
    vrixo.realtime.connect()
    const channel = vrixo.realtime.channel(channelName)
    channel.on(event, callback)
    channel.subscribe()
    return () => {
      channel.off(event)
    }
  }

  return { subscribe }
}

export function useStorage(path: string, bucket?: string) {
  const vrixo = useVrixo()
  const queryClient = useQueryClient()
  const targetBucket = bucket || 'default'

  const uploadFile = async (file: Blob | File, filePath?: string) => {
    const targetPath = filePath || path
    const result = await vrixo.storage.from(targetBucket).upload(targetPath, file)
    if (result.error) throw result.error
    queryClient.invalidateQueries({ queryKey: ['vrixo', 'storage', targetBucket] })
    return result.data
  }

  const downloadFile = async () => {
    const result = await vrixo.storage.from(targetBucket).download(path)
    if (result.error) throw result.error
    return result.data
  }

  const listFiles = async (listPath?: string) => {
    const result = await vrixo.storage.from(targetBucket).list(listPath || path)
    if (result.error) throw result.error
    return result.data
  }

  const deleteFile = async (paths: string | string[]) => {
    const targetPaths = Array.isArray(paths) ? paths : [paths]
    const result = await vrixo.storage.from(targetBucket).remove(targetPaths)
    if (result.error) throw result.error
    queryClient.invalidateQueries({ queryKey: ['vrixo', 'storage', targetBucket] })
  }

  const getPublicUrl = (filePath?: string) => {
    return vrixo.storage.from(targetBucket).getPublicUrl(filePath || path)
  }

  return {
    upload: uploadFile,
    download: downloadFile,
    list: listFiles,
    remove: deleteFile,
    getPublicUrl,
  }
}
