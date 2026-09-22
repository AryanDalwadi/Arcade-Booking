# Arcade web

React 19, Vite, and strict TypeScript client for the arcade platform.

## Run

From the repository root:

```bash
npm install
copy apps\web\.env.example apps\web\.env
npm run dev:web
```

The app uses `VITE_API_GATEWAY_URL` as its only backend origin. React Router
provides browser routes and the protected application shell. Redux Toolkit owns
authentication and the identity, catalog, and booking API state. The returned
JWT and identity (`id`, `displayName`, `email`, and `roles`) are persisted under
`arcade.auth.token` and `arcade.auth.user`.

Registration uses `email`, `password`, and `displayName`, then signs the new
user in. Users, user groups, machines, bookings, and dashboard totals come from
the gateway; no sandbox records are embedded in the client.

## Verify

```bash
npm run typecheck -w @arcade/web
npm test -w @arcade/web
npm run build -w @arcade/web
```
