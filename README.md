# School Management System SaaS (SMS2)

A production-oriented multi-tenant School Management System designed for SaaS deployment and campus operations. The project combines a TypeScript backend and a React + Tailwind frontend to support school administration, academic workflows, fee management, attendance, examination operations, transport, inventory, asset tracking, library systems, and access-controlled multi-tenant governance.

This repository is structured as a monorepo with a backend API and a frontend app, and it supports both:

- PostgreSQL / Supabase-backed production mode
- In-memory standalone mode for local testing and demos

---

## Overview

SMS2 is built to model a realistic multi-school SaaS platform where each school and campus operate under isolated tenant boundaries, while central administrators can manage platform-wide configuration. The system includes:

- Multi-tenant school and branch isolation
- Dynamic role and permission management
- Universal user model across all school personas
- Authorization based on data scopes and branch access
- Audit logging and tenant violation prevention
- In-memory fallback engine for rapid local setup
- Modern React workspace UI with tab-based navigation

---

## Core Features

### Multi-Tenant Architecture
- School, location, and branch-level isolation using tenant-aware middleware and database policies
- RLS-aware design patterns for PostgreSQL/Supabase usage
- Restriction of cross-school access using tenant validation

### Role-Based Access Control
- Roles and permissions stored dynamically in the database
- Data scopes such as `ALL_SCHOOLS`, `ONE_LOCATION`, `ALL_LOCATIONS`, `ASSIGNED_CLASSES`
- Authorization enforced at middleware and service layers

### School Operations
- User management and profile handling
- School and campus management
- Academic structure and course assignment
- Timetable and attendance management
- Fees and financial workflows
- Exams and result management
- Communication tools
- Admissions and enquiry workflows
- Inventory, asset, and library modules
- Transport operations

### Frontend Experience
- Modern React 19 app with Vite
- Tailwind-based design system
- App shell and workspace tabs
- Quick persona-based login for demo use
- Multi-module workbench workflow with preserved tab state

### Database Modes
- `DATABASE_URL` configured: uses Postgres/Supabase
- No `DATABASE_URL` or invalid config: runs with built-in in-memory relational engine

---

## Tech Stack

### Backend
- Node.js
- TypeScript
- Express
- PostgreSQL / Supabase JS client
- JWT authentication
- Zod validation
- Row-Level Security aware design patterns

### Frontend
- React 19
- Vite
- TypeScript
- Tailwind CSS
- Lucide icons

### Repository
- npm workspaces
- Monorepo structure

---

## Repository Structure

```text
.
├── .env.example                 # Environment variables template
├── README.md                    # Project documentation
├── package.json                 # Root workspace scripts
├── package-lock.json            # Lock file
├── implementation_plan.md       # Planning notes
├── EduCloud_SMS_Functional_Specification.md
├── EduCloud_SMS_Investor_Functional_Document.html
├── packages/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── app.ts
│   │   │   ├── config/
│   │   │   ├── db/
│   │   │   ├── middleware/
│   │   │   ├── repositories/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   ├── types/
│   │   │   └── utils/
│   │   ├── tests/
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── frontend/
│       ├── src/
│       ├── index.html
│       ├── package.json
│       ├── postcss.config.js
│       └── vite.config.ts
└──
```

---

## Prerequisites

Before running the project, ensure you have:

