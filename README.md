# donate-server

Backend API for the Donate project, built with [NestJS](https://nestjs.com/) and MongoDB (Mongoose). Handles users, institutions, campaigns, donations, payments, and the social/chat features consumed by the `app` mobile client. Background jobs (email, receipts, Stripe webhooks, push notifications) are offloaded to `donate-workers` via RabbitMQ — see `donate-infra/README.md` for the shared local infrastructure.

The entity-relationship model lives in [`entidades.md`](entidades.md) and [`docs/diagrama-entidade-relacionamento.md`](docs/diagrama-entidade-relacionamento.md).

## Project setup

```bash
$ npm install
$ cp .env.example .env
```

## Environment variables

The project reads sensitive configuration from environment variables.

Required variables:

```env
MONGODB_URI=mongodb://localhost:27017/donate-server
```

Optional variables:

```env
PORT=3000
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=120
AUTH_RATE_LIMIT_WINDOW_MS=60000
AUTH_RATE_LIMIT_MAX_REQUESTS=10
IDEMPOTENCY_TTL_MS=86400000
```

`RATE_LIMIT_*` controls the global per-client request limit. `AUTH_RATE_LIMIT_*`
applies a stricter limit to authentication routes.

For mutation requests that must not be duplicated, send an `Idempotency-Key`
header. Repeating the same key with the same method, route and body replays the
first response. Reusing the same key with a different body returns `409`.
Idempotency records are stored in MongoDB in the `idempotency_records`
collection, with a unique key per scope, method, route and idempotency key.
The scope defaults to the client IP, but callers can send
`X-Idempotency-Scope` when they need a stable shared scope across services.
`IDEMPOTENCY_TTL_MS` controls the `expiresAt` TTL used to clean old records.

External API integrations should sanitize logs with
`sanitizeExternalApiRequest` and `sanitizeExternalApiResponse` from
`src/common/sanitization`. These helpers redact credentials, tokens, document
numbers, payment card fields and sensitive headers before request/response data
is logged or persisted.

Account creation publishes an `email.send` job to RabbitMQ so
`donate-workers` can send the account confirmation email asynchronously.

If a required variable is missing, the application stops on startup with a clear error message.

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Resources

- [NestJS Documentation](https://docs.nestjs.com)
- [entidades.md](entidades.md) — full entity/field/relationship reference
- [docs/diagrama-entidade-relacionamento.md](docs/diagrama-entidade-relacionamento.md) — ER diagram and how to render it
