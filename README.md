# School Management System SaaS (Production Foundation)

A multi-tenant School Management System (SMS) SaaS built with **React**, **TypeScript**, **Node.js**, **Supabase PostgreSQL**, **Supabase Auth**, and **Tailwind CSS**.

---

## 1. Architectural Highlights

- **Strict Multi-Tenant Isolation**: Enforced at the gateway middleware, service layer, and database via PostgreSQL Row-Level Security (RLS). Cross-tenant queries and tampering attempts are rejected with `403 Forbidden` (`TENANT_VIOLATION`) and logged to an immutable audit trail.
- **Universal User Model**: All personas (students, teachers, admins, directors, staff, parents) are stored in a universal `users` table. User categorization (`user_types`) is decoupled from authorization.
- **Dynamic RBAC & Data Scoping**: Zero hardcoded role checks. Permissions are evaluated dynamically against `permissions`, `roles`, `role_permissions`, and `data_scopes` (e.g. `ALL_SCHOOLS`, `ALL_LOCATIONS`, `SELECTED_LOCATIONS`, `ONE_LOCATION`, `ASSIGNED_CLASSES`).
- **Zero Hardcoded Business Configuration**: Feature toggles, settings, scopes, and user types are loaded dynamically from database tables.
- **Multitasking Workspace**: A tab/bubble workspace supporting up to **8 concurrently open modules** with complete state preservation (search, filters, form drafts, selected records). Includes an interactive overflow modal when attempting to open a 9th module.
- **Dual Database Mode (Zero Friction)**: Provides standard Supabase PostgreSQL migration scripts and connection configurations (`DATABASE_URL`), while also offering an in-memory relational engine for instant local development and offline automated testing.

---

## 2. Directory Structure

```
.
├── package.json                   # Root monorepo workspace scripts
├── packages/
│   ├── backend/                   # Node.js + TypeScript API Server
│   │   ├── src/
│   │   │   ├── config/            # Environment & app configuration
│   │   │   ├── db/                # Database clients, seeds & migrations
│   │   │   │   ├── migrations/
│   │   │   │   │   ├── 001_core_schema.sql
│   │   │   │   │   ├── 002_rls_policies.sql
│   │   │   │   │   ├── 003_system_seed.sql
│   │   │   │   │   └── 004_demo_seed.sql
│   │   │   ├── middleware/        # Auth, Tenant isolation, RBAC, Audit
│   │   │   ├── repositories/      # Data access layer (Portable)
│   │   │   ├── routes/            # REST API endpoints (/api/v1/...)
│   │   │   ├── services/          # Pure business logic services
│   │   │   └── types/             # Domain TypeScript interfaces
│   │   └── tests/                 # Automated test suite
│   └── frontend/                  # React + TypeScript + Vite + Tailwind
│       ├── src/
│       │   ├── api/               # Typed API client with security headers
│       │   ├── components/        # Layout, common UI, workspace tabs
│       │   ├── context/           # AuthContext, WorkspaceContext
│       │   ├── hooks/             # useAuth, usePermission, useWorkspace
│       │   └── modules/           # Tab screens (Users, Roles, Settings, etc.)
│       └── vite.config.ts
└── README.md
```

---

## 3. Quick Start & Execution

### Prerequisites
Node.js v20+ or v22 LTS (installed locally in `.tools/node`).

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
*(If `DATABASE_URL` is omitted, the system runs on its built-in portable engine with complete demo seed data ready for testing!)*

### 3. Run Backend API Server
```bash
npm run dev:backend
# API running on http://localhost:4000
```

### 4. Run Frontend Web Application
```bash
npm run dev:frontend
# Web app running on http://localhost:5173
```

### 5. Run Automated Tests
```bash
npm run test:backend
```

---

## 4. Test Personas for Demonstration

When signing in at `http://localhost:5173/`, you can use one-click buttons or enter credentials (`password: password123`):

| Persona | Username | Role / Scope | Permitted Branches |
| :--- | :--- | :--- | :--- |
| **School A Director** | `rajesh.sharma` | School Director (`ALL_LOCATIONS`) | Dwarka Main Campus & Noida Extension |
| **School A Branch Admin** | `sunita.rao` | Branch Admin (`ONE_LOCATION`) | Dwarka Main Campus Only |
| **School A Teacher** | `vikram.verma` | Teacher (`ASSIGNED_CLASSES`) | Dwarka Main Campus & Noida Extension |
| **School B Director** | `anita.desai` | School Director (School B) | Mumbai Central Campus Only |
| **Platform SuperAdmin** | `superadmin` | SaaS Super Admin (`ALL_SCHOOLS`) | All Schools & Platform Operations |

---

## 5. Security & Verification Summary

- **Cross-Tenant Attack Test**: Attempting to query School B records with a School A token returns `403 Forbidden` (`TENANT_VIOLATION`) and records a tamper event in `audit_logs`.
- **Dynamic RBAC Test**: Teachers cannot access administrative endpoints or role configurations.
- **Branch Scope Test**: Branch Admins with `ONE_LOCATION` scope cannot access unassigned branches.
- **Multitasking Workspace**: Up to 8 open tabs preserve state, search queries, and filters when toggling back and forth.
