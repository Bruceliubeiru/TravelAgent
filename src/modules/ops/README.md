# Ops Center P0

Ops Center is an optional plugin inside Trip GEO Growth OS.

It is independent from the existing Mini Program, travelGateway, travel-engine, catalog, purchase rules, and Trip web-view handoff.

## P0 flow

```text
create task -> pending -> callback -> dashboard
```

The current P0 implementation uses an in-memory store and `MockMoyuntengAdapter` through Device Gateway.

## Files

```text
src/modules/ops/
├── OpsCenter.js
├── api/OpsApi.js
├── admin/dashboard.html
├── admin/README.md
├── checks/README.md
└── repositories/OpsMemoryStore.js
```

## API contract

```text
POST /ops/tasks
GET /ops/tasks/:taskId
POST /ops/tasks/:taskId/run
POST /ops/tasks/:taskId/callback
GET /ops/dashboard
```

These routes are represented by `src/modules/ops/api/OpsApi.js`. They are not wired into any existing production gateway in P0.

## Storage

Prisma schema and migration are provided under:

```text
prisma/schema.prisma
prisma/migrations/20260621_ops_center_p0/migration.sql
```

## Admin

Static dashboard page:

```text
src/modules/ops/admin/dashboard.html
```

## Boundary

Ops Center may depend on Device Gateway. Core modules must not depend on Ops Center.
