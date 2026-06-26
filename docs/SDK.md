# VrixoBase SDK — JavaScript/TypeScript

The official VrixoBase client SDK for browser and Node.js applications.

---

## Installation

```bash
npm install vrixo-sdk

# or
yarn add vrixo-sdk
```

---

## Client Initialization

```typescript
import { createClient } from 'vrixo-sdk';

const vrixo = createClient({
  url: 'https://api.yourdomain.com',   // VrixoBase API URL
  projectId: 'proj-id',                 // Your project ID
  anonKey: 'your-anon-api-key',         // Public API key (optional)
});
```

### With Auth Token

```typescript
const vrixo = createClient({
  url: 'https://api.yourdomain.com',
  projectId: 'proj-id',
  auth: {
    accessToken: 'jwt-token',           // Pre-authenticated token
    refreshToken: 'refresh-token',      // For automatic refresh
  },
});
```

---

## Auth

### Sign Up

```typescript
const { data, error } = await vrixo.auth.signUp({
  email: 'user@example.com',
  password: 'securePassword123',
  options: {
    name: 'John Doe',
  },
});

// data.user
// data.accessToken
// data.refreshToken
```

### Sign In

```typescript
// Email & password
const { data, error } = await vrixo.auth.signIn({
  email: 'user@example.com',
  password: 'securePassword123',
});

// OAuth — redirects to provider
const { data, error } = await vrixo.auth.signInWithOAuth({
  provider: 'google',
  // or: 'github'
});

// MFA verification (after sign-in if MFA is enabled)
const { data, error } = await vrixo.auth.verifyMfa({
  token: '123456',
  secret: 'base32-secret',
});
```

### Sign Out

```typescript
await vrixo.auth.signOut();
```

### Get Session

```typescript
const session = await vrixo.auth.getSession();
// session.accessToken
// session.refreshToken
// session.user
```

### On Auth State Change

```typescript
const { data: subscription } = vrixo.auth.onAuthStateChange((event, session) => {
  console.log('Auth event:', event);
  // 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED'
  console.log('Session:', session);
});

// Cleanup
subscription.unsubscribe();
```

### Reset Password

```typescript
// Request reset
const { error } = await vrixo.auth.resetPasswordForEmail({
  email: 'user@example.com',
});

// Confirm reset (with token from email)
const { error } = await vrixo.auth.confirmPasswordReset({
  token: 'reset-token',
  newPassword: 'newPassword123',
});
```

---

## Database

### Select

```typescript
// Get all rows
const { data, error } = await vrixo
  .from('users')
  .select('*');

// Select specific columns
const { data, error } = await vrixo
  .from('users')
  .select('id, name, email');

// Single row
const { data, error } = await vrixo
  .from('users')
  .select('*')
  .eq('id', 'user-id')
  .single();
```

### Insert

```typescript
const { data, error } = await vrixo
  .from('profiles')
  .insert({
    name: 'John Doe',
    email: 'john@example.com',
    avatar_url: 'https://example.com/avatar.jpg',
  })
  .select();
```

### Update

```typescript
const { data, error } = await vrixo
  .from('profiles')
  .update({ name: 'Jane Doe' })
  .eq('id', 'user-id')
  .select();
```

### Delete

```typescript
const { data, error } = await vrixo
  .from('profiles')
  .delete()
  .eq('id', 'user-id');
```

### Filters

```typescript
// Equality
vrixo.from('users').select('*').eq('status', 'active')

// Not equal
vrixo.from('users').select('*').neq('status', 'deleted')

// Greater than / Less than
vrixo.from('orders').select('*').gt('amount', 100)
vrixo.from('orders').select('*').lt('amount', 50)

// Greater than or equal / Less than or equal
vrixo.from('orders').select('*').gte('amount', 100)
vrixo.from('orders').select('*').lte('amount', 50)

// Like (SQL pattern)
vrixo.from('users').select('*').like('name', '%John%')

// Case insensitive like
vrixo.from('users').select('*').ilike('name', '%john%')

// In array
vrixo.from('users').select('*').in('role', ['admin', 'moderator'])

// Is null / Is not null
vrixo.from('profiles').select('*').is('avatar_url', null)
vrixo.from('profiles').select('*').not('avatar_url', 'is', null)

// Contains (JSONB)
vrixo.from('settings').select('*').contains('preferences', { theme: 'dark' })

// Combined filters
vrixo.from('orders')
  .select('*')
  .eq('status', 'active')
  .gte('amount', 50)
  .lt('created_at', '2025-01-01')
```

### Ordering

```typescript
// Ascending (default)
vrixo.from('users').select('*').order('name')

// Descending
vrixo.from('users').select('*').order('created_at', { ascending: false })

// Multiple order by
vrixo.from('users').select('*')
  .order('status', { ascending: true })
  .order('created_at', { ascending: false })
```

### Pagination

