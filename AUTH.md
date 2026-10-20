# ReloPlan — Login, Users and Administration

The whole site sits behind one login. Only `/login.html` and the `/api/auth/*` endpoints are reachable without a session; every page, data file (`*.json`) and script/style asset requires one.

## How it works

| Piece | File | Role |
|---|---|---|
| Access gate | `middleware.js` | Vercel Routing Middleware. Runs before every request. Lets a request through only with a valid signed *gate* cookie; otherwise redirects to the login page (pages) or returns 401 (files). `/admin.html` also requires the admin role. |
| Auth API | `api/auth/*.js` | `login`, `register`, `logout`, `refresh`, `me`, `password` (change own password). |
| Admin API | `api/admin/users.js` | List/search users and create, set password, deregister, reactivate. Admin is re-checked in the database on every call. |
| Core logic | `lib/auth.js`, `lib/db.js`, `lib/gate.js`, `lib/http.js` | Argon2id hashing, sessions, rate limiting, parameterized SQL. Server-side only. |
| Pages | `login.html`, `account.html`, `admin.html`, `account-menu.js` | Login/registration, change password + log out, user management, and the "Account/Admin · Log out" links added to the existing navigation. |
| Schema | `supabase/migrations/20261019000000_reloplan_users.sql` | Tables, indexes, RLS. Idempotent; never drops data. |
| Tests | `tests/auth.test.js` | Acceptance tests against an in-process Postgres (`npm test`). |

**Sessions.** Logging in creates a random session token, stored only as a SHA-256 hash in `reloplan_sessions`, and sets two `__Host-` cookies (HttpOnly, Secure, SameSite=Lax):

- `__Host-rp_sid` — the session (7 days for users, 8 hours for the admin).
- `__Host-rp_gate` — a signed, 60-second pass bound to that session. When it expires, the browser is sent through `/api/auth/refresh`, which re-checks the session, the account (not deregistered, session version unchanged) and, for the admin, that the admin credential has not changed.

Deregistering a user, resetting their password or the user changing their password revokes their sessions at once for every API call, and within at most 60 seconds for page loads.

**Accounts.**

- Ordinary users: email (trimmed, lower-cased, unique case-insensitively) and a password of **exactly 8 characters**, counted as Unicode characters, with no category rules and no trimming. Passwords are hashed with Argon2id (19 MiB, t=2, p=1).
- Administrator: an identity configured in Vercel environment variables, separate from the users table. It works when the table is empty and is never subject to email validation. No database field grants admin rights.

**Throttling.**

| Who | Limit |
|---|---|
| Failed logins per account | 5 in 15 min |
| Failed logins per IP | 30 in 15 min |
| Admin login | 5 failures per IP and 30 in total per 30 min |
| Registrations | 10 per IP per hour |
| Own password changes | 5 per 15 min |
| Admin API | 120 calls per IP per 10 min |

## One-time setup

Do these **in order**. Deploying the code before steps 1–2 locks everyone out, because the gate fails closed.

### 1. Create the tables (Supabase)
Supabase → your project → **SQL Editor** → paste the whole of `supabase/migrations/20261019000000_reloplan_users.sql` → **Run**. Running it again later is safe.

### 2. Set environment variables (Vercel)
Vercel → project → **Settings → Environment Variables**. Add each one for **Production** and **Preview**. Use separate values for Preview if you have a separate Supabase project for testing.

| Name | Value |
|---|---|
| `DATABASE_URL` | Supabase → **Connect** → *Transaction pooler* URI (port **6543**), with your database password filled in. |
| `SESSION_SECRET` | 48+ random characters. Generate with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. Changing it signs everyone out. |
| `ADMIN_USERNAME` | The administrator username. |
| `ADMIN_PASSWORD_HASH` | Argon2id hash of the admin password (preferred). Generate with `npm run hash-password`. |
| `ADMIN_PASSWORD` | Plain admin password. Only used if `ADMIN_PASSWORD_HASH` is not set. Prefer the hash. |
| `DATABASE_CA_CERT` | *(Recommended)* Supabase → **Database → Settings → SSL Configuration** → download certificate; paste the PEM text. With it, the database server's certificate is verified. Without it the connection is still encrypted, but not verified. |

Mark them **Sensitive**. Never commit them. The GitHub repository is public, and `.env*` files are git-ignored.

### 3. Deploy
Push to the deployment branch; Vercel builds as before (`vite build`) and also deploys `middleware.js` and the `api/` functions.

## Managing users (administrator)

Log in with the admin username → **Admin** in the navigation (or `/admin.html`):

- **Search** by email, and filter by Active / Deregistered.
- **Add user**: email and an 8-character password.
- **Set password**: also signs that user out everywhere.
- **Deregister**: sets *Date of Deregistration* to today, signs the user out and blocks login.
- **Reactivate**: clears *Date of Deregistration* and keeps the original registration date.

Password hashes are never shown or returned by any API.

## Changing the administrator credentials

No code change is needed:

1. Run `npm run hash-password` and enter the new password (input is hidden).
2. In Vercel, update `ADMIN_PASSWORD_HASH` (and `ADMIN_USERNAME` if it changes); delete `ADMIN_PASSWORD` if it is set.
3. **Redeploy** (Deployments → ⋯ → Redeploy), because environment variable changes apply only to new deployments.

Existing admin sessions end automatically once the new value is live. The initial admin password is 8 digits; replace it with a long passphrase as soon as possible.

## Local development and tests

```bash
npm install
npm test        # 29 acceptance tests: builds the site, runs the real handlers + middleware against PGlite
npm run build   # static build only
```

`npm run dev` (Vite) serves the static pages **without** the gate or API. Use `vercel dev` (Vercel CLI) to run the full stack locally with a `.env.local`.

## Known limitations

- A session's pages stay loadable for up to 60 seconds after revocation (API calls stop immediately). Lowering `GATE_TTL_SECONDS` in `lib/gate.js` shortens this, at the cost of more refresh redirects.
- Self-registration has no email verification: anyone can register any address.
- The server connects with the database owner role through the pooler. A dedicated least-privilege Postgres role would reduce the impact of a leaked `DATABASE_URL`.
- The site is no longer indexable by search engines (pages send `X-Robots-Tag: noindex`, and crawlers only see the login page).
