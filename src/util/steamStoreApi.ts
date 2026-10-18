import {
  SteamStoreResponseSchema,
  type SteamGameMetadata,
} from "../schemas/steamStore.js";
import type { DealLogger } from "../types/deals.js";
import { dealLogger, safeErrorName } from "./logger.js";

const DEFAULT_BASE_URL = "https://store.steampowered.com/api/appdetails/";
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_REQUEST_INTERVAL_MS = 2_000;

export interface SteamStoreApiOptions {
  fetcher?: typeof fetch;
  baseUrl?: string;
  timeoutMs?: number;
  requestIntervalMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  logger?: DealLogger;
}

export interface SteamBatchOptions {
  country: string;
  language?: string;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function retryAfterMilliseconds(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0)
    return Math.ceil(seconds * 1000);
  const retryAt = Date.parse(value);
  return Number.isFinite(retryAt) ? Math.max(0, retryAt - Date.now()) : null;
}

export class SteamStoreApiClient {
  private readonly fetcher: typeof fetch;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly requestIntervalMs: number;
  private readonly wait: (milliseconds: number) => Promise<void>;
  private readonly logger: DealLogger;
  private nextRequestAt = 0;

  constructor(options: SteamStoreApiOptions = {}) {
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.requestIntervalMs =
      options.requestIntervalMs ?? DEFAULT_REQUEST_INTERVAL_MS;
    this.wait = options.sleep ?? sleep;
    this.logger = options.logger ?? dealLogger;
  }

  async getGameMetadata(
    appId: number,
    options: SteamBatchOptions
  ): Promise<SteamGameMetadata | null> {
    if (!Number.isSafeInteger(appId) || appId <= 0) return null;

    const url = new URL(this.baseUrl);
    url.searchParams.set("appids", String(appId));
    url.searchParams.set("cc", options.country.toLowerCase());
    url.searchParams.set("l", options.language ?? "english");

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      await this.waitForRateLimit();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      let response: Response;
      try {
        response = await this.fetcher(url.toString(), {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
      } catch (error) {
        clearTimeout(timeout);
        this.logger.warn("Steam Store metadata request failed", {
          appId,
          errorType: safeErrorName(error),
        });
        return null;
      }
      clearTimeout(timeout);

      if (!response.ok) {
        if (
          (response.status === 429 || response.status >= 500) &&
          attempt < 2
        ) {
          const retryAfter = retryAfterMilliseconds(
            response.headers.get("Retry-After")
          );
          await response.body?.cancel().catch(() => undefined);
          await this.wait(retryAfter ?? 4_000);
          continue;
        }

        this.logger.warn("Steam Store returned an unsuccessful response", {
          appId,
          status: response.status,
        });
        return null;
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        this.logger.warn("Steam Store returned invalid JSON", { appId });
        return null;
      }

      const parsed = SteamStoreResponseSchema.safeParse(payload);
      if (!parsed.success) {
        this.logger.warn("Steam Store response did not match its schema", {
          appId,
          issueCount: parsed.error.issues.length,
        });
        return null;
      }

      const envelope = parsed.data[String(appId)];
      if (!envelope?.success || !envelope.data) {
        this.logger.info("Steam Store has no usable app metadata", { appId });
        return null;
      }

      const data = envelope.data;
      return {
        appId,
        name: data.name ?? null,
        type: data.type?.toLowerCase() ?? null,
        isFree: data.is_free ?? null,
        comingSoon: data.release_date?.coming_soon ?? false,
        totalReviews: data.recommendations?.total ?? null,
        metacriticScore: data.metacritic?.score ?? null,
        headerImage: data.header_image ?? null,
        developers: data.developers ?? [],
        publishers: data.publishers ?? [],
        genres: data.genres?.map((genre) => genre.description) ?? [],
        releaseDate: data.release_date?.date ?? null,
      };
    }

    return null;
  }

  /**
   * Appdetails is requested once per app ID; the endpoint has no documented
   * multi-app batch contract. This method batches work at the caller level
   * while serializing requests to stay conservative with rate limits.
   */
  async batchGetGameMetadata(
    appIds: readonly number[],
    options: SteamBatchOptions
  ): Promise<Map<number, SteamGameMetadata>> {
    const results = new Map<number, SteamGameMetadata>();
    const uniqueIds = [...new Set(appIds)];

    for (const appId of uniqueIds) {
      const metadata = await this.getGameMetadata(appId, options);
      if (metadata) results.set(appId, metadata);
    }

    return results;
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const waitFor = Math.max(0, this.nextRequestAt - now);
    if (waitFor > 0) await this.wait(waitFor);
    this.nextRequestAt = Date.now() + this.requestIntervalMs;
  }
}
