# Contributing to VrixoBase

Thank you for your interest in contributing! We welcome contributions from everyone.

---

## Code of Conduct

By participating in this project, you agree to abide by our code of conduct:

- **Be respectful** — Treat others with respect and professionalism
- **Be inclusive** — Welcome people of all backgrounds and experience levels
- **Be constructive** — Focus on solutions, not blame
- **Be collaborative** — Work together to improve the project
- **Be humble** — Nobody knows everything; ask questions and help others

---

## Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Docker](https://docker.com) and Docker Compose
- [Git](https://git-scm.com/)

### Clone and Set Up

```bash
# Fork the repository first, then clone your fork
git clone https://github.com/your-username/vrixobase.git
cd vrixobase

# Add upstream remote
git remote add upstream https://github.com/your-org/vrixobase.git

# Run the setup script
bash scripts/setup.sh --dev
```

### Manual Setup

```bash
# Copy environment variables
cp .env.example .env

# Install backend dependencies
cd backend
npm install

# Generate Prisma client and run migrations
npx prisma generate
npx prisma migrate dev

# (Optional) Seed database
npx ts-node prisma/seed.ts

# Install frontend dependencies
cd ../frontend
npm install

# Start development servers
# Terminal 1: Backend
cd backend && npm run start:dev

# Terminal 2: Frontend
cd frontend && npm run dev

# Terminal 3: Docker services (PostgreSQL, Redis, MinIO)
docker-compose up -d postgres redis minio
```

### Environment Variables

Copy `.env.example` to `.env` and adjust as needed:

```bash
cp .env.example .env
```

Key development settings:

```env
NODE_ENV=development
JWT_SECRET=dev_jwt_secret
JWT_REFRESH_SECRET=dev_refresh_secret
MINIO_ACCESS_KEY=vrixo_admin
MINIO_SECRET_KEY=vrixo_minio_secret
```

---

## Coding Standards

### General

- **Language:** TypeScript (strict mode)
- **Formatting:** Prettier (default config)
- **Linting:** ESLint with recommended TypeScript rules

### Backend (NestJS)

```typescript
// File naming: kebab-case
// auth.controller.ts, database.service.ts

// Module structure:
// module-name/
//   module-name.module.ts
//   module-name.controller.ts
//   module-name.service.ts
//   dto/
//   entities/
//   guards/
//   decorators/

// Use NestJS conventions:
@Controller('api/resource')
export class ResourceController {
  constructor(private readonly service: ResourceService) {}

  @Get()
  @ApiOperation({ summary: 'List resources' })
  async list() {
    return this.service.list();
  }
}
```

### Frontend (Next.js / React)

```typescript
// Component files: PascalCase
// UserList.tsx, AuthForm.tsx

// Hook files: kebab-case with use- prefix
// use-auth.ts, use-database.ts

// Use functional components with hooks
export function UserList() {
  const { data } = useQuery(/* ... */);
  return <div>{/* ... */}</div>;
}

// Use TypeScript for all components
interface UserListProps {
  projectId: string;
  onSelect: (user: User) => void;
}
```

### Import Order

```typescript
// 1. External dependencies
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

// 2. Internal modules (relative)
import { DatabaseService } from '../database/database.service';

// 3. Types
import type { User } from './entities/user.entity';
```

### Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Files | `kebab-case` | `auth.service.ts` |
| Classes | `PascalCase` | `AuthService` |
| Functions | `camelCase` | `getUserById()` |
| Variables | `camelCase` | `accessToken` |
| Constants | `UPPER_SNAKE_CASE` | `JWT_EXPIRATION` |
| Interfaces | `PascalCase` | `UserProfile` |
| Types | `PascalCase` | `ApiResponse` |
| Enums | `PascalCase` | `ProjectRole` |
| DTOs | `PascalCase` | `CreateUserDto` |
| Directories | `kebab-case` | `database/` |

---

## Pull Request Process

### 1. Before You Start

- Check [open issues](https://github.com/your-org/vrixobase/issues) for existing discussions
- For new features, open an issue first to discuss the approach
- Keep changes focused — one PR per feature or fix

### 2. Branch Naming

```bash
# Features
git checkout -b feat/add-email-templates

# Bug fixes
git checkout -b fix/wrong-redis-connection

# Documentation
git checkout -b docs/update-api-reference

# Refactoring
git checkout -b refactor/extract-auth-service
```

### 3. Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation changes |
| `style` | Formatting, white-space (no code change) |
| `refactor` | Code restructuring (no feature/fix) |
| `test` | Adding or updating tests |
| `chore` | Build, CI, dependencies |
| `perf` | Performance improvement |

**Examples:**
```
feat(auth): add Google OAuth callback handler
fix(storage): handle missing bucket on file upload
docs(api): add signed URL endpoint documentation
refactor(database): extract query builder into separate service
test(auth): add MFA verification test cases
chore(deps): upgrade Prisma to 5.8.0
```

### 4. Before Submitting

```bash
# Rebase on latest upstream main
git fetch upstream
git rebase upstream/main

# Run linting
cd backend && npm run lint
cd frontend && npm run lint

# TypeScript check
cd backend && npx tsc --noEmit
cd frontend && npm run typecheck

# Run tests
cd backend && npm run test
cd backend && npm run test:e2e

# Build (ensure no errors)
cd backend && npm run build
cd frontend && npm run build
```

### 5. PR Checklist

- [ ] Code follows project coding standards
- [ ] Tests added/updated and passing
- [ ] Linting passes
- [ ] TypeScript compilation passes
- [ ] PR description clearly explains the changes
- [ ] Related issue referenced (e.g., `Closes #123`)
- [ ] Documentation updated (if applicable)
- [ ] No TODO or debug code left behind

### 6. Review Process

1. Maintainers review the PR
2. Automated checks (CI) must pass
3. Address review feedback with additional commits
4. Once approved, maintainer merges the PR
5. Branch is deleted after merge

---

## Testing Guidelines

### Backend Tests

```bash
# Unit tests
cd backend
npm run test

# Watch mode
npm run test:watch

# Coverage report
npm run test:cov

# E2E tests
npm run test:e2e
```

**Test structure:**
```
backend/src/modules/auth/
├── auth.controller.ts
├── auth.service.ts
├── auth.controller.spec.ts     # Unit test
├── auth.service.spec.ts        # Unit test
└── test/
    └── auth.e2e-spec.ts        # E2E test
```

**What to test:**
- Services: business logic, edge cases, error handling
- Controllers: request/response mapping, validation
- Guards: authorization logic
- Pipes: input transformation
- E2E: full request/response cycles against test database

**Test conventions:**
```typescript
describe('AuthService', () => {
  let service: AuthService;
  let databaseService: DatabaseService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('register', () => {
    it('should create a new user and return tokens', async () => {
      const result = await service.register(registerDto);
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should throw ConflictException for duplicate email', async () => {
      await expect(service.register(existingDto))
        .rejects.toThrow(ConflictException);
    });
  });
});
```

### Frontend Tests

```bash
cd frontend
# Component testing with Testing Library
npm run test
```

---

## Project Structure Guidelines

### Backend

```
backend/src/
├── modules/         # Feature modules
│   ├── auth/       # Authentication
│   ├── database/   # Database management
│   ├── storage/    # File storage
│   ├── realtime/   # WebSocket and subscriptions
│   ├── functions/  # Serverless functions
│   ├── monitoring/ # Metrics and monitoring
│   ├── security/   # RLS, secrets, API keys
│   ├── team/       # Team management
│   ├── audit/      # Audit logging
│   ├── project/    # Project CRUD
│   └── health/     # Health check
├── common/         # Shared code
│   ├── decorators/ # Custom decorators
│   ├── filters/    # Exception filters
│   ├── interceptors/ # Request/response interceptors
│   ├── pipes/      # Validation pipes
│   ├── prisma/     # Prisma service
│   └── utils/      # Helper functions
├── app.module.ts   # Root module
└── main.ts         # Entry point
```

### Frontend

```
frontend/src/
├── app/            # Next.js App Router pages
│   ├── (dashboard)/ # Dashboard layout group
│   ├── api/        # API proxy routes
│   ├── auth/       # Auth pages
│   ├── dashboard/  # Dashboard pages
│   ├── database/   # Database pages
│   ├── functions/  # Functions pages
│   ├── monitoring/ # Monitoring pages
│   ├── realtime/   # Realtime pages
│   ├── storage/    # Storage pages
│   ├── settings/   # Settings pages
│   └── team/       # Team pages
├── components/     # Reusable components
│   ├── api/        # API-related components
│   ├── auth/       # Auth UI components
│   ├── common/     # Shared UI components
│   ├── database/   # Database components
│   ├── functions/  # Functions components
│   ├── layout/     # Layout components
│   ├── storage/    # Storage components
│   └── ui/         # Base UI components
├── hooks/          # Custom React hooks
├── lib/            # Utilities and API client
│   ├── api/        # API functions
│   └── sdk/        # Client SDK
├── stores/         # Zustand state stores
└── types/          # TypeScript types
```

---

## Documentation

When adding or changing features, update the relevant documentation:

| File | Content |
|------|---------|
| `README.md` | Main project overview, badges, quick start |
| `docs/API.md` | API endpoint reference |
| `docs/DEPLOYMENT.md` | Deployment instructions |
| `docs/ARCHITECTURE.md` | System design documentation |
| `docs/SECURITY.md` | Security checklist and best practices |
| `docs/SDK.md` | Client SDK documentation |
| `docs/ROADMAP.md` | Feature roadmap |
| `docs/CONTRIBUTING.md` | Contribution guidelines |

### Documentation Standards

- Use GitHub-flavored markdown
- Include code examples for API endpoints
- Keep tables for structured data
- Use fenced code blocks with language identifiers

---

## Getting Help

- **Issues:** Open a GitHub issue for bugs, feature requests, or questions
- **Discussions:** Use GitHub Discussions for general questions
- **Security issues:** Email maintainers directly (see SECURITY.md)
