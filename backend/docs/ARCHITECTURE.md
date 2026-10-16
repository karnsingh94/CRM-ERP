# AZZUNIQE CRM & ERP — Backend Architecture & Deployment Guide

## 1. Architectural Overview

AZZUNIQE CRM & ERP backend is structured with clean separation of concerns designed for high scalability, maintainability, and multi-tenant security.

### Layered Architecture

```
HTTP Request
     │
     ▼
[ src/app.js ]
     │  ├── Security Baseline Headers (nosniff, frameguard, etc.)
     │  ├── CORS (Configured origins from env)
     │  └── Body Parsers (JSON limit: 2MB)
     │
     ▼
[ src/routes/api.routes.js ] (Aggregator)
     │  ├── Audit Metadata Middleware (attaches req.meta)
     │  ├── system.routes.js      (/health, /db-status, /dashboard/stats, /access-catalog)
     │  ├── catalog.routes.js     (/services, /modules, /sub-modules)
     │  ├── company.routes.js     (/clients, /clients/:id/access)
     │  ├── department.routes.js  (/companies/:companyId/departments, /employees)
     │  └── audit.routes.js       (/audit-logs)
     │
     ▼
[ src/controllers/ ] (Input Validation, Status Resolution, Response Formatting)
     │
     ▼
[ src/services/ ] (Business Rules, Transactions, Tenant & Access Isolation)
     │
     ▼
[ src/config/prisma.js ] (Prisma Client Singleton + BigInt serialization)
     │
     ▼
[ MySQL Database ]
```

---

## 2. Directory Structure

```text
backend/
├── prisma/
│   ├── schema.prisma                 # Database schema models & relationships
│   ├── migrations/                   # Additive migration history
│   └── seed.js                       # 7-Service catalog seeder
├── src/
│   ├── app.js                        # Express app initialization & middleware stack
│   ├── server.js                     # HTTP server entrypoint & graceful shutdown
│   ├── config/
│   │   ├── env.js                    # Validated environment configuration
│   │   └── prisma.js                 # PrismaClient singleton with BigInt serialization
│   ├── routes/
│   │   ├── api.routes.js             # Central router aggregator
│   │   ├── system.routes.js          # Health, stats, and catalog metadata
│   │   ├── catalog.routes.js         # Global service & module hierarchy routes
│   │   ├── company.routes.js         # Tenant company provisioning & access routes
│   │   ├── department.routes.js      # Service-based departments & staff routes
│   │   └── audit.routes.js           # Platform audit trail routes
│   ├── controllers/
│   │   ├── system.controller.js
│   │   ├── catalog.controller.js
│   │   ├── company.controller.js
│   │   ├── department.controller.js
│   │   └── audit.controller.js
│   ├── services/
│   │   ├── system.service.js
│   │   ├── catalog.service.js
│   │   ├── company.service.js
│   │   ├── department.service.js
│   │   └── audit.service.js
│   ├── middlewares/
│   │   ├── cors.middleware.js         # CORS & security baseline headers
│   │   ├── auditMeta.middleware.js    # Client IP & UserAgent extractor
│   │   ├── auth.middleware.js         # Tenant boundary & auth verification
│   │   ├── notFound.middleware.js     # Standard 404 handler
│   │   └── errorHandler.middleware.js # Centralized safe error handler
│   └── utils/
│       ├── formatters.js              # BigInt to string & model formatters
│       ├── hash.js                    # Password hashing utilities
│       └── logger.js                  # Structured, environment-aware logger
├── tests/
│   └── integration/
│       ├── suite.test.js              # Full platform automated test suite
│       └── departments.test.js        # Department & service-scoping test suite
├── scripts/
│   └── check-db.js                   # Database connectivity & diagnostic tool
├── docs/
│   └── ARCHITECTURE.md               # Architecture & deployment specification
├── .env.example                      # Production-ready environment template
├── package.json                      # Scripts & dependencies
└── package-lock.json
```

---

## 3. Security & Multi-Tenant Isolation

1. **Company Ownership Enforcement**:
   - Company IDs are strictly validated as BigInts.
   - Cross-company resource queries or mutations are rejected with `403 Forbidden` (`TENANT_ISOLATION_VIOLATION` or `CROSS_COMPANY_FORBIDDEN`).
2. **Service Assignment Verification**:
   - Creating or accessing departments within a service strictly checks `ClientServiceAccess`.
   - If Super Admin has not assigned that service to the company, API rejects request with `403 Forbidden` (`SERVICE_NOT_ASSIGNED`).
3. **Department Head Integrity**:
   - Department Heads must be active employees of the same tenant company.
4. **Credential Protection**:
   - Passwords are never returned in client API responses.
   - Passwords are encrypted using bcrypt (10 rounds).
   - `.env` is ignored by Git in both root and backend `.gitignore`.
   - Production error logs suppress internal stack traces to prevent info leakage.

---

## 4. Production Deployment Checklist

- [ ] **Environment Configuration**:
  - Configure `PORT` (e.g. 5000 or platform assigned).
  - Set `NODE_ENV=production`.
  - Set `LOG_LEVEL=info` or `warn`.
  - Set `DATABASE_URL` with production credentials and SSL params if required (`sslmode=require`).
  - Set `CLIENT_URL` and `ADDITIONAL_CORS_ORIGINS` to the exact frontend production domains.
- [ ] **Prisma & Database**:
  - Run `npm run prisma:generate` during build.
  - Apply migrations: `npm run prisma:migrate:deploy` (or `node node_modules/prisma/build/index.js migrate deploy`).
- [ ] **Process Management**:
  - Run behind reverse proxy (e.g., NGINX, Cloudflare) with HTTPS.
  - Utilize process supervisor (PM2, Docker, or Kubernetes).
  - The server automatically handles `SIGTERM` and `SIGINT` for graceful shutdown and closes DB connections.
- [ ] **Health Monitoring**:
  - Configure load balancer / uptime probe targeting `/api/health`.
  - Monitor database connectivity using `/api/db-status`.
