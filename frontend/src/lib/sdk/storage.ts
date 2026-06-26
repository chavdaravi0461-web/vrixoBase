import type { Bucket, FileObject, FileOptions, GenericResponse, DownloadOptions } from './types'
import { API_ENDPOINTS, STORAGE_DEFAULTS } from './constants'

export class StorageClient {
  private url: string
  private headers: () => Record<string, string>

  constructor(url: string, headers: () => Record<string, string>) {
    this.url = `${url.replace(/\/$/, '')}${API_ENDPOINTS.storage}`
    this.headers = headers
  }

  async createBucket(name: string, options?: { public?: boolean; fileSizeLimit?: number; allowedMimeTypes?: string[] }): Promise<GenericResponse<Bucket>> {
    try {
      const res = await fetch(`${this.url}/bucket`, {
        method: 'POST',
        headers: {
          ...this.headers(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          public: options?.public ?? false,
          file_size_limit: options?.fileSizeLimit,
          allowed_mime_types: options?.allowedMimeTypes,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        return { data: null, error: new Error(data.message || data.error || 'Failed to create bucket') }
      }
      return { data: data as Bucket, error: null }
    } catch (err) {
      return { data: null, error: err instanceof Error ? err : new Error('Network error creating bucket') }
    }
  }

  async getBucket(id: string): Promise<GenericResponse<Bucket>> {
    try {
      const res = await fetch(`${this.url}/bucket/${id}`, {
        headers: this.headers(),
      })
      const data = await res.json()
      if (!res.ok) {
        return { data: null, error: new Error(data.message || data.error || 'Bucket not found') }
      }
      return { data: data as Bucket, error: null }
    } catch (err) {
      return { data: null, error: err instanceof Error ? err : new Error('Network error getting bucket') }
    }
  }

  async listBuckets(): Promise<GenericResponse<Bucket[]>> {
    try {
      const res = await fetch(`${this.url}/bucket`, {
        headers: this.headers(),
      })
      const data = await res.json()
      if (!res.ok) {
        return { data: null, error: new Error(data.message || data.error || 'Failed to list buckets') }
      }
      return { data: data as Bucket[], error: null }
    } catch (err) {
      return { data: null, error: err instanceof Error ? err : new Error('Network error listing buckets') }
    }
  }

  async deleteBucket(id: string): Promise<GenericResponse<void>> {
    try {
      const res = await fetch(`${this.url}/bucket/${id}`, {
        method: 'DELETE',
        headers: this.headers(),
      })
      if (!res.ok) {
        const data = await res.json()
        return { data: null, error: new Error(data.message || data.error || 'Failed to delete bucket') }
      }
      return { data: undefined as unknown as void, error: null }
    } catch (err) {
      return { data: null, error: err instanceof Error ? err : new Error('Network error deleting bucket') }
    }
  }

  from(bucket: string): StorageFileApi {
    return new StorageFileApi(this.url, bucket, this.headers)
  }
}

export class StorageFileApi {
  private url: string
  private bucket: string
  private headers: () => Record<string, string>

  constructor(url: string, bucket: string, headers: () => Record<string, string>) {
    this.url = url
    this.bucket = bucket
    this.headers = headers
  }

  async upload(path: string, file: Blob | ArrayBuffer | File, options?: FileOptions): Promise<GenericResponse<FileObject>> {
    const formData = new FormData()
    formData.append('file', file instanceof Blob ? file : new Blob([file]))
    if (options?.metadata) {
      formData.append('metadata', JSON.stringify(options.metadata))
    }

    try {
      const res = await fetch(`${this.url}/object/${this.bucket}/${path}`, {
        method: 'POST',
        headers: {
          ...this.headers(),
          ...(options?.cacheControl ? { 'cache-control': options.cacheControl } : {}),
          ...(options?.upsert ? { 'x-upsert': 'true' } : {}),
        },
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) {
        return { data: null, error: new Error(data.message || data.error || 'Upload failed') }
      }
      return { data: data as FileObject, error: null }
    } catch (err) {
      return { data: null, error: err instanceof Error ? err : new Error('Network error during upload') }
    }
  }

  async download(path: string, options?: DownloadOptions): Promise<GenericResponse<Blob>> {
    try {
      let urlPath = `${this.url}/object/${this.bucket}/${path}`
      if (options?.transform) {
        const t = options.transform
        const params = new URLSearchParams()
        if (t.width) params.set('width', String(t.width))
        if (t.height) params.set('height', String(t.height))
        if (t.resize) params.set('resize', t.resize)
        if (t.format && t.format !== 'origin') params.set('format', t.format)
        if (t.quality) params.set('quality', String(t.quality))
        const qs = params.toString()
        if (qs) urlPath += `?${qs}`
      }

      const res = await fetch(urlPath, { headers: this.headers() })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        return { data: null, error: new Error(data.message || data.error || 'Download failed') }
      }
      const blob = await res.blob()
      return { data: blob, error: null }
    } catch (err) {
      return { data: null, error: err instanceof Error ? err : new Error('Network error during download') }
    }
  }

  async list(path?: string, options?: { limit?: number; offset?: number; sortBy?: { column?: string; order?: string } }): Promise<GenericResponse<FileObject[]>> {
    try {
      const params = new URLSearchParams()
      if (options?.limit) params.set('limit', String(options.limit))
      if (options?.offset) params.set('offset', String(options.offset))
      if (options?.sortBy) {
        params.set('sortBy', JSON.stringify(options.sortBy))
      }
      const qs = params.toString()
      const urlPath = `${this.url}/object/${this.bucket}${path ? `/${path}` : ''}${qs ? `?${qs}` : ''}`

      const res = await fetch(urlPath, {
        method: 'GET',
        headers: this.headers(),
      })

      const data = await res.json()
      if (!res.ok) {
        return { data: null, error: new Error(data.message || data.error || 'List failed') }
      }
      return { data: data as FileObject[], error: null }
    } catch (err) {
      return { data: null, error: err instanceof Error ? err : new Error('Network error listing files') }
    }
  }

  async remove(paths: string[]): Promise<GenericResponse<void>> {
    try {
      const res = await fetch(`${this.url}/object/${this.bucket}`, {
        method: 'DELETE',
        headers: {
          ...this.headers(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prefixes: paths }),
      })

      if (!res.ok) {
        const data = await res.json()
        return { data: null, error: new Error(data.message || data.error || 'Delete failed') }
      }
      return { data: undefined as unknown as void, error: null }
    } catch (err) {
      return { data: null, error: err instanceof Error ? err : new Error('Network error deleting files') }
    }
  }

  getPublicUrl(path: string): { data: { publicUrl: string } } {
    return {
      data: {
        publicUrl: `${this.url}/object/public/${this.bucket}/${path}`,
      },
    }
  }

  async getSignedUrl(path: string, expiresIn: number = 3600): Promise<GenericResponse<{ signedUrl: string }>> {
    try {
      const res = await fetch(`${this.url}/object/sign/${this.bucket}/${path}`, {
        method: 'POST',
        headers: {
          ...this.headers(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expiresIn }),
      })

      const data = await res.json()
      if (!res.ok) {
        return { data: null, error: new Error(data.message || data.error || 'Sign URL failed') }
      }
      return { data: { signedUrl: data.url || data.signedUrl }, error: null }
    } catch (err) {
      return { data: null, error: err instanceof Error ? err : new Error('Network error signing URL') }
    }
  }

  async copy(from: string, to: string): Promise<GenericResponse<FileObject>> {
    try {
      const destPath = `${this.bucket}/${to}`
      const res = await fetch(`${this.url}/object/copy`, {
        method: 'POST',
        headers: {
          ...this.headers(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceBucket: this.bucket,
          sourceKey: from,
          destinationBucket: this.bucket,
          destinationKey: to,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        return { data: null, error: new Error(data.message || data.error || 'Copy failed') }
      }
      return { data: data as FileObject, error: null }
    } catch (err) {
      return { data: null, error: err instanceof Error ? err : new Error('Network error copying file') }
    }
  }

  async move(from: string, to: string): Promise<GenericResponse<void>> {
    try {
      const res = await fetch(`${this.url}/object/move`, {
        method: 'POST',
        headers: {
          ...this.headers(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceBucket: this.bucket,
          sourceKey: from,
          destinationBucket: this.bucket,
          destinationKey: to,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        return { data: null, error: new Error(data.message || data.error || 'Move failed') }
      }
      return { data: undefined as unknown as void, error: null }
    } catch (err) {
      return { data: null, error: err instanceof Error ? err : new Error('Network error moving file') }
    }
  }

  async createSignedUploadUrl(path: string): Promise<GenericResponse<{ signedUrl: string; token: string }>> {
    try {
      const res = await fetch(`${this.url}/object/upload/sign/${this.bucket}/${path}`, {
        method: 'POST',
        headers: {
          ...this.headers(),
          'Content-Type': 'application/json',
        },
      })

      const data = await res.json()
      if (!res.ok) {
        return { data: null, error: new Error(data.message || data.error || 'Create signed upload URL failed') }
      }
      return { data: { signedUrl: data.url, token: data.token }, error: null }
    } catch (err) {
      return { data: null, error: err instanceof Error ? err : new Error('Network error creating signed upload URL') }
    }
  }
}
