# Rüdiger Discord Bot

Game deal aggregator and price tracker for Discord. Posts deals from CheapShark,
tracks prices via IsThereAnyDeal API, manages roles, and aggregates gaming news.

**Stack**: TypeScript • Discord.js v14 • Drizzle ORM • PostgreSQL • Docker

---

## Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 16 (or use Docker)
- Discord Bot Token
  ([Discord Developer Portal](https://discord.com/developers/applications))
- ITAD API Key ([IsThereAnyDeal API](https://isthereanydeal.com/dev/app/))

### Initial Setup

```bash
# Clone and install
git clone <repository-url>
cd reudiger-ruediger
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your credentials
# Required: DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID, ITAD_API_KEY, DATABASE_URL
```

### Database Setup

**Option 1: Docker (recommended)**

```bash
npm run dev:db          # Start PostgreSQL in Docker
npm run migrate         # Run migrations
```

**Option 2: Local PostgreSQL**

```bash
# Ensure PostgreSQL is running on localhost:5432
# Update DATABASE_URL in .env
npm run migrate         # Run migrations
```

### Deploy Discord Commands

```bash
npm run deploy          # Register slash commands with Discord
```

### Start Development

```bash
npm run dev             # Start bot in watch mode
```

---

## Development

### Available Commands

```bash
# Development
npm run dev                 # Run bot with hot reload
npm run dev:db              # Start PostgreSQL only
npm run dev:docker          # Full stack in Docker

# Database
npm run migrate             # Run migrations (do this first!)
npm run db:generate         # Generate new migration from schema changes
npm run db:push             # Quick schema push (dev only, skips migrations)
npm run db:studio           # Open Drizzle Studio UI

# Code Quality
npm run check               # Lint + typecheck
npm run lint                # ESLint check
npm run lint:fix            # Fix linting issues
npm run typecheck           # TypeScript type check
npm run format:write        # Format with Prettier

# Discord
npm run deploy              # Deploy/update slash commands

# Build
npm run build               # Build for production
npm start                   # Run production build
```

### Typical Workflow

**Local development (with Docker database):**

```bash
npm run dev:db          # 1. Start PostgreSQL only
npm run migrate         # 2. Run migrations
npm run deploy          # 3. Deploy slash commands (first time)
npm run dev             # 4. Start bot with hot reload
```

**Full Docker stack (development mode with hot reload):**

```bash
docker-compose up -d    # Starts migrate → discord-bot → postgres-db
# Uses docker-compose.override.yml automatically
# Mounts ./src for hot reload, exposes DB on localhost:5432
```

### Making Schema Changes

```bash
# 1. Edit src/db/schema.ts
# 2. Generate migration
npm run db:generate

# 3. Review generated SQL in drizzle/ directory
# 4. Apply migration
npm run migrate
```

### Environment Variables

**`.env` (local development)**:

- Uses `localhost:5432` for database
- Docker Compose overrides this automatically

**Required variables**:

- `DISCORD_TOKEN` - Bot token
- `DISCORD_CLIENT_ID` - Application ID
- `DISCORD_GUILD_ID` - Test server ID
- `ITAD_API_KEY` - IsThereAnyDeal API key
- `DATABASE_URL` - PostgreSQL connection string
- `WEBHOOK_SECRET` - Webhook authentication

---

## Production Deployment

### Docker Deployment (Recommended)

**1. Prepare environment**

```bash
# Create .env.production from template
cp .env.example .env.production

# Edit .env.production with production credentials:
# - DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID
# - ITAD_API_KEY
# - DATABASE_USER, DATABASE_PASSWORD, DATABASE_NAME
# - WEBHOOK_SECRET
# - Set NODE_ENV=production
# - Set LOG_LEVEL=info or warn
```

**2. Deploy with Docker Compose**

```bash
# Uses docker-compose.yml + docker-compose.prod.yml
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# What happens:
# 1. migrate service runs database migrations (exits after completion)
# 2. discord-bot starts after migrations complete (production build)
# 3. postgres-db provides PostgreSQL database
```

**3. Deploy Discord commands**

```bash
# Run once to register slash commands
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec discord-bot npm run deploy
```

**4. View logs**

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs -f discord-bot
```

### Manual Deployment (No Docker)

**1. Build the application**

```bash
npm run build
```

**2. Prepare environment**

```bash
# Set production environment variables
export NODE_ENV=production
export DATABASE_URL=postgresql://user:pass@host:5432/db
# ... other vars
```

**3. Run migrations**

```bash
npm run migrate
```

**4. Deploy Discord commands**

```bash
npm run deploy
```

**5. Start the bot**

```bash
npm start
```

### Docker Architecture

**Development mode** (`docker-compose up -d`):

- Uses `docker-compose.yml` + `docker-compose.override.yml` (automatic)
- Builds `development` stage from Dockerfile
- Mounts `./src` for hot reload
- Exposes PostgreSQL on `localhost:5432`
- Uses `.env` file

**Production mode**
(`docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d`):

- Uses `docker-compose.yml` + `docker-compose.prod.yml` (explicit)
- Builds `production` stage from Dockerfile (optimized, no dev deps)
- No volume mounts (immutable containers)
- PostgreSQL not exposed externally
- Uses `.env.production` file

**Services**:

1. **migrate**: Runs migrations, exits on completion, depends on postgres-db
   health
2. **discord-bot**: Starts after migrate completes, depends on postgres-db
   health
3. **postgres-db**: PostgreSQL 16 Alpine with health checks and persistent
   volume

### Production Checklist

- [ ] Create `.env.production` with all required variables
- [ ] Set `NODE_ENV=production`
- [ ] Set `LOG_LEVEL=info` or `warn`
- [ ] Verify `DATABASE_URL` points to production database
- [ ] Run migrations: automatic via `migrate` service
- [ ] Deploy slash commands: `docker-compose exec discord-bot npm run deploy`
- [ ] Verify bot has proper Discord permissions
- [ ] Test slash commands in production guild
- [ ] Set up database backups
- [ ] Monitor logs: `docker-compose logs -f discord-bot`
- [ ] Set up reverse proxy if exposing webhook server

---

## Project Structure

```
src/
├── commands/           # Discord slash commands
├── events/            # Discord event handlers
├── services/          # Core services (deals, news, scheduling)
├── utils/             # Utilities (ITAD, CheapShark APIs)
├── db/
│   ├── schema.ts      # Database schema (Drizzle ORM)
│   └── index.ts       # Database connection
├── migrate.ts         # Standalone migration runner
├── deploy-commands.ts # Discord command deployer
└── index.ts           # Bot entry point

drizzle/               # Generated SQL migrations
```

---

## Key Features

- **Deal Posting**: Fetches deals from CheapShark, enriches with ITAD prices,
  scores and posts top deals
- **Price Alerts**: Users subscribe to games, receive DMs when target prices met
- **Role Management**: Reaction roles with categories, cooldowns, and
  conditional access
- **News Aggregation**: Steam game news and RSS feeds (Wowhead, MMO-Champion)
- **Scheduled Tasks**: Cron jobs for deals (30min), subscriptions (15min), news
  (30min), cleanup (hourly)

---

## Database

**Migrations**: Production-grade Drizzle ORM with automatic locking via
`drizzle.__drizzle_migrations` table

**Tables**:

- `posted_deals` - Deal tracking with 6-hour expiration
- `subscriptions` - User price alerts
- `reaction_roles` / `reaction_role_buttons` - Role management
- `news_settings` / `posted_news` - News configuration and tracking
- `bot_config` - Key-value bot settings
- `user_settings` - Per-user preferences
- `user_role_cooldowns` - 5-minute role change cooldowns

**Studio**: `npm run db:studio` for visual database management

---

## Troubleshooting

**Migration fails with "ENOTFOUND postgres-db"**:

- Running locally? `DATABASE_URL` in `.env` should use `localhost`, not
  `postgres-db`
- Shell environment variables override `.env`:
  `unset DATABASE_URL && npm run migrate`
- Docker Compose automatically overrides to `postgres-db` hostname

**Bot won't start**:

- Ensure database is running: `npm run dev:db` or
  `pg_isready -h localhost -p 5432`
- Run migrations: `npm run migrate`
- Verify `.env` has all required variables
- Check logs for specific errors

**Commands not showing in Discord**:

- Run `npm run deploy` to register slash commands
- Guild commands appear instantly, global commands take up to 1 hour
- Verify bot has `applications.commands` scope in OAuth2 URL
- Check bot is in the guild specified by `DISCORD_GUILD_ID`

**Docker Compose issues**:

```bash
# Development mode
docker-compose logs discord-bot    # View bot logs
docker-compose logs migrate        # View migration logs
docker-compose up -d --build       # Rebuild containers

# Production mode
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs discord-bot
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

**Hot reload not working in Docker**:

- Ensure using development mode: `docker-compose up -d` (not production)
- Check `docker-compose.override.yml` mounts `./src` directory
- Restart container: `docker-compose restart discord-bot`

**Database connection in Docker**:

- Development: PostgreSQL exposed on `localhost:5432`
- Production: PostgreSQL not exposed, only accessible within Docker network
- Access DB: `docker-compose exec postgres-db psql -U postgres -d dbname`

---

## Contributing

1. Create feature branch: `git checkout -b feature/name`
2. Make changes and test locally
3. Run quality checks: `npm run check`
4. Commit with conventional commits: `feat: add new feature`
5. Push and create PR

**Pre-commit hooks**: Husky runs linting and formatting automatically

---

## Documentation

See [CLAUDE.md](CLAUDE.md) for:

- Detailed architecture overview
- Service descriptions and data flow
- Specialized agent system for development
- ESM module patterns
- Database migration strategies
- Production best practices

---

## License

MIT

---

## CI/CD

🚧 **Coming Soon** - Automated deployment pipeline with GitHub Actions
