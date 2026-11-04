# Smart Trader — Hybrid private/public storage

## Storage modes

- Public mode: existing IndexedDB database `smart_trader_db`; data stays on the current device.
- Private mode: authenticated server session + MySQL snapshot; browser cache uses a separate IndexedDB database `smart_trader_db_private_cache`.
- Public data is never uploaded automatically into the private account.

## MySQL setup

Create a dedicated MySQL database and user in Hostinger, then configure the variables from `app/frontend/.env.example` in the Node.js application's environment.

The Node server creates these tables automatically inside the selected database:

- `smart_trader_private_users`
- `smart_trader_private_sessions`
- `smart_trader_private_snapshots`

The database itself must already exist.

## Authentication

The first private user is bootstrapped from `PRIVATE_ADMIN_USERNAME` and `PRIVATE_ADMIN_PASSWORD` only when no matching user exists.

Passwords are stored as PBKDF2-SHA256 hashes with a random salt and 600,000 iterations. Sessions use a random server token stored only as a SHA-256 hash in MySQL. The browser receives an HttpOnly, Secure, SameSite=Strict cookie.

## Sync

Private mode keeps an isolated browser cache for responsiveness. Every Repository mutation queues a snapshot sync to MySQL.

Each snapshot has a monotonically increasing revision. A stale browser cannot overwrite a newer server revision: the API returns HTTP 409 instead.

The Settings > Data screen shows the active mode, revision and sync state.

## Deployment safety

If MySQL variables are missing or connection initialization fails, the server logs the problem and public/local mode remains available. Private login is hidden until the server reports `databaseReady: true`.

Do not commit production credentials.
