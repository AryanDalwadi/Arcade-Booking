# Arcade Booking — Backend

Node.js + Express API with MSSQL, JWT auth, and stored procedure migrations.

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

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with nodemon |
| `npm start` | Production start |
| `npm run migrate` | Run SQL migrations |
