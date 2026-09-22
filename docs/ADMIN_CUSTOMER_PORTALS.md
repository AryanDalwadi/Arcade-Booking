# Admin and Customer Portals

## Goal

The web application now has two clear experiences backed by the same
server-side authorization rules:

- `/app/*` is the customer portal.
- `/admin/*` is the administration portal for `STAFF` and `ADMIN`.

Navigation hiding is only a usability feature. The API gateway and each owning
service also enforce the policy, so manually calling an admin endpoint as a
customer returns `403 Forbidden`.

## Role policy

`CUSTOMER` can:

- view active catalog data;
- request server-calculated machine quotes;
- create a booking for their own authenticated identity;
- list only their own bookings.

`STAFF` can:

- enter the administration portal;
- read users and user groups;
- list all bookings;
- manage machines and pricing;
- inspect payment operations.

`STAFF` cannot change identity groups or memberships.

`ADMIN` can perform all STAFF operations and:

- create custom user groups;
- add and remove group memberships;
- assign the `STAFF` and `ADMIN` system role groups.

The final ADMIN membership cannot be removed.

## Request enforcement

1. The browser sends its JWT to the API gateway.
2. The gateway verifies the signature, issuer, audience, and expiry.
3. The gateway removes client-supplied `x-auth-*` headers.
4. Verified subject and roles are forwarded to the service.
5. Gateway method/path rules reject obvious forbidden calls early.
6. The owning service applies the same authorization rule through
   `@arcade/service-auth`.

The service check remains necessary because UI checks and gateway checks alone
are not authoritative.

## Identity model

Identity seeds three system groups:

- `CUSTOMER`
- `STAFF`
- `ADMIN`

Registration creates a real CUSTOMER membership. Custom groups remain
available for teams or business organization, but only the three recognized
system group names become JWT roles.

Role changes take effect on the next login because JWT claims are immutable
after issuance.

## First local administrator

Docker Compose configures:

```text
BOOTSTRAP_ADMIN_EMAIL=milestone-ui-2259@example.com
```

Identity assigns the existing account with that email to the ADMIN group during
startup. This operation is idempotent. If the account does not exist, Identity
logs a warning and does not create a user or password.

For a fresh database:

1. Register the intended user.
2. Set `BOOTSTRAP_ADMIN_EMAIL` to that exact email.
3. Restart Identity.
4. Sign out and sign in again to receive a JWT containing `ADMIN`.

Production should source this setting from a secret-management system and
remove it after controlled bootstrap.

## Portal routes

Customer:

```text
/app/dashboard
/app/catalog
/app/bookings
```

Administration:

```text
/admin/dashboard
/admin/users
/admin/user-groups
/admin/catalog
/admin/bookings
```

Legacy URLs redirect to the correct role home. A customer who manually opens an
admin URL receives a dedicated 403 page. After logout, a leftover customer path
is not reused for an administrator login; role home always wins across portals.

## Local verification

```powershell
npm run typecheck
npm test
npm run build
docker compose -f infra/docker-compose.yml up -d --build
```

API expectations:

- no token on protected API: `401`;
- CUSTOMER on admin API: `403`;
- STAFF on identity mutation: `403`;
- STAFF on identity read: `200`;
- ADMIN on identity mutation: success;
- CUSTOMER booking list: authenticated customer's rows only;
- STAFF/ADMIN booking list: all rows.

## Errors encountered

- Windows PowerShell rejected `&&`. The install/build sequence was rerun as
  separate commands.
- The browser production build could not consume a runtime named export from
  the CommonJS contracts package. Session-role validation was kept in the web
  application as a typed local allow-list, while shared Node authorization
  continues to use the contracts schema.
- `npm install` reported two moderate dependency audit findings. No forced
  upgrade was applied because `npm audit fix --force` can introduce breaking
  versions and is outside this portal change.

## Interview explanation

> I separated customer and administration routes in React, but treated route
> guards as presentation rather than security. JWT authentication happens at
> the gateway, which strips spoofed identity headers and applies coarse route
> policy. Each owning microservice then performs authorization through a shared
> middleware package. Identity models roles as seeded groups, prevents
> customer privilege escalation, supports read-only STAFF access, and
> bootstraps the first administrator through controlled configuration. This
> gives defense in depth while keeping authorization decisions close to the
> protected data.
