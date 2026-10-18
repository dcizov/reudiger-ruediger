import cron, { type ScheduledTask } from "node-cron";
import { Client, Events, GatewayIntentBits } from "discord.js";

import { commands } from "./commands/index.js";
import { config } from "./config.js";
import { DiscordDealPoster } from "./deals/discordPoster.js";
import { DealPipeline } from "./deals/pipeline.js";
import { DEFAULT_SCORE_WEIGHTS } from "./deals/scoring.js";
import { createDatabase, type DatabaseHandle } from "./db/client.js";
import { PostgresDealStore } from "./db/store.js";
import type { DealServiceConfig } from "./types/deals.js";
import { dealLogger, safeErrorName } from "./util/logger.js";
import { ItadApiClient } from "./util/itadApi.js";
import { SteamStoreApiClient } from "./util/steamStoreApi.js";

function registerCommandHandlers(client: Client): void {
  client.once(Events.ClientReady, (readyClient) => {
    dealLogger.info("Discord bot is ready", {
      userTag: readyClient.user.tag,
    });
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = commands[interaction.commandName];
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      dealLogger.error("Discord command execution failed", {
        commandName: interaction.commandName,
        errorType: safeErrorName(error),
      });

      const replyMethod =
        interaction.replied || interaction.deferred
          ? (options: string | { content: string; ephemeral: boolean }) =>
              interaction.followUp(options)
          : (options: string | { content: string; ephemeral: boolean }) =>
              interaction.reply(options);

      await replyMethod({
        content: "There was an error executing this command!",
        ephemeral: true,
      });
    }
  });
}

function buildDealServiceConfig(): DealServiceConfig {
  const deal = config.deals;
  return {
    ...deal.criteria,
    country: deal.criteria.country,
    mode: deal.mode,
    topCount: deal.topCount,
    cooldownDays: deal.cooldownDays,
    dealCacheTtlMs: deal.dealCacheTtlMs,
    steamEnrichmentEnabled: deal.steamEnrichmentEnabled,
    steamCacheTtlMs: deal.steamCacheTtlMs,
    steamRequestDelayMs: deal.steamRequestDelayMs,
    itadDealsPageSize: deal.itadDealsPageSize,
    itadMaxDealPages: deal.itadMaxDealPages,
    itadSteamShopId: deal.itadSteamShopId,
    claimLeaseMs: deal.claimLeaseMs,
    preferredPublishers: deal.criteria.preferredPublishers,
    scoreWeights: DEFAULT_SCORE_WEIGHTS,
  };
}

function validateSchedule(schedule: string, timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
  } catch {
    dealLogger.warn("Invalid deal schedule timezone; scheduler is disabled");
    return false;
  }

  if (!cron.validate(schedule)) {
    dealLogger.warn("Invalid deal cron expression; scheduler is disabled");
    return false;
  }

  return true;
}

async function startApplication(): Promise<void> {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.DirectMessages,
    ],
  });
  registerCommandHandlers(client);

  let database: DatabaseHandle | undefined;
  let scheduledTask: ScheduledTask | undefined;

  const missingDealConfig = [
    !config.deals.apiKey && "ITAD_API_KEY",
    !config.deals.channelId && "DISCORD_DEALS_CHANNEL_ID",
    !config.databaseUrl && "DATABASE_URL",
  ].filter((value): value is string => Boolean(value));

  if (!config.deals.enabled) {
    dealLogger.info("Deal pipeline is disabled by configuration");
  } else if (missingDealConfig.length > 0) {
    dealLogger.warn(
      "Deal pipeline is disabled because required settings are missing",
      {
        missingSettings: missingDealConfig,
      }
    );
  } else if (!validateSchedule(config.deals.schedule, config.deals.timezone)) {
    dealLogger.warn(
      "Deal pipeline was not started because its schedule is invalid"
    );
  } else {
    try {
      database = createDatabase(config.databaseUrl);
      const dealConfig = buildDealServiceConfig();
      const pipeline = new DealPipeline({
        config: dealConfig,
        itadClient: new ItadApiClient({ apiKey: config.deals.apiKey }),
        steamClient: new SteamStoreApiClient({
          requestIntervalMs: dealConfig.steamRequestDelayMs,
        }),
        store: new PostgresDealStore(database.db),
        poster: new DiscordDealPoster(
          client,
          config.deals.channelId,
          dealConfig
        ),
      });

      // Run once at boot, then use the configured six-hour default schedule.
      void pipeline.run();
      scheduledTask = cron.schedule(
        config.deals.schedule,
        () => {
          void pipeline.run();
        },
        { timezone: config.deals.timezone, noOverlap: true }
      );
      dealLogger.info("Deal scheduler started", {
        schedule: config.deals.schedule,
        timezone: config.deals.timezone,
      });
    } catch (error) {
      dealLogger.error("Could not initialize the deal pipeline", {
        errorType: safeErrorName(error),
      });
      await database?.close().catch(() => undefined);
      database = undefined;
    }
  }

  const shutdown = async (signal: string): Promise<void> => {
    dealLogger.info("Shutting down the bot", { signal });
    await scheduledTask?.stop();
    await database?.close().catch((error: unknown) => {
      dealLogger.warn("Could not close the database pool", {
        errorType: safeErrorName(error),
      });
    });
    await client.destroy();
  };

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  if (!config.discordLoginEnabled) {
    dealLogger.info("Discord login is disabled by configuration");
    return;
  }

  try {
    await client.login(config.DISCORD_TOKEN);
  } catch (error) {
    dealLogger.error("Discord login failed", {
      errorType: safeErrorName(error),
    });
    await database?.close().catch(() => undefined);
    process.exitCode = 1;
  }
}

void startApplication().catch((error: unknown) => {
  dealLogger.error("Application startup failed", {
    errorType: safeErrorName(error),
  });
  process.exitCode = 1;
});
