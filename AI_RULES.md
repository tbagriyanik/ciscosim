# AI_RULES.md

## Tech Stack Overview

- **Framework**: Next.js (React-based) with TypeScript
- **Styling**: Tailwind CSS with custom components
- **State Management**: Zustand (global state) + Context API
- **Database**: Prisma ORM with SQLite
- **UI Components**: Custom-built components (no third-party libraries)
- **Network**: Custom network topology visualization with D3.js
- **Build Tools**: Vite (Next.js dev server)
- **Testing**: Jest + React Testing Library
- **Deployment**: Caddy server with automatic SSL

## Library Usage Rules

### 1. State Management
- **Zustand** is the **only** approved global state solution
- Context API for component-level state (when Zustand is overkill)
- No Redux, MobX, or other state management libraries allowed

### 2. UI Components
- **All UI components must be built in-house** (no third-party libraries)
- Tailwind CSS for styling with custom component classes
- No Material-UI, Ant Design, or similar component libraries

### 3. Network Operations
- **Axios** for HTTP requests (with custom interceptors)
- No fetch API or other HTTP clients
- Custom network topology visualization using D3.js

### 4. Database Operations
- **Prisma** for all database interactions
- SQLite for development (production uses PostgreSQL)
- No raw SQL queries allowed

### 5. Utilities
- **Custom utilities** in `src/lib/utils.ts` (no lodash/underscore)
- **Custom hooks** in `src/hooks/` (no react-use-* libraries)
- **Custom types** in `src/lib/types.ts` (no external type definitions)

### 6. Testing
- **Jest** for unit tests
- **React Testing Library** for component tests
- No Cypress or other E2E testing tools

### 7. Deployment
- **Caddy** as web server (no Nginx or Apache)
- Automatic SSL via Let's Encrypt
- No custom server-side rendering (Next.js SSG/ISR only)

### 8. Security
- **No external libraries** for security (use built-in Next.js features)
- Custom input validation in network operations
- No third-party authentication (Supabase integration planned)

### 9. Custom Components
- All components must follow existing patterns in `src/components/`
- No new component libraries (build from scratch)
- Use Tailwind classes for styling consistency

### 10. Documentation
- **All new components** require JSDoc comments
- **All new features** require planning.md updates
- **All breaking changes** require version bump in package.json

## Approval Process
- Any new library requires approval from the tech lead
- Library requests must include:
  1. Use case justification
  2. Comparison with existing solutions
  3. Implementation plan
  4. Security assessment

## Exceptions
- **Critical security patches** may bypass approval process
- **Performance optimizations** may use approved libraries
- **Legacy code** may retain existing libraries (with migration plan)

## Enforcement
- Pre-commit hooks will check for banned libraries
- CI pipeline will fail on unapproved library usage
- Code reviews will flag violations

---
*Last updated: 2023-10-05*
*Approved by: