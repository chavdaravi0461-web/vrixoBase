# Vrixo SDK

The official VrixoBase client SDK for JavaScript/TypeScript.

## Installation

```bash
npm install vrixo-sdk
```

## Quick Start

```typescript
import { createClient } from 'vrixo-sdk'

const vrixo = createClient(
  'https://your-project.vrixobase.com',
  'your-anon-key'
)
```

## Auth

```typescript
// Sign up
const { data, error } = await vrixo.auth.signUp('email@example.com', 'password')

// Sign in
const { data, error } = await vrixo.auth.signIn('email@example.com', 'password')

// Sign out
await vrixo.auth.signOut()

// Get session
const { data: { session } } = await vrixo.auth.getSession()

// Listen to auth changes
const { unsubscribe } = vrixo.auth.onAuthStateChange((event, session) => {
  console.log(event, session)
})

// OAuth
await vrixo.auth.signInWithOAuth('google')

// Password reset
await vrixo.auth.resetPassword('email@example.com')

// Refresh session
await vrixo.auth.refreshSession()
```

## Database

```typescript
// Select
const { data, error } = await vrixo
  .database
  .from('todos')
  .select('id, title, completed')
  .eq('completed', false)
  .order('created_at', { ascending: false })
  .limit(10)

// Insert
const { data, error } = await vrixo
  .database
  .from('todos')
  .insert({ title: 'New task', completed: false })

// Update
const { data, error } = await vrixo
  .database
  .from('todos')
  .update({ completed: true })
  .eq('id', 1)

// Delete
const { error } = await vrixo
  .database
  .from('todos')
  .delete()
  .eq('id', 1)

// Single row
const { data } = await vrixo
  .database
  .from('todos')
  .select()
  .eq('id', 1)
  .single()
```

## Storage

```typescript
// List buckets
const { data: buckets } = await vrixo.storage.listBuckets()

// Upload
const file = new File(['hello'], 'hello.txt')
const { data, error } = await vrixo.storage
  .from('my-bucket')
  .upload('path/to/file.txt', file)

// Download
const { data: blob } = await vrixo.storage
  .from('my-bucket')
  .download('path/to/file.txt')

// List files
const { data: files } = await vrixo.storage
  .from('my-bucket')
  .list('folder')

// Public URL
const { data: { publicUrl } } = vrixo.storage
  .from('my-bucket')
  .getPublicUrl('path/to/file.txt')
```

## Realtime

```typescript
// Connect
vrixo.realtime.connect()

// Subscribe to channel
const channel = vrixo.realtime.channel('my-channel')
channel.on('message', (payload) => console.log(payload))
channel.subscribe()

// Presence
channel.track({ user: 'user-1', online: true })

// Disconnect
vrixo.realtime.disconnect()
```

## Functions

```typescript
// Invoke function
const { data, error } = await vrixo.functions.invoke('hello-world', {
  name: 'Alice'
})

// List functions
const { data: functions } = await vrixo.functions.list()

// Get function status
const { data: metrics } = await vrixo.functions.getStatus('hello-world')
```

## TypeScript

The SDK is fully typed. You can provide table types for type-safe queries:

```typescript
interface Todo {
  id: number
  title: string
  completed: boolean
  created_at: string
}

const { data } = await vrixo
  .database
  .from<Todo>('todos')
  .select()
  .eq('completed', false)
```

## License

MIT
