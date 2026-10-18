import { EmbedBuilder, type Client, type TextBasedChannel } from "discord.js";

import { getHumanReadableDealReasons } from "./scoring.js";
import type {
  DealCriteria,
  DealLogger,
  DealPlacement,
  DealPoster,
  DealServiceConfig,
  ScoredDeal,
} from "../types/deals.js";
import { dealLogger } from "../util/logger.js";

const ITAD_HOME = "https://isthereanydeal.com/";
const MAX_EMBED_FIELD_VALUE = 1_024;

export function sanitizeDiscordText(value: string, maxLength = 1_000): string {
  const withoutControls = Array.from(value, (character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint < 0x20 || (codePoint >= 0x7f && codePoint <= 0x9f)
      ? " "
      : character;
  }).join("");
  const sanitized = withoutControls
    .replace(/@/g, "@\u200b")
    .replace(/[<>]/g, (character) => (character === "<" ? "‹" : "›"))
    .replace(/([\\*_~`|])/g, "\\$1")
    .replace(/\s+/g, " ")
    .trim();

  if (sanitized.length <= maxLength) return sanitized;
  return `${sanitized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function secureHttpsUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function fieldValue(value: string): string {
  return sanitizeDiscordText(value, MAX_EMBED_FIELD_VALUE) || "—";
}

function buildWhySection(
  deal: ScoredDeal,
  criteria: DealCriteria,
  preferredPublishers: readonly string[]
): string {
  const reasons = getHumanReadableDealReasons(
    deal,
    criteria,
    preferredPublishers
  );
  return `**Why this deal**\n${reasons.map((reason) => `• ${sanitizeDiscordText(reason, 240)}`).join("\n")}`;
}

export function buildDealEmbed(
  deal: ScoredDeal,
  placement: DealPlacement,
  rank: number,
  config: Pick<
    DealServiceConfig,
    | "preferredPublishers"
    | "minReviewCount"
    | "minMetacriticScore"
    | "includedGenres"
    | "blockedGenres"
    | "maxPrice"
    | "minRegularPrice"
    | "minDiscountPercent"
    | "currency"
    | "includeMature"
    | "allowVouchers"
  >
): EmbedBuilder {
  const criteria: DealCriteria = {
    maxPrice: config.maxPrice,
    minRegularPrice: config.minRegularPrice,
    currency: config.currency,
    minDiscountPercent: config.minDiscountPercent,
    minReviewCount: config.minReviewCount,
    minMetacriticScore: config.minMetacriticScore,
    includeMature: config.includeMature,
    allowVouchers: config.allowVouchers,
    includedGenres: config.includedGenres,
    blockedGenres: config.blockedGenres,
  };

  const title = sanitizeDiscordText(deal.deal.title, 220) || "Untitled game";
  const dealUrl = secureHttpsUrl(deal.deal.deal.url);
  const embedTitle =
    placement === "deal-of-the-day"
      ? `Deal of the Day: ${title}`
      : `${rank}. ${title}`;
  const embed = new EmbedBuilder()
    .setColor(deal.isNewAllTimeLow ? 0x2ecc71 : 0x5865f2)
    .setTitle(embedTitle.slice(0, 256))
    .setDescription(
      [
        placement === "top" ? `**Score:** ${deal.score.toFixed(2)}/100` : null,
        buildWhySection(deal, criteria, config.preferredPublishers),
      ]
        .filter((value): value is string => value !== null)
        .join("\n\n")
        .slice(0, 4_096)
    )
    .addFields(
      {
        name: "Price",
        value: fieldValue(
          `${formatPrice(deal.currentPrice, deal.currency)} — ${deal.deal.deal.cut}% off (regular ${formatPrice(deal.regularPrice, deal.currency)})`
        ),
        inline: true,
      },
      {
        name: "Store",
        value: fieldValue(deal.deal.deal.shop.name),
        inline: true,
      },
      {
        name: "Historical low",
        value: fieldValue(
          deal.isNewAllTimeLow
            ? `New all-time low${deal.historicalLowPrice === null ? "" : `: ${formatPrice(deal.historicalLowPrice, deal.currency)}`}`
            : deal.isHistoricalLow
              ? `Historical low${deal.historicalLowPrice === null ? "" : `: ${formatPrice(deal.historicalLowPrice, deal.currency)}`}`
              : deal.historicalLowPrice === null
                ? "No historical low available"
                : formatPrice(deal.historicalLowPrice, deal.currency)
        ),
        inline: true,
      }
    )
    .setFooter({
      text: "Price and historical data provided by IsThereAnyDeal",
    });

  const steamDetails = [
    deal.steam.metacriticScore === null
      ? null
      : `Metacritic ${deal.steam.metacriticScore}/100`,
    deal.steam.totalReviews === null
      ? null
      : `${deal.steam.totalReviews.toLocaleString("en-US")} Steam recommendations`,
    deal.steam.releaseDate ? `Released ${deal.steam.releaseDate}` : null,
  ].filter((detail): detail is string => detail !== null);
  if (steamDetails.length > 0) {
    embed.addFields({
      name: "Steam metadata",
      value: fieldValue(steamDetails.join(" · ")),
      inline: false,
    });
  }

  const developers = deal.steam.developers.slice(0, 5).join(", ");
  const publishers = deal.steam.publishers.slice(0, 5).join(", ");
  const creators = [
    developers ? `Developers: ${developers}` : null,
    publishers ? `Publishers: ${publishers}` : null,
  ].filter((value): value is string => value !== null);
  if (creators.length > 0) {
    embed.addFields({
      name: "Credits",
      value: fieldValue(creators.join("\n")),
      inline: false,
    });
  }

  const platformAndDrm = [
    deal.deal.deal.platforms.length > 0
      ? `Platforms: ${deal.deal.deal.platforms.map((item) => item.name).join(", ")}`
      : null,
    deal.deal.deal.drm.length > 0
      ? `DRM: ${deal.deal.deal.drm.map((item) => item.name).join(", ")}`
      : null,
  ].filter((value): value is string => value !== null);
  if (platformAndDrm.length > 0) {
    embed.addFields({
      name: "Platform / DRM",
      value: fieldValue(platformAndDrm.join("\n")),
      inline: false,
    });
  }

  if (deal.steam.genres.length > 0) {
    embed.addFields({
      name: "Genres",
      value: fieldValue(deal.steam.genres.slice(0, 12).join(", ")),
      inline: true,
    });
  }

  if (dealUrl) embed.setURL(dealUrl);

  const image =
    secureHttpsUrl(deal.steam.headerImage) ??
    secureHttpsUrl(deal.deal.assets?.banner600) ??
    secureHttpsUrl(deal.deal.assets?.banner400) ??
    secureHttpsUrl(deal.deal.assets?.banner300) ??
    secureHttpsUrl(deal.deal.assets?.boxart);
  if (image) embed.setImage(image);

  embed.addFields({
    name: "Deal URL",
    value: dealUrl ? `<${dealUrl}>` : "Unavailable",
    inline: false,
  });
  embed.setAuthor({ name: "IsThereAnyDeal", url: ITAD_HOME });

  return embed;
}

export class DiscordDealPoster implements DealPoster {
  constructor(
    private readonly client: Client,
    private readonly channelId: string,
    private readonly config: DealServiceConfig,
    private readonly logger: DealLogger = dealLogger
  ) {}

  async post(
    deal: ScoredDeal,
    placement: DealPlacement,
    rank: number
  ): Promise<{ messageId: string; channelId: string }> {
    const channel = await this.client.channels.fetch(this.channelId);
    if (!channel || !channel.isTextBased() || !("send" in channel)) {
      throw new Error(
        "Configured deal channel is unavailable or not text-based"
      );
    }

    const textChannel = channel as TextBasedChannel & {
      send: (options: { embeds: EmbedBuilder[] }) => Promise<{
        id: string;
        channelId: string;
      }>;
    };
    const message = await textChannel.send({
      embeds: [buildDealEmbed(deal, placement, rank, this.config)],
    });

    this.logger.info("Posted a qualifying game deal", {
      placement,
      gameId: deal.deal.id,
      shopId: deal.deal.deal.shop.id,
      messageId: message.id,
    });

    return { messageId: message.id, channelId: message.channelId };
  }
}
