import { logger } from './logger';

/**
 * Fetches a URL with exponential backoff retry logic for rate limiting.
 * Retries on HTTP 429 (Too Many Requests) and 5xx server errors.
 *
 * @param url - The URL to fetch
 * @param options - Fetch options
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @returns Promise<Response>
 */
export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  maxRetries = 3,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (response.ok) {
        return response;
      }

      if (
        response.status >= 400 &&
        response.status < 500 &&
        response.status !== 429
      ) {
        return response;
      }

      if (response.status === 429 || response.status >= 500) {
        if (attempt < maxRetries) {
          const delayMs = 1000 * Math.pow(2, attempt);
          logger.warn(
            `HTTP ${response.status} on attempt ${attempt + 1}/${maxRetries + 1}. Retrying in ${delayMs}ms...`,
            {
              status: response.status,
              attempt: attempt + 1,
              maxRetries: maxRetries + 1,
              delayMs,
            },
          );
          await sleep(delayMs);
          continue;
        }
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        const delayMs = 1000 * Math.pow(2, attempt);
        logger.warn(
          `Fetch error on attempt ${attempt + 1}/${maxRetries + 1}: ${lastError.message}. Retrying in ${delayMs}ms...`,
          {
            attempt: attempt + 1,
            maxRetries: maxRetries + 1,
            delayMs,
            error: lastError,
          },
        );
        await sleep(delayMs);
      }
    }
  }

  throw (
    lastError ?? new Error(`Failed to fetch ${url} after ${maxRetries} retries`)
  );
}

/**
 * Sleep for a specified number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
