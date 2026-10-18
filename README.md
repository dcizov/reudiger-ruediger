# ITAD Discord Deal Bot

A Discord bot that periodically discovers discounted video games from IsThereAnyDeal (ITAD), enriches candidates with Steam Store `appdetails`, scores eligible deals, and posts embeds to a configured Discord channel.

## Requirements

- Node.js `^24.12.0` (the repository's `.nvmrc` pins `24.22.0`)
- PostgreSQL, when deal posting is enabled
- A Discord application/bot and a channel where it can send embeds
- An ITAD API key

## Setup

1. Install Node 24 and dependencies:

   ```sh
   nvm use
   npm ci
   ```

2. Copy `.env.example` to `.env` and fill in `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_DEALS_CHANNEL_ID`, `DATABASE_URL`, and `ITAD_API_KEY`. Keep `.env` private; it is ignored by Git.
3. Generate migrations when the schema changes, then apply the checked-in migration to your own PostgreSQL database:

   ```sh
   npm run db:generate
   npm run db:migrate
   ```

   The bot does **not** run migrations automatically. Migration commands are not part of tests or startup.
4. Start the bot:

   ```sh
   npm run build
   npm start
   ```

   The bot runs one deal scan at startup and schedules later scans using `DEALS_SCHEDULE` (default `0 */6 * * *`) in `DEALS_TIMEZONE` (default `Europe/Berlin`). Set `DEALS_ENABLED=false` to disable deal scanning or `DISCORD_LOGIN_ENABLED=false` for an offline startup/smoke run.

## Pipeline and safety

Each run follows this order: fetch the paginated ITAD deals → reject non-games/mature content → remove already-posted game/store offers → fetch ITAD current-price and history overviews → resolve Steam AppIDs through ITAD's explicit shop-ID lookup → fetch cached/paced Steam appdetails → apply hard relevance gates → score and select deals → post Discord embeds → persist message IDs, offer details, and cooldown state.

Default gates use country `DE`, EUR prices, a regular price of at least €10, a current price no higher than €60, at least 35% off, and either at least 1,000 Steam recommendations/reviews or a Metacritic score of at least 70. Deals must be games, not free-to-play or unreleased, have an active offer, and match the selected currency. Optional genre allow/block lists are case-insensitive. `DEAL_INCLUDED_GENRES` is empty by default (no genre restriction); if set, a game must match at least one listed genre. `DEAL_PREFERRED_PUBLISHERS` adds a score bonus; it is not a hard gate.

Steam's positive-review percentage is not used. Steam metadata is validated with Zod, cached in PostgreSQL for seven days by default, and `appdetails` requests are serialized with a two-second default delay. ITAD API responses are validated and retried on transient errors; its deal-page result is cached in memory for 15 minutes. ITAD API keys are sent via the `ITAD-API-Key` header and are not included in logs or URLs.

### Selection and scoring

- `DEALS_MODE=top` posts up to `DEALS_MAX_POSTS` (default 5) highest-scoring eligible offers per run.
- `DEALS_MODE=deal-of-the-day` selects one highest-scoring eligible game per run. It uses the title `Deal of the Day: <Game Title>`, includes a “Why this deal” section, and applies a persisted per-game cooldown (default seven days).
- Dedupe uses the ITAD game UUID plus shop ID. Successful Discord message IDs and deal details are stored in PostgreSQL so a restart does not repost the same offer.
- The default score weights are Metacritic 34%, logarithmic Steam review/recommendation count 32%, historical value 14%, discount 8%, capped regular-price value 6%, and preferred-publisher match 6%. Discount credit saturates at 60% off, and regular-price credit saturates at €60; a very large markdown cannot automatically outrank quality/demand evidence.

## Development checks

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run test:watch
npm run build
```

All automated tests use mocked HTTP fetches and do not call ITAD, Steam, Discord, or PostgreSQL. The PostgreSQL store is deliberately not exercised against a real database by the test suite.

## Data sources

- [ITAD API documentation](https://docs.isthereanydeal.com/)
- [ITAD deals v2 route](https://github.com/IsThereAnyDeal/API/blob/master/docs/routes/deals/deals.v2.yaml)
- [ITAD game overview v2 route](https://github.com/IsThereAnyDeal/API/blob/master/docs/routes/games/overview.v2.yaml)
- [ITAD shop-ID lookup route](https://github.com/IsThereAnyDeal/API/blob/master/docs/routes/lookup/shopid-by-gid.v1.yaml)
- [Steam Web API overview](https://partner.steamgames.com/doc/webapi_overview)