```typescript
// Limit and offset
const { data, count } = await vrixo
  .from('users')
  .select('*', { count: 'exact' })
  .range(0, 19)  // rows 0-19 (first page)

// With limit
const { data } = await vrixo
  .from('users')
  .select('*')
  .limit(10)
  .offset(20)
```

### Count

```typescript
const { count, error } = await vrixo
  .from('users')
  .select('*', { count: 'exact', head: true })

// With filter
const { count, error } = await vrixo
  .from('users')
  .select('*', { count: 'exact', head: true })
  .eq('status', 'active')
```

### Upsert

```typescript
const { data, error } = await vrixo
  .from('profiles')
  .upsert(
    { id: 'user-id', name: 'John', email: 'john@example.com' },
    { onConflict: 'id', ignoreDuplicates: false }
  )
  .select();
```

---

## Storage

### Create Bucket

```typescript
const { data, error } = await vrixo.storage.createBucket('avatars', {
  public: true,
  allowedMimeTypes: ['image/jpeg', 'image/png'],
  maxFileSize: 5242880, // 5MB
});
```

### List Buckets

```typescript
const { data, error } = await vrixo.storage.listBuckets();
```

### Delete Bucket

```typescript
const { error } = await vrixo.storage.deleteBucket('bucket-id');
```

### Upload File

```typescript
const file = event.target.files[0];

const { data, error } = await vrixo.storage
  .from('avatars')
  .upload('user-123/avatar.jpg', file, {
    cacheControl: '3600',
    upsert: false,
  });
```

### Upload from Buffer (Node.js)

```typescript
import { readFile } from 'fs/promises';

const buffer = await readFile('./image.jpg');

const { data, error } = await vrixo.storage
  .from('avatars')
  .upload('user-123/avatar.jpg', buffer, {
    contentType: 'image/jpeg',
  });
```

### Download File

```typescript
const { data, error } = await vrixo.storage
  .from('avatars')
  .download('user-123/avatar.jpg');
// data is a Blob (browser) or Buffer (Node.js)
```

### List Files

```typescript
const { data, error } = await vrixo.storage
  .from('avatars')
  .list('user-123/', {
    limit: 100,
    offset: 0,
    sortBy: { column: 'name', order: 'asc' },
  });
```

### Get Public URL

```typescript
const { data } = vrixo.storage
  .from('avatars')
  .getPublicUrl('user-123/avatar.jpg');

// data.publicUrl: 'https://cdn.example.com/avatars/user-123/avatar.jpg'
```

### Get Signed URL

```typescript
const { data, error } = await vrixo.storage
  .from('documents')
  .createSignedUrl('report.pdf', {
    expiresIn: 3600, // seconds
  });

// data.signedUrl: Temporary authenticated URL (1 hour)
```

### Delete File

```typescript
const { error } = await vrixo.storage
  .from('avatars')
  .remove(['user-123/avatar.jpg']);
```

---

## Realtime

### Subscribe to Table Changes

```typescript
const subscription = vrixo
  .channel('table-db-changes')
  .on(
    'postgres_changes',
    {
      event: '*',        // 'INSERT' | 'UPDATE' | 'DELETE' | '*'
      schema: 'public',
      table: 'users',
      filter: `id=eq.user-id`,  // Optional filter
    },
    (payload) => {
      console.log('Change received:', payload);
      // payload.eventType: 'INSERT' | 'UPDATE' | 'DELETE'
      // payload.new: new row data
      // payload.old: old row data (for UPDATE/DELETE)
    }
  )
  .subscribe();
```

### Subscribe to Broadcast

```typescript
const channel = vrixo.channel('chat-room');

channel
  .on('broadcast', { event: 'message' }, (payload) => {
    console.log('Message:', payload);
  })
  .subscribe();

// Send broadcast
channel.send({
  type: 'broadcast',
  event: 'message',
  payload: { text: 'Hello!', user: 'John' },
});
```

### Presence

```typescript
const channel = vrixo.channel('room-1');

channel
  .on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState();
    console.log('Online users:', state);
  })
  .on('presence', { event: 'join' }, ({ key, newPresences }) => {
    console.log('Joined:', key, newPresences);
  })
  .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
    console.log('Left:', key, leftPresences);
  })
  .subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track({
        user: 'John',
        online_at: new Date().toISOString(),
      });
    }
  });
```

### Unsubscribe

```typescript
subscription.unsubscribe();

// Or remove all subscriptions
vrixo.removeAllChannels();
```

---

## Functions

### Invoke a Function

```typescript
const { data, error } = await vrixo.functions.invoke('hello-world', {
  body: { name: 'World' },
  // headers: { 'X-Custom': 'value' },
});

// Synchronous response
// data: function output

// Async invocation (fire-and-forget)
const { data, error } = await vrixo.functions.invoke('send-email', {
  body: { to: 'user@example.com', template: 'welcome' },
  async: true,
});
// data.executionId
```

---

## TypeScript Types

