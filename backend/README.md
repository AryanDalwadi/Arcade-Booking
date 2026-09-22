# Arcade Booking — Backend

Node.js + Express API with PostgreSQL, JWT authentication, and tracked SQL migrations.

Part of the [Arcade-Booking](https://github.com/AryanDalwadi/Arcade-Booking) monorepo (`backend/` folder).

## Setup

```bash
npm install
copy .env.example .env
npm run migrate
npm run dev
```

API runs at `http://localhost:5000`.

## Environment

Copy `.env.example` to `.env` and configure database + JWT settings.

The database connection uses `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`,
`DB_NAME`, and `DB_SSL`. Keep real credentials in `.env`; it is ignored by Git.

Migrations run transactionally and are recorded in
`public.schema_migrations`. Never modify an applied migration—add a new
numbered SQL file instead.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with nodemon |
| `npm start` | Production start |
| `npm run migrate` | Run SQL migrations |
