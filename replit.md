# True Request Acceptor

A full-featured Telegram bot system for managing private channel join requests. Includes a Telegraf-powered bot with 20+ commands and a modern dark-themed React admin panel.

## Architecture

### Monorepo Structure (pnpm workspaces)
```
artifacts/
  api-server/     — Express API + Telegraf Telegram bot
  admin-panel/    — React + Vite admin dashboard (dark theme)
lib/
  db/             — Drizzle ORM schema + PostgreSQL client
  api-spec/       — OpenAPI 3.0 spec (~40 endpoints)
  api-client-react/ — Generated React Query hooks
```

### Tech Stack
- **Bot**: Telegraf (long polling), node-cron for scheduled messages
- **Backend**: Express, Pino logger, Drizzle ORM, PostgreSQL
- **Frontend**: React 18, Vite, Tailwind CSS v4, shadcn/ui, Recharts, Framer Motion, Wouter router
- **API**: OpenAPI 3.0 spec → Orval codegen → React Query hooks

## Telegram Bot Commands
- `/start` — Welcome message (uses active welcome template)
- `/help` — Command list (custom or auto-generated)
- `/myid` — Show user's Telegram ID
- `/info` — Bot information
- `/status` — User's join request history
- `/deeplink` — Generate referral link
- **Admin only:**
  - `/pending` — List pending requests
  - `/approve [user_id]` — Approve a request
  - `/reject [user_id] [reason]` — Reject with optional reason
  - `/broadcast [message]` — Send to all users
  - `/blacklist [user_id] [reason]` — Blacklist a user
  - `/unblacklist [user_id]` — Remove from blacklist
  - `/stats` — Bot statistics
  - `/admins` — List all admins
  - `/settings` — View current settings
  - `/addadmin [id]` — Add an admin
  - `/removeadmin [id]` — Remove an admin

## Admin Panel Pages
1. **Dashboard** — Stats (users, approved/rejected/pending, today, channels), recent activity feed
2. **Join Requests** — Filter by status, search, paginated list, approve/reject per-row, bulk approve all/reject all
3. **Users** — Paginated list, blacklist/unblacklist, send DM, filter blacklisted
4. **Broadcasts** — Create/send/delete broadcasts, rich Markdown, photo URL, inline buttons
5. **Welcome Messages** — CRUD templates, activate one as default, markdown editor
6. **Admin Panel** — Add/remove admins with Telegram ID, set per-permission (approve/broadcast/manage admins/settings)
7. **Settings** — Toggle switches + inputs for all 14 settings, live bot info card
8. **Analytics** — Recharts line/bar charts for 7/14/30 day request activity and new users
9. **Auto Rules** — Username regex rules that auto-approve or auto-reject matching users

## Database Schema (11 tables)
`users`, `join_requests`, `bot_settings`, `welcome_messages`, `approval_messages`, `rejection_messages`, `broadcasts`, `admin_users`, `analytics`, `auto_rules`, `channels`

## Environment Variables
- `TELEGRAM_BOT_TOKEN` — Bot token from BotFather (stored as secret)
- `DATABASE_URL` — PostgreSQL connection string (auto-provisioned)
- `SESSION_SECRET` — Express session secret
- `PORT` — Set by Replit per artifact

## Design System
- Deep navy background: `hsl(222 47% 11%)`
- Electric cyan primary: `hsl(199 89% 48%)`
- Forced dark mode (no light mode toggle)
- shadcn/ui components, Framer Motion page transitions

## API Routes (all under `/api/`)
- `GET /dashboard/stats` — Aggregated stats
- `GET /dashboard/activity` — Recent 20 activity items
- `GET/POST/PUT/DELETE /requests` — Join request CRUD with approve/reject/approve-all/reject-all
- `GET/POST/PUT/DELETE /users` — User management with blacklist/unblacklist/send-dm/export
- `GET/POST/PUT/DELETE /broadcasts` — Broadcast CRUD + send
- `GET/POST/PUT/DELETE /welcome-messages` — Welcome message templates + activate
- `GET/PUT /settings` — Bot settings (14 keys)
- `GET/POST/PUT/DELETE /admins` — Admin management
- `GET /channels` — Connected channels
- `GET /analytics/daily` — Daily analytics with day range param
- `GET/POST/PUT/DELETE /auto-rules` — Auto-approve/reject rules
- `GET /bot/info` — Live bot info from Telegram API
