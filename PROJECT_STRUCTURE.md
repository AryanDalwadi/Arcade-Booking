# Arcade Booking Architecture and Project Structure

> **Target stack:** React + Vite + TypeScript, Node.js/Express microservices,
> PostgreSQL, Kafka, Redis, Docker, Kubernetes, GitHub Actions, and AWS.
>
> The original `backend/` and `frontend/` applications remain temporarily as
> migration references. New development belongs in `apps/`, `services/`,
> `packages/`, and `infra/`.

---

## Table of Contents

1. [Monorepo Layout](#1-monorepo-layout)
2. [Database Layer](#2-database-layer)
3. [Backend — Node.js / Express](#3-backend--nodejs--express)
4. [JWT Authentication](#4-jwt-authentication)
5. [Frontend — React + Vite (or CRA)](#5-frontend--react--vite-or-cra)
6. [Custom Component Library](#6-custom-component-library)
7. [Environment Variables](#7-environment-variables)
8. [Naming Conventions](#8-naming-conventions)
9. [Response Contracts](#9-response-contracts)
10. [Quick Checklist for a New Domain](#10-quick-checklist-for-a-new-domain)
11. [PostgreSQL Interview Guide](#11-postgresql-interview-guide)

---

## 1. Monorepo Layout

### 1.1 Target microservices layout

```text
project-root/
├── apps/
│   ├── web/                     # React + Vite + strict TypeScript
│   └── api-gateway/             # Authentication, routing, rate limits, correlation IDs
├── services/
│   ├── identity/                # Login, register, users, user groups/RBAC
│   ├── catalog/                 # Games, arcade machines, pricing
│   ├── booking/                 # Reservations, consistency, transactional outbox
│   ├── payment/                 # Idempotent payment orchestration
│   ├── inventory/               # Availability event consumer/projection
│   ├── notification/            # Email/SMS notification consumer
│   └── analytics/               # Reporting event consumer/projection
├── packages/
│   └── contracts/               # Versioned Zod API and Kafka event schemas
├── infra/
│   ├── docker/                  # Local integrated environment
│   ├── kubernetes/              # Deployments, Services, probes, Ingress, HPA
│   └── aws/                     # EKS/RDS/MSK/ElastiCache deployment starter
├── docs/                        # Milestone and interview learning guides
├── backend/                     # Legacy API retained during migration
└── frontend/                    # Legacy CRA client retained during migration
```

Each service owns its PostgreSQL database or schema. A service must never query
another service's tables; cross-domain communication uses a versioned HTTP API
or Kafka event. `booking-service` is the arcade-domain equivalent of an order
service.

### 1.2 Legacy modular-monolith layout

```
project-root/
├── backend/
│   ├── migrations/
│   │   ├── tables/              # DDL: 001_<table>.sql, 002_<table>.sql ...
│   │   ├── stored_procedures/   # PostgreSQL SQL functions (legacy folder name)
│   │   └── functions/           # Shared PostgreSQL functions
│   ├── scripts/
│   │   └── run-migrations.js    # Migration runner
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js            # PostgreSQL pool (connectPool / getPool / closePool)
│   │   │   └── env.js           # Typed env vars
│   │   ├── middleware/
│   │   │   ├── auth.middleware.js     # JWT Bearer verify → req.user
│   │   │   ├── validate.middleware.js # Joi schema validation
│   │   │   └── error.middleware.js    # AppError class + global error handler
│   │   ├── router/
│   │   │   ├── index.js         # Mounts all sub-routers under /api
│   │   │   ├── health.router.js
│   │   │   ├── auth.router.js
│   │   │   ├── user.router.js
│   │   │   └── userGroup.router.js
│   │   ├── controller/          # Thin: call service, return response helper
│   │   ├── service/             # Business logic, throws AppError
│   │   ├── data_access/         # Parameterized PostgreSQL queries via pool.query()
│   │   ├── validation/          # Joi schemas, one file per domain
│   │   ├── helper/
│   │   │   └── response.helper.js    # success / error / paginatedList
│   │   ├── utils/
│   │   │   ├── bcrypt.util.js
│   │   │   └── jwt.util.js
│   │   ├── logger/
│   │   │   └── logger.js
│   │   ├── app.js               # Express setup (helmet, cors, body-parser, router mount)
│   │   └── server.js            # connectPool → app.listen + graceful shutdown
│   ├── nodemon.json
│   ├── package.json
│   └── .env.example
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── api/
│   │   │   └── axios.js         # Axios instance + Bearer interceptor
│   │   ├── assets/
│   │   ├── components/          # Shared / reusable UI components
│   │   │   ├── index.js         # Barrel export for all components
│   │   │   ├── common/
│   │   │   │   ├── CustomButton.jsx
│   │   │   │   └── PageHeader.jsx
│   │   │   ├── dialog/
│   │   │   │   └── CustomDialog.jsx
│   │   │   ├── list/
│   │   │   │   └── CardList.jsx
│   │   │   └── form/
│   │   │       ├── TextField.jsx
│   │   │       ├── AllDropdown.jsx
│   │   │       ├── AutoDropdown.jsx
│   │   │       ├── DatePickerField.jsx
│   │   │       ├── TimePickerField.jsx
│   │   │       ├── DateTimePickerField.jsx
│   │   │       └── DateMonthYearPicker.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   ├── features/            # One folder per domain
│   │   │   ├── users/
│   │   │   │   ├── userSlice.js
│   │   │   │   ├── userService.js
│   │   │   │   ├── userSelectors.js
│   │   │   │   └── user.types.js
│   │   │   └── userGroups/
│   │   │       ├── userGroupSlice.js
│   │   │       ├── userGroupService.js
│   │   │       ├── userGroupSelectors.js
│   │   │       └── userGroup.types.js
│   │   ├── hooks/
│   │   │   └── useAuth.js
│   │   ├── layouts/
│   │   │   └── MainLayout.jsx
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── UserList.jsx
│   │   │   └── UserGroupList.jsx
│   │   ├── routes/
│   │   │   ├── AppRoutes.jsx
│   │   │   └── ProtectedRoute.jsx
│   │   ├── services/
│   │   │   └── authService.js   # Auth-specific API calls (login, register)
│   │   ├── store/
│   │   │   ├── index.js         # configureStore — registers all slice reducers
│   │   │   └── hooks.js         # useAppDispatch / useAppSelector
│   │   ├── theme/
│   │   │   └── theme.js         # MUI / Ant Design theme overrides
│   │   ├── utils/
│   │   │   └── storage.js       # localStorage helpers
│   │   ├── App.js
│   │   └── index.js
│   ├── package.json
│   └── .env.example
│
├── .gitignore
├── PROJECT_STRUCTURE.md
└── README.md
```

---

## 2. Database Layer

### 2.1 Standard Audit Columns (every table must have these)

```sql
created_at  TIMESTAMP NOT NULL DEFAULT dbo.get_date()
created_by  INTEGER NULL
updated_at  TIMESTAMP NULL
updated_by  INTEGER NULL
```

- Set `created_at` and `created_by` on `INSERT`.
- Set `updated_at` and `updated_by` on `UPDATE`.
- Never expose `password_hash` in any SELECT result set.
- PostgreSQL `TIMESTAMP` is used because `dbo.get_date()` returns India-local wall-clock time. For a globally distributed production system, prefer `TIMESTAMPTZ` stored in UTC.

### 2.2 Table Migration Convention

```sql
-- migrations/tables/NNN_<table_name>.sql
CREATE TABLE IF NOT EXISTS dbo.<table> (
  id          INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  -- ... domain columns ...
  created_at  TIMESTAMP NOT NULL DEFAULT dbo.get_date(),
  created_by  INTEGER NULL,
  updated_at  TIMESTAMP NULL,
  updated_by  INTEGER NULL
);
```

> For tables that need a GUID primary key (e.g. `user_groups`), use:
> `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` and enable `pgcrypto`.

### 2.3 Pagination Query Pattern

PostgreSQL uses parameterized queries and SQL functions rather than MSSQL-style stored procedures with multiple result sets. Run one count query and one paginated data query. Both use the same filters.

```sql
-- $1 = filter, $2 = page_size, $3 = current_page
SELECT count(1)::INTEGER AS total_count
FROM dbo.<table>
WHERE ($1 = '' OR col ILIKE '%' || $1 || '%');

  SELECT
  row_number() OVER (ORDER BY created_at DESC, id DESC) AS sr_no,
  t.*
FROM dbo.<table> t
WHERE ($1 = '' OR col ILIKE '%' || $1 || '%')
ORDER BY created_at DESC, id DESC
LIMIT $2 OFFSET ($3 - 1) * $2;
```

### 2.4 Shared DB Functions (create once, reuse everywhere)

| Function                              | Return      | Purpose                                |
| ------------------------------------- | ----------- | -------------------------------------- |
| `dbo.get_date()`                      | `TIMESTAMP` | India-local current datetime           |
| `dbo.get_datetime_without_second(dt)` | `TIMESTAMP` | Truncated datetime, no seconds         |
| `dbo.get_fromated_date(dt)`           | `VARCHAR`   | Formatted date display string          |
| `dbo.get_fromated_datetime(dt)`       | `VARCHAR`   | Formatted datetime display string      |
| `dbo.get_user_name(id)`               | `VARCHAR`   | Lookup display name from `users` table |

### 2.5 Tracked Migrations

`scripts/run-migrations.js` creates `public.schema_migrations`. Each migration runs in a transaction and records its filename, SHA-256 checksum, and application time. Applied migrations are skipped. Modifying an already-applied migration causes an error; add a new numbered migration instead.

---

## 3. Backend — Node.js / Express

### 3.1 Packages

```json
{
  "dependencies": {
    "express": "^5.x",
    "pg": "^8.x",
    "bcrypt": "^6.x",
    "jsonwebtoken": "^9.x",
    "joi": "^18.x",
    "cors": "^2.x",
    "helmet": "^8.x",
    "dotenv": "^17.x"
  },
  "devDependencies": {
    "nodemon": "^3.x"
  }
}
```

### 3.2 Entry Points

**`src/server.js`** — DB connect → listen → graceful shutdown on SIGINT/SIGTERM

**`src/app.js`** — Express middlewares → mount `/api` router

```js
// app.js
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api", router);
app.use(notFoundHandler);
app.use(errorHandler);
```

### 3.3 DB Connection (`src/config/db.js`)

Exposes a singleton PostgreSQL `pg.Pool`.

| Export          | Purpose                                              |
| --------------- | ---------------------------------------------------- |
| `connectPool()` | Initialises the pool and verifies it with `SELECT 1` |
| `getPool()`     | Returns pool or throws if disconnected               |
| `isConnected()` | Boolean health check                                 |
| `closePool()`   | Graceful shutdown                                    |

PostgreSQL uses host, port, database, user, and password credentials. Local development normally sets `DB_SSL=false`; managed production databases should use TLS.

### 3.4 Layer Flow

```
HTTP Request
  └─► router/index.js            ← mounts sub-routers at /api
        └─► *.router.js          ← authenticate → validate(schema) → controller.fn
              └─► controller/    ← call service, send response via helper
                    └─► service/ ← business logic, throws AppError
                          └─► data_access/  ← parameterized pool.query(text, values)
```

### 3.5 Router (`src/router/*.router.js`)

```js
// Always: authenticate middleware first, then Joi validate, then controller
router.post("/get", authenticate, validate(getSchema), controller.getItems);
router.post(
  "/create",
  authenticate,
  validate(createSchema),
  controller.createItem,
);
router.post(
  "/update",
  authenticate,
  validate(updateSchema),
  controller.updateItem,
);
```

> All list/filter/mutate endpoints use **POST** so complex filter objects travel in the request body.

### 3.6 Controller (thin — no business logic)

```js
const getItems = async (req, res, next) => {
  try {
    const result = await itemService.getItems(req.body);
    return response.paginatedList(res, {
      summary: result.summary,
      data: result.data,
    });
  } catch (error) {
    next(error);
  }
};
```

### 3.7 Service (business logic layer)

```js
const getItems = async (filters) => {
  return itemDa.getItems({
    name: filters.name || "",
    pageSize: filters.page_size,
    currentPage: filters.current_page,
  });
};

// Throw AppError for known domain errors
const updateItem = async (id, payload) => {
  const existing = await itemDa.findById(id);
  if (!existing) throw new AppError("Item not found", 404);
  return itemDa.updateItem({ id, ...payload });
};
```

### 3.8 Data Access (all PostgreSQL calls here)

```js
// Always use $1, $2... placeholders. Never concatenate user input into SQL.
const getItems = async ({ name = "", pageSize = 20, currentPage = 1 }) => {
  const pool = getPool();
  const offset = (currentPage - 1) * pageSize;

  const [countResult, dataResult] = await Promise.all([
    pool.query(
      `SELECT count(1)::INTEGER AS total_count
       FROM dbo.items
       WHERE ($1 = '' OR name ILIKE '%' || $1 || '%')`,
      [name],
    ),
    pool.query(
      `SELECT *
       FROM dbo.items
       WHERE ($1 = '' OR name ILIKE '%' || $1 || '%')
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [name, pageSize, offset],
    ),
  ]);

  const totalCount = countResult.rows[0].total_count;
  const totalPage = Math.ceil(totalCount / pageSize);

  return {
    summary: {
      current_page: currentPage,
      total_count: totalCount,
      has_more: currentPage < totalPage,
      page_size: pageSize,
      total_page: totalPage,
    },
    data: dataResult.rows,
  };
};

// PostgreSQL RETURNING avoids a second lookup query.
const createItem = async ({ name, createdBy = null }) => {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO dbo.items (name, created_by)
     VALUES ($1, $2)
     RETURNING id, name, created_at, created_by`,
    [name, createdBy],
  );
  return result.rows[0];
};
```

### 3.9 Validation (`src/validation/*.validation.js`)

```js
const Joi = require("joi");

const getItemsSchema = Joi.object({
  name: Joi.string().trim().max(100).allow("").default(""),
  page_size: Joi.number().integer().min(1).max(100).default(20),
  current_page: Joi.number().integer().min(1).default(1),
});

const updateItemSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
  name: Joi.string().trim().min(2).max(100),
}).or("name"); // at least one updatable field required
```

### 3.10 Response Helper (`src/helper/response.helper.js`)

```js
// 200 — single object
response.success(res, data, "Message");

// 200 — paginated list
response.paginatedList(res, { summary, data });
// Sends: { current_page, total_count, has_more, page_size, total_page, data[] }

// Error
response.error(res, "Message", 404);
```

### 3.11 AppError & Global Handler

```js
// Throw anywhere in service or DA layer:
throw new AppError("Email already registered", 409);

// AppError is caught by errorHandler middleware → JSON response automatically
// No try/catch needed in controllers beyond calling next(error)
```

---

## 4. JWT Authentication

JWT is used as the sole authentication mechanism. Tokens are short-lived, stateless, and travel as `Authorization: Bearer <token>` headers on every protected request.

### 4.1 Full Auth Flow

```
BACKEND                                          FRONTEND
──────────────────────────────────────────────────────────────────────
POST /api/auth/login                             Login.jsx
  validate(loginSchema)                            useAuth().login(credentials)
    authController.login                             authService.login → axios.post
      authService.login                                response.data → { token, user }
        userDa.findByLogin  (parameterized PostgreSQL)    setToken / setUser → localStorage
        bcrypt.compare                                   AuthContext state updated
        jwt.sign → token                                 navigate('/')
        return { user, token }
      response.success(res, { user, token })

Protected route request
  Axios interceptor attaches → Authorization: Bearer <token>
    auth.middleware.js
      jwt.verify(token) → decoded { id, email }
        req.user = decoded
          next()  → controller runs normally
```

### 4.2 Backend — `src/utils/jwt.util.js`

```js
const { env } = require("../config/env");
const jwt = require("jsonwebtoken");

// Sign — used in auth.service.js after login/register
const signToken = (payload) =>
  jwt.sign(payload, env.JWT.secret, { expiresIn: env.JWT.expiresIn });

// Verify — used in auth.middleware.js on every protected request
const verifyToken = (token) => jwt.verify(token, env.JWT.secret); // throws JsonWebTokenError / TokenExpiredError

module.exports = { signToken, verifyToken };
```

**Payload shape stored in the token:**

```json
{ "id": 1, "email": "user@example.com" }
```

> Never put sensitive fields (password, roles, full user object) in the JWT payload.

### 4.3 Backend — `src/utils/bcrypt.util.js`

```js
const SALT_ROUNDS = 10;

const hashPassword = (password) => bcrypt.hash(password, SALT_ROUNDS);
const comparePassword = (plain, hash) => bcrypt.compare(plain, hash);
```

Always hash on register, compare on login. Never store or return plain passwords.

### 4.4 Backend — Auth Routes (`src/router/auth.router.js`)

Auth routes are **public** — they do NOT use the `authenticate` middleware.

```js
// No authenticate here — these are the endpoints that issue the token
router.post("/register", validate(registerSchema), authController.register);
router.post("/login", validate(loginSchema), authController.login);
```

### 4.5 Backend — Auth Validation Schemas

```js
const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().trim().email().required(),
  password: Joi.string().min(6).max(128).required(),
});

const loginSchema = Joi.object({
  login: Joi.string().trim().min(1).max(255).required(), // accepts email or username
  password: Joi.string().required(),
});
```

### 4.6 Backend — Auth Service (`src/service/auth.service.js`)

```js
// Register
const register = async ({ name, email, password }) => {
  const existing = await userDa.findByEmail(email);
  if (existing) throw new AppError("Email is already registered", 409);

  const passwordHash = await hashPassword(password);
  const user = await userDa.createUser({ name, email, passwordHash });
  const token = signToken({ id: user.id, email: user.email });

  return { user: { id: user.id, name: user.name, email: user.email }, token };
};

// Login
const login = async ({ login, password }) => {
  const user = await userDa.findByLogin(login); // matches email OR username
  if (!user) throw new AppError("Invalid username, email or password", 401);

  const isMatch = await comparePassword(password, user.password_hash);
  if (!isMatch) throw new AppError("Invalid username, email or password", 401);

  const token = signToken({ id: user.id, email: user.email });
  return { user: { id: user.id, name: user.name, email: user.email }, token };
};
```

> Use the same generic error message for both "user not found" and "wrong password" to avoid user-enumeration attacks.

### 4.7 Backend — Auth Middleware (`src/middleware/auth.middleware.js`)

Applied to every protected router — placed **before** the validate middleware.

```js
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return response.error(res, "Access token is required", 401);
  }

  const token = authHeader.split(" ")[1];

  try {
    req.user = verifyToken(token); // { id, email, iat, exp }
    next();
  } catch {
    return response.error(res, "Invalid or expired token", 401);
  }
};
```

After this middleware runs, downstream controllers can read `req.user.id` to know who made the request (used for `updated_by` / `created_by` audit columns).

### 4.8 Frontend — Token Storage (`src/utils/storage.js`)

Token and user object are persisted in `localStorage` so they survive page refreshes.

```js
const TOKEN_KEY = "token";
const USER_KEY = "user";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export const getUser = () => {
  const u = localStorage.getItem(USER_KEY);
  return u ? JSON.parse(u) : null;
};
export const setUser = (user) =>
  localStorage.setItem(USER_KEY, JSON.stringify(user));
export const clearUser = () => localStorage.removeItem(USER_KEY);

export const clearAuth = () => {
  clearToken();
  clearUser();
};
```

### 4.9 Frontend — `AuthContext` (`src/context/AuthContext.jsx`)

Wraps the entire app. Provides `token`, `user`, `isAuthenticated`, `login()`, `logout()`.

```jsx
export const AuthProvider = ({ children }) => {
  // Seed state from localStorage on first render
  const [token, setTokenState] = useState(getToken());
  const [user, setUserState] = useState(getUser());

  const login = useCallback(async (credentials) => {
    const response = await authService.login(credentials);
    if (!response.success) throw new Error(response.message || "Login failed");

    const { token: authToken, user: authUser } = response.data;
    setToken(authToken); // persist
    setUser(authUser);
    setTokenState(authToken); // react state → triggers re-render
    setUserState(authUser);
    return authUser;
  }, []);

  const logout = useCallback(() => {
    clearAuth(); // remove from localStorage
    setTokenState(null);
    setUserState(null);
  }, []);

  const value = useMemo(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token),
      login,
      logout,
    }),
    [token, user, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
```

### 4.10 Frontend — `useAuth` Hook (`src/hooks/useAuth.js`)

```js
const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
```

Use anywhere in the component tree:

```js
const { user, isAuthenticated, login, logout } = useAuth();
```

### 4.11 Frontend — Axios Request Interceptor

Defined in `src/api/axios.js` — the token is attached automatically so no component needs to handle it manually.

```js
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

> Optionally add a **response interceptor** to auto-logout on `401`:
>
> ```js
> api.interceptors.response.use(
>   (res) => res,
>   (error) => {
>     if (error.response?.status === 401) {
>       clearAuth();
>       window.location.href = "/login";
>     }
>     return Promise.reject(error);
>   },
> );
> ```

### 4.12 Frontend — `ProtectedRoute` (`src/routes/ProtectedRoute.jsx`)

Guards all routes that require authentication. Uses React Router's `<Outlet>` pattern.

```jsx
const ProtectedRoute = () => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};
```

Wrap any route group in `AppRoutes.jsx`:

```jsx
<Route element={<ProtectedRoute />}>
  <Route element={<MainLayout />}>
    <Route path="/" element={<Dashboard />} />
    <Route path="/users" element={<UserList />} />
    <Route path="/user-groups" element={<UserGroupList />} />
  </Route>
</Route>
```

### 4.13 Login Page Flow (`src/pages/Login.jsx`)

```jsx
const { login } = useAuth();

const handleSubmit = async (event) => {
  event.preventDefault();
  setLoading(true);
  try {
    await login({ login: loginId, password }); // calls AuthContext.login
    navigate("/");
  } catch (err) {
    setError(err.response?.data?.message || err.message || "Login failed");
  } finally {
    setLoading(false);
  }
};
```

### 4.14 Auth Security Rules

| Rule                                                                 | Reason                                   |
| -------------------------------------------------------------------- | ---------------------------------------- |
| Use the same error message for "user not found" and "wrong password" | Prevents user-enumeration                |
| Return `password_hash` only from internal authentication queries     | Prevents accidental exposure             |
| Never store sensitive data in JWT payload                            | Payload is base64-encoded, not encrypted |
| Set `JWT_EXPIRES_IN` to a short value in production (`1d` or less)   | Limits blast radius of a stolen token    |
| Always use `Bearer ` prefix check before splitting                   | Prevents crash on malformed header       |
| `req.user.id` used as `updated_by` / `created_by` in all mutations   | Full audit trail without extra queries   |

---

## 5. Frontend — React + Vite (or CRA)

> **UI Library options (choose one or mix both):**
>
> - **Material UI** (`@mui/material`) — default in this project
> - **Ant Design** (`antd`) — drop-in alternative; wrap app in `<ConfigProvider theme={...}>`

### 4.1 Packages

```json
{
  "dependencies": {
    "react": "^19.x",
    "react-dom": "^19.x",
    "react-router-dom": "^7.x",
    "axios": "^1.x",
    "@reduxjs/toolkit": "^2.x",
    "react-redux": "^9.x",
    "@mui/material": "^5.x",
    "@mui/icons-material": "^5.x",
    "@mui/x-date-pickers": "^6.x",
    "@emotion/react": "^11.x",
    "@emotion/styled": "^11.x",
    "dayjs": "^1.x"
  }
}
```

### 4.2 Axios Instance (`src/api/axios.js`)

Single configured instance — every feature service imports this, never raw `axios`.

```js
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
});

// Auto-attach JWT on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
```

### 4.3 Feature Folder Structure

One folder per domain under `src/features/<domain>/`:

```
features/users/
├── userSlice.js       ← Redux slice + createAsyncThunk actions
├── userService.js     ← Axios calls via the shared api instance
├── userSelectors.js   ← State selectors (memoised via useAppSelector)
└── user.types.js      ← JSDoc @typedef contracts (no runtime cost)
```

#### `userService.js` — Axios calls

```js
import api from "../../api/axios";

export const getUsers = (payload) =>
  api.post("/users/get", payload).then((r) => r.data);
export const createUser = (payload) =>
  api.post("/auth/register", payload).then((r) => r.data);
export const updateUser = (payload) =>
  api.post("/users/update", payload).then((r) => r.data);
```

#### `userSlice.js` — Redux Toolkit slice

```js
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import * as userService from "./userService";

const initialPagination = {
  current_page: 1,
  total_count: 0,
  has_more: false,
  page_size: 10,
  total_page: 0,
};

const initialState = {
  list: [],
  pagination: initialPagination,
  filters: { name: "", email: "" },
  listLoading: false,
  listError: null,
  submitLoading: false,
  submitError: null,
};

const getErrorMessage = (error) =>
  error.response?.data?.message || error.message || "Something went wrong";

// Thunks read current state so callers only pass overrides
export const fetchUsers = createAsyncThunk(
  "users/fetchUsers",
  async (query = {}, { getState, rejectWithValue }) => {
    try {
      const { users } = getState();
      return await userService.getUsers({
        name: query.name ?? users.filters.name,
        email: query.email ?? users.filters.email,
        page_size: query.page_size ?? users.pagination.page_size,
        current_page: query.current_page ?? users.pagination.current_page,
      });
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

const userSlice = createSlice({
  name: "users",
  initialState,
  reducers: {
    setFilters(state, action) {
      state.filters = action.payload;
      state.pagination.current_page = 1;
    },
    setPage(state, action) {
      state.pagination.current_page = action.payload;
    },
    setPageSize(state, action) {
      state.pagination.page_size = action.payload;
      state.pagination.current_page = 1;
    },
    clearSubmitError(state) {
      state.submitError = null;
    },
    clearListError(state) {
      state.listError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsers.pending, (state) => {
        state.listLoading = true;
        state.listError = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.listLoading = false;
        state.list = action.payload.data ?? [];
        state.pagination = {
          current_page: action.payload.current_page,
          total_count: action.payload.total_count,
          has_more: action.payload.has_more,
          page_size: action.payload.page_size,
          total_page: action.payload.total_page,
        };
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.listLoading = false;
        state.listError = action.payload;
      });
  },
});

export const {
  setFilters,
  setPage,
  setPageSize,
  clearSubmitError,
  clearListError,
} = userSlice.actions;
export default userSlice.reducer;
```

#### `userSelectors.js`

```js
export const selectUserList = (state) => state.users.list;
export const selectUserPagination = (state) => state.users.pagination;
export const selectUserFilters = (state) => state.users.filters;
export const selectUsersLoading = (state) => state.users.listLoading;
export const selectUsersError = (state) => state.users.listError;
export const selectUsersSubmitLoading = (state) => state.users.submitLoading;
export const selectUsersSubmitError = (state) => state.users.submitError;
```

#### `user.types.js` — JSDoc contracts (no runtime cost)

```js
/**
 * @typedef {Object} GetUsersRequest
 * @property {string}  [name]
 * @property {string}  [email]
 * @property {number}  [page_size]
 * @property {number}  [current_page]
 */

/**
 * @typedef {Object} UserListItem
 * @property {number}      sr_no
 * @property {number}      id
 * @property {string}      name
 * @property {string}      email
 * @property {number|null} insert_by
 * @property {string}      insert_by_val
 * @property {string|null} insert_datetime
 * @property {number|null} update_by
 * @property {string}      update_by_val
 * @property {string|null} update_datetime
 */

/**
 * @typedef {Object} GetUsersResponse
 * @property {number}         current_page
 * @property {number}         total_count
 * @property {boolean}        has_more
 * @property {number}         page_size
 * @property {number}         total_page
 * @property {UserListItem[]} data
 */

export {};
```

### 4.4 Redux Store (`src/store/`)

```js
// store/index.js
import { configureStore } from "@reduxjs/toolkit";
import userReducer from "../features/users/userSlice";
import userGroupReducer from "../features/userGroups/userGroupSlice";

export default configureStore({
  reducer: {
    users: userReducer,
    userGroups: userGroupReducer,
  },
});

// store/hooks.js  — typed wrappers
export const useAppDispatch = useDispatch;
export const useAppSelector = useSelector;
```

### 4.5 Page Component Pattern

Every list page follows this consistent render order:

```
1. useAppSelector(selectors)      — read state slices
2. useAppDispatch()               — get dispatch
3. useEffect → dispatch(fetch…)   — load data on mount
4. Event handlers
   - handleSearch / handleFilter
   - handleOpenCreate / handleOpenEdit
   - handleCloseForm
   - validateForm (client-side)
   - handleSave  (dispatch create or update thunk)
   - handlePageChange / handleRowsPerPageChange
5. JSX render:
   ┌── Header row (title  |  filter inputs  |  action buttons)
   ├── <Alert> on listError
   ├── Loading skeleton / Empty state / <Grid> card list or table
   ├── <TablePagination> or Ant <Pagination>
   └── <CustomDialog> for create / edit form
        ├── <Alert> on submitError
        └── <Stack> of <FormTextField> / <AllDropdown> / etc.
```

### 4.6 Routing

```jsx
// routes/AppRoutes.jsx
<Routes>
  <Route path="/login" element={<Login />} />
  <Route element={<ProtectedRoute />}>
    <Route element={<MainLayout />}>
      <Route path="/" element={<Dashboard />} />
      <Route path="/users" element={<UserList />} />
      <Route path="/user-groups" element={<UserGroupList />} />
    </Route>
  </Route>
</Routes>
```

---

## 6. Custom Component Library

All components are exported from a single barrel: **`src/components/index.js`**

```js
export { default as CustomButton } from "./common/CustomButton";
export { default as PageHeader } from "./common/PageHeader";
export { default as CustomDialog } from "./dialog/CustomDialog";
export { default as CardList } from "./list/CardList";
export { default as TextField } from "./form/TextField";
export { default as AllDropdown, ALL_VALUE } from "./form/AllDropdown";
export { default as AutoDropdown } from "./form/AutoDropdown";
export { default as DatePickerField } from "./form/DatePickerField";
export { default as TimePickerField } from "./form/TimePickerField";
export { default as DateTimePickerField } from "./form/DateTimePickerField";
export { default as DateMonthYearPicker } from "./form/DateMonthYearPicker";
```

### `CustomButton`

| Prop                    | Type   | Default | Description                                                      |
| ----------------------- | ------ | ------- | ---------------------------------------------------------------- |
| `buttonType`            | string | —       | Preset: `primary` `secondary` `outline` `cancel` `save` `delete` |
| `label`                 | string | —       | Button text (or use `children`)                                  |
| `loading`               | bool   | `false` | Shows spinner, disables button                                   |
| `disabled`              | bool   | `false` | —                                                                |
| `fullWidth`             | bool   | `false` | —                                                                |
| `show`                  | bool   | `true`  | Renders `null` when `false`                                      |
| `startIcon` / `endIcon` | node   | —       | Hidden during loading                                            |

**`buttonType` presets:**

| Type        | MUI `variant` | MUI `color` |
| ----------- | ------------- | ----------- |
| `primary`   | `contained`   | `primary`   |
| `secondary` | `contained`   | `secondary` |
| `outline`   | `outlined`    | `primary`   |
| `cancel`    | `outlined`    | `inherit`   |
| `text`      | `text`        | `primary`   |
| `save`      | `contained`   | `primary`   |
| `delete`    | `contained`   | `error`     |

### `CustomDialog`

| Prop                   | Type   | Default | Description                      |
| ---------------------- | ------ | ------- | -------------------------------- |
| `open`                 | bool   | —       | Controls visibility              |
| `onClose`              | func   | —       | Called on close / backdrop click |
| `title`                | string | —       | Dialog title                     |
| `subtitle`             | string | —       | Secondary description text       |
| `children`             | node   | —       | Form content                     |
| `actions`              | object | `{}`    | Action button config (see below) |
| `maxWidth`             | string | `'sm'`  | MUI Dialog maxWidth              |
| `disableBackdropClick` | bool   | `false` | Prevent close on backdrop click  |

**`actions` config pattern:**

```js
actions={{
  cancel: { show: true, onClick: handleClose, disabled: loading },
  save:   { show: true, onClick: handleSave,  loading: loading,  label: 'Save' },
  delete: { show: isEdit, onClick: handleDelete },
}}
// Supported keys: cancel | confirm | save | delete
```

### Form Components

| Component             | Key Props                                                                      | Description                          |
| --------------------- | ------------------------------------------------------------------------------ | ------------------------------------ |
| `TextField`           | `label`, `value`, `onChange(value)`, `type`, `required`, `error`, `helperText` | Controlled text/email/password input |
| `AllDropdown`         | `label`, `value`, `onChange`, `options`, `ALL_VALUE`                           | Dropdown with an "All" first option  |
| `AutoDropdown`        | `label`, `value`, `onChange`, `options`                                        | Searchable autocomplete dropdown     |
| `DatePickerField`     | `label`, `value`, `onChange`                                                   | MUI X date picker wrapper            |
| `TimePickerField`     | `label`, `value`, `onChange`                                                   | MUI X time picker wrapper            |
| `DateTimePickerField` | `label`, `value`, `onChange`                                                   | MUI X datetime picker wrapper        |
| `DateMonthYearPicker` | `label`, `value`, `onChange`                                                   | Month + year selection only          |

> All form components call `onChange(value)` — not `onChange(event)` — for consistency.

### `CardList`

Reusable grid of cards with built-in loading skeleton and empty-state rendering.

---

## 7. Environment Variables

### Backend (`.env` / `.env.example`)

```env
PORT=5000
NODE_ENV=development

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=your_db
DB_USER=postgres
DB_PASSWORD=change_me
DB_SSL=false
DB_REQUIRED=true

# JWT
JWT_SECRET=change_me_in_production
JWT_EXPIRES_IN=7d
```

### Frontend (`.env` / `.env.example`)

```env
# React CRA
REACT_APP_API_URL=http://localhost:5000/api

# Vite
VITE_API_URL=http://localhost:5000/api
```

---

## 8. Naming Conventions

| Layer                  | Convention                                       | Example                                                    |
| ---------------------- | ------------------------------------------------ | ---------------------------------------------------------- |
| DB tables              | `snake_case`, plural                             | `users`, `user_groups`                                     |
| DB columns             | `snake_case`                                     | `created_at`, `group_name`, `password_hash`                |
| PostgreSQL functions   | `dbo.verb_entity`                                | `dbo.get_user`, `dbo.create_user_group`, `dbo.update_user` |
| DB migration files     | `NNN_<description>.sql`                          | `003_get_user.sql`                                         |
| Backend files          | `<entity>.<layer>.js`                            | `user.controller.js`, `user.da.js`, `user.service.js`      |
| Backend router files   | `<entity>.router.js`                             | `userGroup.router.js`                                      |
| Frontend feature files | `<entity>Slice.js`, `<entity>Service.js`         | `userGroupSlice.js`                                        |
| Selectors              | `select<Entity><Field>`                          | `selectUserList`, `selectUserPagination`                   |
| Async thunks           | camelCase verb + entity                          | `fetchUsers`, `createUser`, `updateUserGroup`              |
| Custom components      | `PascalCase`                                     | `CustomButton`, `CustomDialog`                             |
| API endpoints          | `POST /api/<entity>/get`, `…/create`, `…/update` | `POST /api/user-groups/get`                                |

---

## 9. Response Contracts

### Success — single object

```json
{ "success": true, "message": "User updated successfully", "data": { ... } }
```

### Success — paginated list

```json
{
  "message": "",
  "current_page": 1,
  "total_count": 42,
  "has_more": true,
  "page_size": 10,
  "total_page": 5,
  "data": [ ... ]
}
```

### Error

```json
{ "success": false, "message": "Email already registered" }
```

### Validation Error

```json
{
  "success": false,
  "message": "Validation error",
  "errors": [{ "field": "email", "message": "\"email\" must be a valid email" }]
}
```

---

## 10. Quick Checklist for a New Domain

### Backend

- [ ] `migrations/tables/NNN_<entity>.sql` — PostgreSQL table and indexes
- [ ] Add SQL functions only when logic benefits from living in PostgreSQL
- [ ] `src/validation/<entity>.validation.js` — Joi schemas
- [ ] `src/data_access/<entity>.da.js` — parameterized queries, returns `{ summary, data }` for lists
- [ ] `src/service/<entity>.service.js` — business logic, throws `AppError`
- [ ] `src/controller/<entity>.controller.js` — thin, uses `response.helper`
- [ ] `src/router/<entity>.router.js` — authenticate → validate → controller
- [ ] Register in `src/router/index.js`

### Frontend

- [ ] `src/features/<entity>/<entity>.types.js` — JSDoc `@typedef` contracts
- [ ] `src/features/<entity>/<entity>Service.js` — Axios calls via `api`
- [ ] `src/features/<entity>/<entity>Slice.js` — slice + thunks + pagination state
- [ ] `src/features/<entity>/<entity>Selectors.js` — all state selectors
- [ ] Register reducer in `src/store/index.js`
- [ ] `src/pages/<Entity>List.jsx` — page following the standard render order
- [ ] Add route in `src/routes/AppRoutes.jsx`
- [ ] Add nav link in `src/layouts/MainLayout.jsx`

---

## 11. PostgreSQL Interview Guide

### What is PostgreSQL?

PostgreSQL is an open-source relational database management system. It supports SQL, ACID transactions, constraints, joins, indexes, JSON data, functions, and extensions. This project accesses it through Node.js's `pg` connection pool.

### Why use PostgreSQL for Arcade Booking?

- Bookings and payments need transactions and strong consistency.
- Foreign keys and constraints protect relationships among users, machines, time slots, bookings, and payments.
- PostgreSQL supports row locking and atomic updates, which help prevent double booking.
- It is portable across local development, containers, Kubernetes, and AWS RDS.
- `JSONB` can store flexible metadata without moving core transactional data to a separate NoSQL database.

### Interview Explanation

> I selected PostgreSQL as the transactional source of truth because arcade bookings and payments require ACID transactions, relational constraints, and safe concurrent updates. The Node.js API uses a bounded `pg.Pool` and parameterized queries to avoid opening one connection per request and to prevent SQL injection. Database changes are versioned and executed transactionally through a migration table with checksums. Redis is used only for short-lived cache, rate limiting, and booking holds; PostgreSQL remains the durable source of truth.

### Important Concepts

- **ACID:** Transactions are atomic, consistent, isolated, and durable.
- **MVCC:** PostgreSQL keeps row versions so reads and writes can proceed with less blocking.
- **Parameterized query:** SQL and user values are sent separately using `$1`, `$2`, and so on, preventing SQL injection.
- **Connection pool:** A bounded set of reusable database connections reduces connection overhead and protects the database.
- **Index:** A structure that speeds reads but consumes storage and adds write overhead. Index columns used frequently in filters, joins, and ordering.
- **Transaction:** A group of statements committed together or rolled back together.
- **Optimistic concurrency:** Detect a conflicting update using a version or timestamp.
- **Pessimistic concurrency:** Lock selected rows with `SELECT ... FOR UPDATE` when a booking must be reserved safely.

### SQL vs NoSQL

Use PostgreSQL for users, games, machines, time slots, bookings, invoices, and payments because these entities have relationships and transactional rules. A NoSQL database such as DynamoDB can later hold high-volume analytics projections or denormalized event read models. Do not choose NoSQL only because it is fashionable; choose it when access patterns, scale, and flexible schemas justify the additional consistency and modeling trade-offs.

### AWS Production Mapping

- PostgreSQL → Amazon RDS for PostgreSQL or Aurora PostgreSQL
- Credentials → AWS Secrets Manager
- Encryption → TLS in transit and KMS encryption at rest
- Network access → private subnets and security groups
- Monitoring → CloudWatch metrics, PostgreSQL logs, and slow-query monitoring
- Backups → automated RDS backups and point-in-time recovery