- Node.js 20+ or 22 LTS
- npm (comes with Node.js)
- A local terminal / command prompt
- Optional: Supabase project or PostgreSQL database for production-grade persistence

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/avisj/SMS2.git
cd SMS2
```

### 2. Install dependencies

```bash
npm install
```

This installs the workspace dependencies for both frontend and backend packages.

### 3. Create environment file

Copy the sample environment file:

```bash
cp .env.example .env
```

Then edit `.env` and configure values as needed.

Example:

```env
NODE_ENV=development
PORT=4000
JWT_SECRET=your-super-secret-key
DATABASE_URL=postgresql://user:password@host:5432/dbname
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
CORS_ORIGIN=http://localhost:5173
```

Notes:
- If `DATABASE_URL` is left blank or is a placeholder, the app falls back to its built-in in-memory relational engine.
- This makes the app usable for demos and development without provisioning a database.
- The default sample `.env.example` includes placeholder Supabase values for local config.

---

## Running the Project

### Start the backend API

```bash
npm run dev:backend
```

Backend runs at:

- http://localhost:4000
- Health check: http://localhost:4000/health

### Start the frontend app

Open a second terminal and run:

```bash
npm run dev:frontend
```

Frontend runs at:

- http://localhost:5173

### Run backend tests

```bash
npm run test:backend
```

### Production build

```bash
npm run build
```

This runs both backend and frontend builds.

---

## How the App Works

### Backend
The backend is an Express application assembled in `packages/backend/src/app.ts`. It exposes module-specific API routes under `/api/v1/*` such as:

- `/api/v1/auth`
- `/api/v1/schools`
- `/api/v1/users`
- `/api/v1/roles`
- `/api/v1/permissions`
- `/api/v1/people`
- `/api/v1/academics`
- `/api/v1/timetables`
- `/api/v1/attendance`
- `/api/v1/fees`
- `/api/v1/exams`
- `/api/v1/communication`
- `/api/v1/transport`
- `/api/v1/inventory`
- `/api/v1/assets`
- `/api/v1/library`
- `/api/v1/admissions`

The service layer coordinates business logic, while repository modules interact with the database layer.

### Frontend
The frontend bootstraps in `packages/frontend/src/main.tsx` and renders the app through `App.tsx`. It:

- checks for an active authenticated user
- shows a login screen when needed
- wraps signed-in users in a workspace provider
- renders the school management shell and modules

### Authentication flow
The login experience uses a school context + user ID + password login pattern. A typical login is:

- School ID: `DPA-DEL-001`
- User ID: `rajesh.sharma`
- Password: `password123`

The project includes quick personas for demo login.

---

## Demo Login Personas

The app includes quick test users for demonstration. Common examples:

| Persona | Username | School ID | Role / Scope |
| --- | --- | --- | --- |
| School A Director | `rajesh.sharma` | `DPA-DEL-001` | Director / Full school access |
| Branch Admin | `sunita.rao` | `DPA-DEL-001` | Branch admin |
| School B Director | `anita.desai` | `GWI-MUM-001` | Director for another school |
| Platform Admin | `superadmin` | varies | Higher-level platform access |

Default password for demo users:

```text
password123
```

---

## Working Modes and Database Behavior

### Production / Supabase / PostgreSQL mode
When valid database configuration is present:

- backend connects to PostgreSQL or Supabase service
- data persists between runs
- multi-tenant database design is active

### Offline / local demo mode
When the database is not configured:

- the app seeds an in-memory relational engine
- it continues to run and authenticate demo users
- it is suitable for local development and demonstrations

This allows you to run the project quickly without needing a live database.

---

## Security Model

SMS2 is designed around a tenant-safe access model:

- Authentication via JWT
- Authorization via role + permission + scope evaluation
- Cross-tenant queries blocked by verified tenant middleware
- Audit logging for security-relevant events
- Adaptive RBAC without hardcoded role assumptions

The platform is designed for multi-school SaaS deployment and is more architecture-oriented than a simple CRUD app.

---

## Common Commands

From the repo root:

```bash
npm install
npm run dev:backend
npm run dev:frontend
npm run build
npm run test:backend
npm run db:migrate
npm run db:seed
```

---

## Troubleshooting

### Port already in use
If the backend throws a port conflict:

```bash
# check what is using the port
lsof -i :4000
```

Then stop the existing process or change the port in `.env`.

### Database not connecting
If the app reports database issues:

- verify `DATABASE_URL` in `.env`
- ensure the DB is reachable from your environment
- confirm credentials and network access
- or remove the config to run in built-in in-memory mode

### Frontend does not load
Make sure:

- backend is running on port 4000
- frontend is started from the repo root or workspace folder
- no conflicting frontend dev server is already running

### CORS errors
Ensure `CORS_ORIGIN` in `.env` matches the frontend URL, usually:

```env
CORS_ORIGIN=http://localhost:5173
```

---

## Notes for Contributors

- Keep backend logic separated from frontend concerns
- Preserve tenant-aware authorization checks in all business flows
- Prefer database-driven role and permission configuration over hardcoded rules
- Validate API inputs and business rules before layer transitions

---

## License

This project is licensed under the MIT License.

---

## Summary

SMS2 is a full-stack school management SaaS starter with a modern interface, multi-tenant design, dynamic permission model, and flexible database support. It is built to help you explore a realistic multi-school administration platform and can run either against a PostgreSQL/Supabase backend or a local in-memory fallback for rapid testing.

If you are developing locally, the fastest route is:

```bash
npm install
cp .env.example .env
npm run dev:backend
npm run dev:frontend
```

Then open:

- http://localhost:5173

and sign in with the built-in demo persona credentials.
