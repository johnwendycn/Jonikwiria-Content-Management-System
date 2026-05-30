<div align="center">

# 🛡️ Jonikwiria Content Management System

**A full-stack, enterprise-grade CMS with advanced Access Control, Role-Based Permissions, and an Immutable Audit Trail**

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)](https://expressjs.com)
[![Sequelize](https://img.shields.io/badge/Sequelize-6.x-52B0E7?logo=sequelize&logoColor=white)](https://sequelize.org)
[![React Native](https://img.shields.io/badge/React%20Native-0.74-61DAFB?logo=react&logoColor=white)](https://reactnative.dev)
[![Expo](https://img.shields.io/badge/Expo-51-000020?logo=expo&logoColor=white)](https://expo.dev)
[![SQLite](https://img.shields.io/badge/SQLite-Fallback-003B57?logo=sqlite&logoColor=white)](https://sqlite.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Production-4169E1?logo=postgresql&logoColor=white)](https://postgresql.org)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Architecture](#-architecture)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [API Reference](#-api-reference)
- [Access Control Model](#-access-control-model)
- [Audit Log System](#-audit-log-system)
- [Authentication](#-authentication)
- [Database](#-database)
- [Scripts](#-scripts)
- [Contributing](#-contributing)

---

## 🌐 Overview

Jonikwiria CMS is a production-ready content management and access control platform built for organizations that need fine-grained user management, hierarchical role systems, attribute-based permission policies (ABAC), and a tamper-proof audit trail.

The system enforces a **Deny-overrides-Allow** policy: explicit denials at any level (user, role, or parent role) always take precedence.

**Live URLs (local development):**

| Service | URL |
|---|---|
| Backend API | `http://localhost:5000/api` |
| Admin Dashboard (Web) | `http://localhost:8081` |
| API Health Check | `http://localhost:5000/api/health` |

---

## 🏗️ Architecture

```
JonikwiriaContentManagementSystem/
├── backend/                  # Express.js REST API (Node.js)
│   └── src/
│       ├── config/           # Database connection (PostgreSQL / SQLite fallback)
│       ├── models/           # Sequelize ORM models
│       ├── services/         # Business logic layer
│       ├── controllers/      # HTTP request handlers
│       ├── routes/           # Express route definitions
│       ├── middleware/       # Audit middleware, auth helpers
│       ├── app.js            # Express app factory
│       └── server.js         # DB sync, seeding, server bootstrap
│
└── frontend/                 # React Native + Expo (Web target)
    └── src/
        ├── components/       # AdminLayout — sidebar, navbar, routing
        └── screens/          # Feature screens (one per domain)
```

The backend follows a strict **Model → Service → Controller → Route** layered architecture. No business logic lives in controllers or routes.

---

## ✨ Features

### 👥 User Management
- Full CRUD with soft-delete and restore
- Password hashing with PBKDF2 + random salt (zero native dependencies)
- Account locking after 5 consecutive failed login attempts (15-minute lockout)
- Multi-factor authentication fields (MFA secret, backup codes)
- User preferences (language, timezone, theme)
- Security clearance levels, geo-restrictions, allowed IP lists

### 🔐 Access Control (RBAC + ABAC)
- **Role Types** — Hierarchical role classification (Super Admin → Admin → Member)
- **Roles** — Concrete role instances with parent-child inheritance
- **Action Types** — Semantic HTTP verb descriptors (Read, Create, Modify, Purge)
- **Resource Types** — Named resources with ownership and hierarchy flags
- **Permissions** — Action × Resource pairs with optional ABAC conditions (JSON)
- **User Roles** — Temporal role assignments (`valid_from` / `valid_until`)
- **Role Permissions** — Grant or Deny permissions per role with conditions
- **User Permissions** — Direct user-level overrides (Deny always wins)

### 🔒 Authentication & Sessions
- JWT-free stateless session tokens (SHA-256 hashed, stored server-side)
- Session revocation on logout and password reset
- Password reset via tokenized recovery flow
- Email verification tokens
- Login attempt audit trail

### 🛡️ Immutable Audit Logs
- Every API request automatically captured (action, actor, IP, status, duration)
- Sensitive data auto-redacted (passwords, tokens, salts)
- **Append-only** — enforced at Route, Controller, ORM, and Hook layers simultaneously
- Stats endpoint: severity counts, event type breakdown, top actors
- No user — including Super Admin — can delete or modify entries

### 📊 Admin Dashboard
- Dark-themed, responsive admin panel (AdminLTE-inspired)
- Collapsible sidebar with sub-menu support
- Top navbar with dropdown menus
- Real-time search, pagination, and bulk operations on every screen
- Glassmorphism auth screens (Login, Signup, Forgot/Reset Password)
- Session persistence via `localStorage`

---

## 🛠️ Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| **Runtime** | Node.js 18+ | LTS recommended |
| **API Framework** | Express 4.x | REST, CORS, JSON middleware |
| **ORM** | Sequelize 6.x | PostgreSQL (prod) / SQLite (dev) |
| **Database** | PostgreSQL / SQLite | Auto-detected via env vars |
| **Crypto** | Node built-in `crypto` | PBKDF2 password hashing — no bcrypt |
| **Frontend** | React Native 0.74 + Expo 51 | Web target via `expo start --web` |
| **Styling** | React Native StyleSheet | Inline + CSS overrides for web |
| **Process Manager** | nodemon | Hot reload in development |

---

## 📁 Project Structure

<details>
<summary><strong>Backend</strong></summary>

```
backend/src/
├── config/
│   └── database.js              # Sequelize connection (PG → SQLite fallback)
│
├── models/
│   ├── auditLog.js              # Immutable audit trail model
│   ├── user.js                  # User profiles (paranoid soft-delete)
│   ├── userStatusType.js        # Account lifecycle states
│   ├── roleType.js              # Role classifications
│   ├── role.js                  # Role instances (hierarchical)
│   ├── actionType.js            # HTTP verb descriptors
│   ├── resourceType.js          # Named system resources
│   ├── permission.js            # Action × Resource permission pairs
│   ├── userRole.js              # User ↔ Role mappings (temporal)
│   ├── rolePermission.js        # Role ↔ Permission grants/denials
│   ├── userPermission.js        # Direct user permission overrides
│   ├── session.js               # Active session tokens
│   ├── passwordReset.js         # Password reset tokens
│   ├── emailVerification.js     # Email verification tokens
│   └── loginAttempt.js          # Login attempt audit records
│
├── services/
│   ├── auditService.js          # Core audit logging service
│   ├── auditLogService.js       # Audit log query & stats service
│   ├── authService.js           # Authentication business logic
│   ├── userService.js           # User CRUD, bulk ops, restore
│   ├── userStatusTypeService.js
│   ├── roleTypeService.js
│   ├── roleService.js
│   ├── actionTypeService.js
│   ├── resourceTypeService.js
│   ├── permissionService.js
│   ├── userRoleService.js
│   ├── rolePermissionService.js
│   └── userPermissionService.js
│
├── controllers/                 # Thin HTTP handlers — delegate to services
├── routes/                      # Express routers — one file per resource
├── middleware/
│   └── auditMiddleware.js       # Auto-capture every request/response
│
├── app.js                       # Express app (middleware + route mounting)
└── server.js                    # DB sync, associations, seeding, listen
```

</details>

<details>
<summary><strong>Frontend</strong></summary>

```
frontend/src/
├── components/
│   └── AdminLayout.js           # Shell: sidebar, navbar, content area
│
└── screens/
    ├── LoginScreen.js
    ├── SignupScreen.js
    ├── ForgotPasswordScreen.js
    ├── ResetPasswordScreen.js
    ├── AuditLogsScreen.js       # Immutable audit trail viewer
    ├── UsersScreen.js
    ├── UserStatusTypesScreen.js
    ├── RoleTypesScreen.js
    ├── RolesScreen.js
    ├── ActionTypesScreen.js
    ├── ResourceTypesScreen.js
    ├── PermissionsScreen.js
    ├── UserRolesScreen.js
    ├── RolePermissionsScreen.js
    └── UserPermissionsScreen.js
```

</details>

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) v18 or later
- npm v9 or later
- (Optional) PostgreSQL 14+ for production use

### 1. Clone the repository

```bash
git clone https://github.com/your-org/jonikwiria-cms.git
cd jonikwiria-cms
```

### 2. Configure the backend

```bash
cd backend
cp .env.example .env
# Edit .env — leave DB_* variables commented to use SQLite (zero setup)
```

### 3. Install backend dependencies and start

```bash
# From the backend/ directory
npm install
npm run dev
```

The server will:
1. Connect to the database (SQLite by default)
2. Synchronize all table schemas automatically
3. Seed initial data (statuses, role types, roles, users, permissions)
4. Start listening on `http://localhost:5000`

### 4. Install frontend dependencies and start

```bash
# In a new terminal, from the frontend/ directory
cd ../frontend
npm install
npm run web
```

Open `http://localhost:8081` in your browser.

### 5. Login with default credentials

> ⚠️ **Important:** The seeded users have a placeholder password hash. Use the **Sign Up** screen to create a real account with a proper password, or use the API directly to update the hash.

| Role | Email |
|---|---|
| Root Administrator | `root-administrator@system.local` |
| Staff Moderator | `staff-moderator@system.local` |

---

## 🔧 Environment Variables

Copy `backend/.env.example` to `backend/.env` and configure:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5000` | Express server port |
| `NODE_ENV` | `development` | Runtime environment |
| `DB_HOST` | — | PostgreSQL host (omit for SQLite) |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | — | Database name |
| `DB_USER` | — | Database user |
| `DB_PASS` | — | Database password |
| `DB_SSL` | `false` | Enable SSL for PostgreSQL |
| `DATABASE_URL` | — | PostgreSQL connection URL (alternative) |

> If no `DB_*` or `DATABASE_URL` variables are set, the server automatically uses a local **SQLite** file at `backend/database.sqlite`.

---

## 📡 API Reference

All endpoints are prefixed with `/api`.

### Authentication (`/api/auth`)

| Method | Path | Description |
|---|---|---|
| `POST` | `/auth/signup` | Register a new account |
| `POST` | `/auth/login` | Authenticate and receive session token |
| `POST` | `/auth/logout` | Revoke the current session token |
| `POST` | `/auth/forgot-password` | Generate a password reset token |
| `POST` | `/auth/reset-password` | Reset password using token |
| `GET` | `/auth/session` | Validate the current session token |

### Users (`/api/users`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/users` | List users (paginated, searchable) |
| `GET` | `/users/:id` | Get user by ID |
| `POST` | `/users` | Create user |
| `PUT` | `/users/:id` | Update user |
| `DELETE` | `/users/:id` | Soft-delete user |
| `POST` | `/users/:id/restore` | Restore soft-deleted user |
| `POST` | `/users/bulk-delete` | Bulk soft-delete |

### Access Control

| Resource | Base Path |
|---|---|
| User Status Types | `/api/user-status-types` |
| Role Types | `/api/role-types` |
| Action Types | `/api/action-types` |
| Resource Types | `/api/resource-types` |
| Permissions | `/api/permissions` |
| Roles | `/api/roles` |
| User Roles | `/api/user-roles` |
| Role Permissions | `/api/role-permissions` |
| User Permissions | `/api/user-permissions` |

All access control endpoints support `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id`.

### Audit Logs (`/api/audit-logs`) — Read Only

| Method | Path | Description |
|---|---|---|
| `GET` | `/audit-logs` | Paginated, filterable audit log list |
| `GET` | `/audit-logs/stats` | Summary counts by severity and event type |
| `GET` | `/audit-logs/:id` | Full detail for a single entry |
| `POST/PUT/PATCH/DELETE` | `/audit-logs/*` | **→ 405 Method Not Allowed** |

#### Audit Log Query Parameters

| Parameter | Type | Description |
|---|---|---|
| `page` | integer | Page number (default: 1) |
| `limit` | integer | Items per page (max: 100, default: 25) |
| `event_type` | string | `AUTH`, `USER`, `ROLE`, `PERMISSION`, `ACCESS_CONTROL`, `SYSTEM`, `DATA` |
| `severity` | string | `DEBUG`, `INFO`, `WARN`, `ERROR`, `CRITICAL` |
| `actor_email` | string | Filter by actor email (partial match) |
| `resource_type` | string | Filter by resource table name |
| `action` | string | Filter by action descriptor (partial match) |
| `success` | boolean | `true` or `false` |
| `date_from` | ISO date | Start of date range |
| `date_to` | ISO date | End of date range |
| `search` | string | Full-text search across action, actor, IP, path |
| `sortBy` | string | Field to sort by (default: `created_at`) |
| `sortOrder` | string | `ASC` or `DESC` (default: `DESC`) |

### Health Check

```http
GET /api/health
```

```json
{ "success": true, "status": "healthy", "timestamp": "2026-05-30T19:00:00.000Z" }
```

---

## 🔑 Access Control Model

The system implements a hybrid **RBAC + ABAC** policy engine:

```
User
 ├── has many UserRoles (temporal: valid_from / valid_until)
 │    └── Role
 │         ├── belongs to RoleType (Super Admin, Admin, Member, etc.)
 │         ├── has parent Role (inheritance chain)
 │         └── has many RolePermissions
 │              └── Permission (ActionType × ResourceType)
 │                   └── optional ABAC conditions (JSON)
 └── has many UserPermissions (direct overrides)
      └── Permission (Allow OR Deny)
```

### Permission Resolution Order (Deny Wins)

1. **UserPermission `is_allowed = false`** → **DENIED** (highest priority)
2. **RolePermission `is_allowed = false`** on any assigned role → **DENIED**
3. **UserPermission `is_allowed = true`** → ALLOWED
4. **RolePermission `is_allowed = true`** → ALLOWED (traverses parent roles)
5. No matching permission → **DENIED** (default deny)

---

## 🛡️ Audit Log System

The audit log is **fully immutable** — enforced at four independent layers:

| Layer | Mechanism |
|---|---|
| **HTTP Route** | `POST/PUT/PATCH/DELETE /api/audit-logs` → `405 Method Not Allowed` |
| **Controller** | Explicit `blockMutation()` handler |
| **ORM** | Sequelize `prototype.update`, `prototype.destroy`, and static variants overridden to `throw` |
| **Hooks** | `beforeUpdate`, `beforeDestroy`, `beforeBulkUpdate`, `beforeBulkDestroy` hooks all throw |

### What is captured automatically

Every API request is intercepted by `auditMiddleware.js`:

- **Actor**: user ID, email, display name, IP address, browser user agent, session ID
- **Event**: semantic action label (`session.login`, `user.create`, `role.assign`)
- **HTTP context**: method, path, status code, response time (ms)
- **Request body snapshot** — with sensitive fields **auto-redacted**: `password`, `password_hash`, `token`, `salt`, `mfa_secret`, `newPassword`
- **Success/failure flag** + error message on failures

---

## 🔐 Authentication

Passwords are hashed using **Node.js built-in `crypto.pbkdf2Sync`** with:
- Algorithm: SHA-512
- Iterations: 1,000
- Key length: 64 bytes
- Salt: 16 random bytes (unique per user)

This requires **zero native dependencies** (no `bcrypt` compilation) making it fully compatible with Windows development environments.

Session tokens are:
- Generated as 40 cryptographically random bytes (`crypto.randomBytes`)
- SHA-256 hashed before storage (`crypto.createHash('sha256')`)
- Valid for **7 days** from creation
- Revoked immediately on logout or password reset

---

## 🗄️ Database

### Automatic Fallback

The backend attempts to connect to PostgreSQL using environment variables. If none are set, it automatically falls back to a local **SQLite** file (`backend/database.sqlite`).

```javascript
// config/database.js — auto-detection logic
if (process.env.DB_HOST || process.env.DATABASE_URL) {
  // → Connect to PostgreSQL
} else {
  // → Use SQLite (development default)
}
```

### Schema Synchronization

On every startup, Sequelize runs `sequelize.sync({ force: false })` which:
- Creates any missing tables
- Does **not** drop or modify existing tables

For production schema migrations, use [Sequelize Migrations](https://sequelize.org/docs/v6/other-topics/migrations/).

### Seeded Data

On first run (empty database), the server seeds:
- 5 User Status Types (Active, Pending, Suspended, Banned, Maintenance Lock)
- 4 Role Types (Super Admin, Admin, Content Manager, Standard Subscriber)
- 4 Action Types (Read, Create, Modify, Purge)
- 3 Resource Types (User Accounts, System Logs, Page Documents)
- 3 Permissions with ABAC conditions
- 3 Roles (Superuser, Staff Admin, General Member)
- 2 Users (Root Administrator, Staff Moderator)
- Role + permission assignments

---

## 📜 Scripts

### Backend

```bash
cd backend

npm run dev      # Start with nodemon (hot reload)
npm start        # Start for production
```

### Frontend

```bash
cd frontend

npm run web      # Start Expo for web (http://localhost:8081)
npm start        # Start Expo dev server (interactive)
npm run android  # Start for Android emulator
npm run ios      # Start for iOS simulator
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Make your changes following the Model → Service → Controller → Route pattern
4. Test all affected API endpoints
5. Submit a pull request with a clear description of the changes

### Code Style Guidelines

- Use `async/await` — no raw Promise chains
- All business logic belongs in `services/`, not `controllers/`
- Audit log calls should be fire-and-forget (never `await` in hot paths)
- Never expose passwords, tokens, or salts in API responses
- All new models should define proper indexes and Sequelize associations in `server.js`

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">

Built with ❤️ by the Jonikwiria Engineering Team

</div>
