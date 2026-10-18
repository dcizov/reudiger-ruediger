import type { z } from "zod";

import {
  ItadDealsResponseSchema,
  ItadShopIdsResponseSchema,
  type ItadDealsResponse,
  type ItadShopIdsResponse,
} from "../schemas/itadDeals.js";
import {
  ItadOverviewResponseSchema,
  type ItadOverviewResponse,
} from "../schemas/itad.js";
import type { DealLogger } from "../types/deals.js";
import { dealLogger, safeErrorName } from "./logger.js";

const DEFAULT_BASE_URL = "https://api.isthereanydeal.com";
const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_MAX_ATTEMPTS = 3;

export interface ItadApiOptions {
  apiKey: string;
  fetcher?: typeof fetch;
  baseUrl?: string;
  timeoutMs?: number;
  maxAttempts?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  logger?: DealLogger;
}

export interface ItadDealPageRequest {
  country: string;
  offset: number;
  limit: number;
  mature: boolean;
  sort: string;
  filter: Record<string, unknown>;
}

export class ItadApiError extends Error {
  constructor(
    readonly endpoint: string,
    readonly status: number,
    reason: string
  ) {
    super(`ITAD request ${endpoint} failed: ${reason}`);
    this.name = "ItadApiError";
  }
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function retryAfterMilliseconds(value: string | null): number | null {
  if (!value) return null;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.ceil(seconds * 1000);
  }

  const retryAt = Date.parse(value);
  if (!Number.isFinite(retryAt)) return null;
  return Math.max(0, retryAt - Date.now());
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

export class ItadApiClient {
  private readonly apiKey: string;
  private readonly fetcher: typeof fetch;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;
  private readonly wait: (milliseconds: number) => Promise<void>;
  private readonly logger: DealLogger;

  constructor(options: ItadApiOptions) {
    this.apiKey = options.apiKey.trim();
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.wait = options.sleep ?? sleep;
    this.logger = options.logger ?? dealLogger;

    if (!this.apiKey) {
      throw new Error("An ITAD API key is required");
    }
  }

  async getDealsPage(request: ItadDealPageRequest): Promise<ItadDealsResponse> {
    const query = new URLSearchParams({
      country: request.country,
      offset: String(request.offset),
      limit: String(request.limit),
      mature: String(request.mature),
      sort: request.sort,
      filter: JSON.stringify(request.filter),
    });

    return this.request("/deals/v2", "GET", query, ItadDealsResponseSchema);
  }

  async getPriceOverview(
    gameIds: readonly string[],
    country: string,
    vouchers: boolean
  ): Promise<ItadOverviewResponse> {
    const query = new URLSearchParams({
      country,
      vouchers: String(vouchers),
    });

    return this.request(
      "/games/overview/v2",
      "POST",
      query,
      ItadOverviewResponseSchema,
      gameIds
    );
  }

  async lookupShopIds(
    gameIds: readonly string[],
    shopId: number
  ): Promise<ItadShopIdsResponse> {
    return this.request(
      `/lookup/shop/${shopId}/id/v1`,
      "POST",
      new URLSearchParams(),
      ItadShopIdsResponseSchema,
      gameIds
    );
  }

  private async request<T>(
    endpoint: string,
    method: "GET" | "POST",
    query: URLSearchParams,
    schema: z.ZodType<T>,
    body?: readonly string[]
  ): Promise<T> {
    const url = new URL(endpoint, this.baseUrl);
    query.forEach((value, key) => url.searchParams.set(key, value));

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      let response: Response;
      try {
        response = await this.fetcher(url.toString(), {
          method,
          headers: {
            Accept: "application/json",
            "ITAD-API-Key": this.apiKey,
            ...(body ? { "Content-Type": "application/json" } : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
          signal: controller.signal,
        });
      } catch (error) {
        clearTimeout(timeout);
        if (attempt >= this.maxAttempts) {
          this.logger.warn("ITAD request could not reach the service", {
            endpoint,
            errorType: safeErrorName(error),
          });
          throw new ItadApiError(endpoint, 0, "network request failed");
        }

        await this.wait(Math.min(1_000 * 2 ** (attempt - 1), 8_000));
        continue;
      }
      clearTimeout(timeout);

      if (!response.ok) {
        if (isRetryableStatus(response.status) && attempt < this.maxAttempts) {
          const retryAfter = retryAfterMilliseconds(
            response.headers.get("Retry-After")
          );
          await response.body?.cancel().catch(() => undefined);
          await this.wait(
            retryAfter ?? Math.min(1_000 * 2 ** (attempt - 1), 8_000)
          );
          continue;
        }

        this.logger.warn("ITAD returned an unsuccessful response", {
          endpoint,
          status: response.status,
        });
        throw new ItadApiError(
          endpoint,
          response.status,
          `HTTP ${response.status}`
        );
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new ItadApiError(
          endpoint,
          response.status,
          "invalid JSON response"
        );
      }

      const parsed = schema.safeParse(payload);
      if (!parsed.success) {
        this.logger.warn("ITAD response did not match the expected schema", {
          endpoint,
          issueCount: parsed.error.issues.length,
        });
        throw new ItadApiError(
          endpoint,
          response.status,
          "invalid response shape"
        );
      }

      return parsed.data;
    }

    throw new ItadApiError(endpoint, 0, "retry limit reached");
  }
}
