# Ops Admin

This folder contains the P0 static dashboard page for Ops Center.

It is not connected to the existing Mini Program app and does not modify current business logic.

P0 API contract:

- `POST /ops/tasks`
- `GET /ops/tasks/:taskId`
- `POST /ops/tasks/:taskId/run`
- `POST /ops/tasks/:taskId/callback`
- `GET /ops/dashboard`
