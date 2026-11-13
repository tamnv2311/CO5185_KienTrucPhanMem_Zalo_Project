# ZaloLite

Monorepo for the CO5185 software architecture course project: a Zalo-like chat system built as
microservices (Spring Boot, Java 25) with a React web client.

## Architecture

```
Web client ──► API gateway :8080 ──► user-service        :8081  MySQL
   (nginx :80)   JWT, routing,       group-service       :8082  MySQL
                 rate limit          chat-service        :8083  MongoDB + Redis, WebSocket/STOMP
                                     media-service       :8084  MongoDB metadata + file storage
                                     statistics-service  :8085  MySQL (daily aggregates)

            RabbitMQ topic exchange "zalolite.events"
            user/group/chat/media publish  ──►  chat-service, statistics-service consume
```

- `libs/common-core` – response envelope, `BusinessException`, shared exception handler.
- `libs/common-security` – `JwtService` (sign/verify), used by gateway, user and chat services.
- `libs/common-events` – event names and the best-effort `EventPublisher`.
- The gateway verifies the access token and forwards the caller as `X-User-Id`; a client-supplied
  `X-User-Id` is dropped. Services are not published outside the Docker network.
- Each service owns its database. Other services learn about changes through events
  (e.g. group membership is mirrored into the group conversation of chat-service).

## Run

Only Docker is needed; the backend is compiled inside Docker (the first build takes a few minutes).

```powershell
docker compose up -d --build
```

`mvn clean verify` is only for running the tests locally (Java 25).

Web client: http://localhost · API gateway: http://localhost:8080 · RabbitMQ UI: http://localhost:15672

End-to-end test through the gateway (Node 22+, no dependencies):

```powershell
node tests/e2e/smoke.spec.js
```

Frontend development: `cd frontend`, `npm install`, `npm run dev`.

## Deploy to a cloud server

One Linux VM with Docker is enough (4 GB RAM or more). Secrets come from `.env`, images are built
inside Docker and Caddy provides HTTPS. Step by step: [docs/deploy-cloud.md](docs/deploy-cloud.md).

```bash
cp .env.example .env   # fill in the secrets
docker compose -f docker-compose.prod.yml up -d --build
```

## API overview

All routes go through the gateway and need `Authorization: Bearer <accessToken>` except
`/api/auth/*` and `GET /api/media/{id}/content`. Responses use `{ success, data, message }`
(statistics endpoints return plain JSON).

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/register`, `login` (e-mail or phone), `refresh` (rotation), `logout` |
| Users | `GET/PUT /api/users/me`, `PUT /api/users/me/password`, `GET /api/users/search?q=`, `GET /api/users/{id}`, `GET /api/users?ids=` |
| Friends | `POST /api/friends/requests`, `POST /api/friends/requests/{id}/accept\|reject\|cancel`, `GET /api/friends`, `GET /api/friends/requests/pending\|sent`, `DELETE /api/friends/{userId}`, `POST\|DELETE /api/friends/{userId}/block`, `GET /api/friends/blocked` |
| Groups | `POST/GET /api/groups`, `GET/PUT/DELETE /api/groups/{id}`, `POST /api/groups/{id}/members`, `DELETE /api/groups/{id}/members/{userId}`, `PUT /api/groups/{id}/members/{userId}/role`, `POST /api/groups/{id}/owner`, `POST /api/groups/{id}/leave` |
| Conversations | `GET /api/chat/conversations`, `POST .../direct?peerId=`, `POST .../group?groupId=`, `GET .../{id}`, `PUT .../{id}/settings`, `POST .../{id}/read\|delivered`, `DELETE .../{id}`, `GET .../{id}/messages?limit&beforeSeq&afterSeq`, `GET .../{id}/messages/search?q=`, `GET .../{id}/pins` |
| Messages | `POST /api/chat/messages`, `POST .../{id}/recall`, `DELETE .../{id}`, `POST .../{id}/reactions`, `POST .../{id}/forward`, `PUT .../{id}/pin` |
| Presence | `GET /api/chat/presence?ids=`, `GET /api/chat/presence/{userId}` |
| Media | `POST /api/media` (multipart `file`), `GET /api/media/{id}`, `GET /api/media/{id}/content`, `DELETE /api/media/{id}` |
| Statistics | `GET /api/stats/overview`, `history?days=`, `groups`, `users`, `media` |

A group conversation has the same id as its group; a direct conversation id is derived from both user ids.
Message types: `TEXT`, `IMAGE`, `VIDEO`, `FILE`, `STICKER` (and server-generated `SYSTEM`).

## WebSocket (STOMP)

Endpoint `/ws` (SockJS; raw WebSocket at `/ws/websocket`). The `CONNECT` frame carries
`Authorization: Bearer <accessToken>`.

| Client sends to | Payload |
|---|---|
| `/app/chat.send` | `{ conversationId, clientMsgId, content, type, attachments, replyToId, mentions }` |
| `/app/chat.typing` | `{ conversationId, typing }` |
| `/app/chat.seen`, `/app/chat.delivered` | `{ conversationId, seq }` or `{ messageId }` |

| Client subscribes to | Receives |
|---|---|
| `/topic/conversations/{id}` | new messages (plain message JSON) |
| `/topic/conversations/{id}/events` | `typing`, `receipt`, `message.updated`, `conversation.pins` |
| `/topic/users/{myUserId}` | `message.new`, `message.updated`, `message.failed`, `receipt`, `conversation.*`, `friend.*` |
| `/topic/presence` | online/offline changes |

Pushes are fanned out through Redis pub/sub so several chat-service instances can run side by side.

## Notes

- Schemas are created by Hibernate (`ddl-auto: update`); there are no Flyway migrations yet.
- Media is stored on a local volume behind the `StorageProvider` interface (a MinIO/S3 adapter can replace it).
- The compose file uses a development JWT secret and a 12-hour access token because the web client
  does not refresh tokens yet. Set `JWT_SECRET` and `JWT_ACCESS_TTL_MINUTES` for anything else.
