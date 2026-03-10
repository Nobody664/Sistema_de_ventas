# AGENTS.md - SISTEMA_DE_VENTAS

## Project Overview

This is a full-stack sales management system with:
- **Backend**: NestJS + Prisma ORM + PostgreSQL + BullMQ
- **Frontend**: Next.js 16 + React 19 + Tailwind CSS + Zustand

---

## Commands

### Backend (E:\SISTEMA_DE_VENTAS\backend)

```bash
# Development
npm run dev              # Start with hot reload
npm run build            # Production build
npm run start            # Run production build

# Linting & Type Checking
npm run lint             # TypeScript strict check (tsc --noEmit)
npm run format           # Prettier check

# Database (Prisma)
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate  # Run migrations
npm run prisma:db:push  # Push schema to DB
npm run prisma:studio   # Open Prisma Studio
npm run db:seed         # Seed database
```

### Frontend (E:\SISTEMA_DE_VENTAS\frontend)

```bash
# Development
npm run dev              # Start Next.js dev server
npm run build            # Production build
npm run start            # Run production build

# Linting & Type Checking
npm run lint            # TypeScript strict check
npm run format          # Prettier check
```

---

## Code Style Guidelines

### TypeScript Configuration
- **Target**: ES2022
- **Strict mode**: Enabled
- Use TypeScript types for all function parameters and return values
- Avoid `any` - use `unknown` or proper generics instead

### Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files | kebab-case | `auth.service.ts` |
| Classes | PascalCase | `AuthService` |
| Interfaces | PascalCase | `UserDto` |
| Enums | PascalCase | `ProductStatus` |
| DTOs | PascalCase + `Dto` suffix | `CreateUserDto` |
| Controllers | PascalCase + `Controller` suffix | `UsersController` |
| Services | PascalCase + `Service` suffix | `UsersService` |
| Database models | PascalCase | `Company`, `User` |

### Imports

**Order:**
1. External libraries (`@nestjs/*`, `prisma`, `argon2`)
2. Internal modules (`@/modules/*`)
3. Relative imports (`../`, `./`)

```typescript
// Correct
import { Body, Controller, Post } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '@/database/prisma/prisma.service';
import { UsersService } from '@/modules/users/users.service';
import { LoginDto } from './dto/auth.dto';
```

**Use path aliases (`@/*`):**
```typescript
import { PrismaService } from '@/database/prisma/prisma.service';
```

### Prisma 7+ Guidelines

**Shutdown hooks**: Use NestJS lifecycle hooks instead of Prisma's `beforeExit`:

```typescript
// CORRECT - Use onModuleDestroy
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

**Transactions**: Prisma 7 removed `$on` methods. For transactions:
```typescript
// Use $transaction with proper typing
const result = await this.prisma.$transaction(async (tx) => {
  // tx has PrismaClient type minus $on/$connect/$disconnect/$transaction/$extends
  return tx.product.update({ ... });
});
```

### Error Handling

- Throw HTTP exceptions from services (NotFoundException, ConflictException, UnauthorizedException)
- Use NestJS exception filters for global error handling
- Always handle async errors with try-catch or `.catch()`

```typescript
// Service layer
async findById(id: string): Promise<User> {
  const user = await this.repo.findOne({ where: { id } });
  if (!user) {
    throw new NotFoundException(`User #${id} not found`);
  }
  return user;
}
```

### Controllers

- Keep controllers thin - delegate to services
- Use DTOs for request validation
- Apply `@Public()` decorator for public endpoints

```typescript
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }
}
```

### General Rules

- **No comments** unless required for complex logic
- Use `async/await` - avoid callback-style
- Prefer `const` over `let`
- Use readonly for immutable fields
- Use `Logger` from `@nestjs/common` for logging

---

## Architecture Patterns

### Module Structure
Each feature module should follow this structure:
```
modules/[feature]/
├── dto/
│   ├── create-.dto.ts
│   └── update-.dto.ts
├── [feature].controller.ts
├── [feature].module.ts
└── [feature].service.ts
```

### Dependency Injection
- Use constructor injection
- Prefer singleton scope (default)
- Avoid service locator pattern

---

## Existing Skills

The project includes specialized skills in `.agents/skills/`:
- `nestjs-best-practices` - NestJS architecture guidelines
- `next-best-practices` - Next.js patterns
- `debugging` - Systematic debugging methodology
- `mui` - Material-UI patterns (if used)
- `frontend-design` - UI/UX guidelines

---

## Key Files

| File | Purpose |
|------|---------|
| `backend/prisma/schema.prisma` | Database schema |
| `backend/src/main.ts` | Application bootstrap |
| `backend/src/app.module.ts` | Root module |
| `frontend/src/app/` | Next.js App Router |
