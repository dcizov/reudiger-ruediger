import { afterEach, describe, expect, it, vi } from "vitest";

import { makeItadDeal, mockedRequestUrl } from "../test/fixtures.js";
import { ItadApiClient, ItadApiError } from "./itadApi.js";

const responseBody = {
  nextOffset: 1,
  hasMore: false,
  list: [makeItadDeal()],
};

function makeFetch(response: Response | (() => Response)) {
  return vi.fn(
    (_input: string | URL | Request, _init?: RequestInit): Promise<Response> =>
      Promise.resolve(
        typeof response === "function" ? response() : response.clone()
      )
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ITAD API boundary", () => {
  it("sends credentials only in ITAD-API-Key and validates deal pages", async () => {
    const fetcher = makeFetch(
      new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    const client = new ItadApiClient({
      apiKey: "test-key-redacted",
      fetcher,
      maxAttempts: 1,
    });

    const page = await client.getDealsPage({
      country: "DE",
      offset: 0,
      limit: 200,
      mature: false,
      sort: "-cut",
      filter: { type: [1] },
    });

    expect(page.list).toHaveLength(1);
    expect(page.list[0]?.title).toBe("Test Game");
    const [input, init] = fetcher.mock.calls[0] ?? [];
    const url = mockedRequestUrl(input);
    expect(url.pathname).toBe("/deals/v2");
    expect(url.searchParams.get("country")).toBe("DE");
    expect(url.searchParams.get("key")).toBeNull();
    expect(url.toString()).not.toContain("test-key-redacted");
    expect(new Headers(init?.headers).get("ITAD-API-Key")).toBe(
      "test-key-redacted"
    );
  });

  it("sends overview and shop-lookup game UUIDs in POST bodies", async () => {
    const deal = makeItadDeal();
    const overviewResponse = {
      prices: [
        {
          id: deal.id,
          current: null,
          lowest: null,
          bundled: 0,
          urls: { game: "https://isthereanydeal.com/game/test-game/" },
        },
      ],
      bundles: [],
    };
    let call = 0;
    const fetcher = vi.fn(
      (_input: string | URL | Request, _init?: RequestInit) => {
        call += 1;
        return Promise.resolve(
          call === 1
            ? new Response(JSON.stringify(overviewResponse), { status: 200 })
            : new Response(JSON.stringify({ [deal.id]: ["app/12345"] }), {
                status: 200,
              })
        );
      }
    );
    const client = new ItadApiClient({
      apiKey: "test-key-redacted",
      fetcher,
      maxAttempts: 1,
    });

    const overview = await client.getPriceOverview([deal.id], "DE", false);
    const lookup = await client.lookupShopIds([deal.id], 61);

    expect(overview.prices[0]?.id).toBe(deal.id);
    expect(lookup[deal.id]).toEqual(["app/12345"]);
    const [firstInput, firstInit] = fetcher.mock.calls[0] ?? [];
    expect(mockedRequestUrl(firstInput ?? "").pathname).toBe(
      "/games/overview/v2"
    );
    expect(firstInit?.method).toBe("POST");
    expect(firstInit?.body).toBe(JSON.stringify([deal.id]));
    const [secondInput, secondInit] = fetcher.mock.calls[1] ?? [];
    expect(mockedRequestUrl(secondInput ?? "").pathname).toBe(
      "/lookup/shop/61/id/v1"
    );
    expect(secondInit?.body).toBe(JSON.stringify([deal.id]));
  });

  it("retries 429 responses using Retry-After without logging response secrets", async () => {
    let calls = 0;
    const fetcher = makeFetch(() => {
      calls += 1;
      return calls === 1
        ? new Response("private response content", {
            status: 429,
            headers: { "retry-after": "0" },
          })
        : new Response(JSON.stringify(responseBody), { status: 200 });
    });
    const sleep = vi.fn(() => Promise.resolve());
    const client = new ItadApiClient({
      apiKey: "test-key-redacted",
      fetcher,
      maxAttempts: 2,
      sleep,
    });

    const page = await client.getDealsPage({
      country: "DE",
      offset: 0,
      limit: 200,
      mature: false,
      sort: "-cut",
      filter: {},
    });

    expect(page.list).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(0);
  });

  it("fails closed on invalid response shapes and does not expose the API key", async () => {
    const fetcher = makeFetch(
      new Response(JSON.stringify({ list: "not-an-array" }), { status: 200 })
    );
    const client = new ItadApiClient({
      apiKey: "test-key-redacted",
      fetcher,
      maxAttempts: 1,
    });

    await expect(
      client.getDealsPage({
        country: "DE",
        offset: 0,
        limit: 200,
        mature: false,
        sort: "-cut",
        filter: {},
      })
    ).rejects.toBeInstanceOf(ItadApiError);

    try {
      await client.getDealsPage({
        country: "DE",
        offset: 0,
        limit: 200,
        mature: false,
        sort: "-cut",
        filter: {},
      });
    } catch (error) {
      expect(String(error)).not.toContain("test-key-redacted");
    }
  });
});
