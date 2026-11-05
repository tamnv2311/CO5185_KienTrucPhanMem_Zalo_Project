# ZaloLite

Monorepo implementation for the CO5185 software architecture course project.

## Week 1-6 modules

- API gateway: JWT verification and service routing.
- User/Auth service: registration, login, refresh, profile and friendship.
- Group service: group creation, membership and role authorization.
- Chat service: direct conversation, WebSocket/STOMP, text messages, history,
  delivered/seen receipts, presence and Redis sequence/idempotency.
- React web client: authentication, profile placeholder and chat screen.

## Run locally

Build the backend modules:

```powershell
mvn clean verify
```

Start infrastructure and services:

```powershell
docker compose up -d --build
```

Frontend development:

```powershell
cd frontend
npm install
npm run dev
```