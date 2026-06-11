# Arcade Booking

Single repository with **backend** and **frontend** in separate folders.

```
Arcade-Booking/
├── backend/     ← Node.js + Express API
└── frontend/    ← React app
```

GitHub: [Arcade-Booking](https://github.com/AryanDalwadi/Arcade-Booking)

## Setup

```bash
# Backend
cd backend
npm install
copy .env.example .env
npm run migrate
npm run dev

# Frontend (new terminal)
cd frontend
npm install
copy .env.example .env
npm start
```

## Git — one repo, separate commits

All git commands run from the **project root** (`Arcade Booking/`).

**Backend only:**
```bash
git add backend/
git commit -m "backend: your message"
git push
```

**Frontend only:**
```bash
git add frontend/
git commit -m "frontend: your message"
git push
```

**Both:**
```bash
git add .
git commit -m "your message"
git push
```