```typescript
import type {
  VrixoClient,
  AuthResponse,
  Session,
  User,
  PostgrestResponse,
  StorageBucket,
  FileObject,
  RealtimeChannel,
  FunctionsResponse,
} from 'vrixo-sdk';

// Typed queries with Database types
interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          created_at: string;
        };
        Insert: {
          email: string;
          name?: string;
        };
        Update: {
          email?: string;
          name?: string;
        };
      };
      posts: {
        Row: {
          id: string;
          title: string;
          content: string;
          user_id: string;
          created_at: string;
        };
      };
    };
  };
}

const vrixo = createClient<Database>('https://api.example.com', 'project-id');

// Fully typed queries
const { data } = await vrixo
  .from('users')
  .select('id, name, email')
  .eq('id', 'user-id')
  .single();
// data: { id: string; name: string | null; email: string } | null
```

---

## React Hooks

### useAuth

```typescript
import { useAuth } from 'vrixo-sdk/react';

function AuthComponent() {
  const { user, session, isLoading, signIn, signUp, signOut } = useAuth();

  if (isLoading) return <div>Loading...</div>;

  if (!user) {
    return (
      <button onClick={() => signUp({ email, password })}>
        Sign Up
      </button>
    );
  }

  return <div>Welcome, {user.name}</div>;
}
```

### useQuery

```typescript
import { useQuery } from 'vrixo-sdk/react';

function UsersList() {
  const { data, error, isLoading } = useQuery(
    vrixo.from('users').select('id, name, email').order('name'),
    { count: 'exact' }
  );

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <ul>
      {data.map((user) => (
        <li key={user.id}>{user.name} ({user.email})</li>
      ))}
    </ul>
  );
}
```

### useMutation

```typescript
import { useMutation } from 'vrixo-sdk/react';

function CreateUserForm() {
  const mutation = useMutation(
    (newUser) =>
      vrixo.from('users').insert(newUser).select().single(),
    {
      onSuccess: () => {
        // Invalidate queries, show toast, etc.
      },
    }
  );

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      mutation.mutate({ name: 'John', email: 'john@example.com' });
    }}>
      <button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? 'Creating...' : 'Create User'}
      </button>
      {mutation.isError && <p>Error: {mutation.error.message}</p>}
    </form>
  );
}
```

### useSubscription

```typescript
import { useSubscription } from 'vrixo-sdk/react';

function LiveUsers() {
  const [users, setUsers] = useState([]);

  useSubscription(
    vrixo
      .channel('users-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'users' },
        (payload) => {
          console.log('Change:', payload);
          // Update state based on payload
        }
      ),
    ['users-changes'], // dependencies for resubscription
  );

  return <div>Listening for changes...</div>;
}
```

---

## Error Handling

```typescript
// All methods return { data, error }
const { data, error } = await vrixo.from('users').select('*');

if (error) {
  // error.message: Human-readable error
  // error.code: Error code string
  // error.status: HTTP status code
  // error.details: Validation errors (object)
  console.error(`${error.code}: ${error.message}`);
  return;
}

// data contains the response
console.log(data);
```

### Error Codes

| Code | Description |
|------|-------------|
| `UNAUTHORIZED` | Missing or invalid authentication |
| `FORBIDDEN` | Authenticated but not authorized |
| `NOT_FOUND` | Resource not found |
| `VALIDATION_ERROR` | Invalid input data |
| `CONFLICT` | Duplicate or conflict (e.g., email exists) |
| `RATE_LIMITED` | Too many requests |
| `INTERNAL_ERROR` | Server error |
| `NETWORK_ERROR` | Client-side network issue |

### Retry Logic

The SDK includes automatic retry for network errors:

```typescript
const vrixo = createClient({
  url: 'https://api.yourdomain.com',
  projectId: 'proj-id',
  retry: {
    attempts: 3,
    backoff: 'exponential', // or 'linear'
    retryOn: [429, 502, 503, 504],
  },
});
```

---

## Configuration Options

```typescript
const vrixo = createClient({
  // Required
  url: 'https://api.yourdomain.com',
  projectId: 'proj-id',

  // Authentication
  anonKey: 'public-anon-key',
  auth: {
    accessToken: 'jwt',
    refreshToken: 'refresh-token',
    autoRefreshToken: true,       // default: true
    persistSession: true,         // default: true (localStorage)
    storageKey: 'vrixo-auth',     // localStorage key
  },

  // Database
  db: {
    schema: 'public',             // default: 'public'
    fetch: customFetch,           // custom fetch implementation
  },

  // Realtime
  realtime: {
    transport: 'websocket',       // 'websocket' | 'polling'
    timeout: 10000,               // connection timeout
    heartbeatIntervalMs: 15000,   // ping interval
  },

  // Storage
  storage: {
    upload: {
      cacheControl: '3600',
      contentType: 'auto',        // auto-detect or specify
      upsert: false,
    },
  },

  // Global
  headers: { 'X-Custom': 'value' },
  retry: {
    attempts: 3,
    backoff: 'exponential',
    retryOn: [429, 502, 503, 504],
  },
});
```
