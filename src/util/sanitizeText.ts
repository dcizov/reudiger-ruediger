/**
 * Sanitize text for Discord embeds and messages
 * Prevents markdown injection and limits text length
 */

/**
 * Sanitize Discord text by removing/escaping potentially dangerous characters
 * and limiting length to prevent markdown injection
 *
 * @param text - The text to sanitize
 * @param maxLength - Maximum length (default: 256 for embed titles)
 * @returns Sanitized text safe for Discord embeds
 */
export function sanitizeDiscordText(
  text: string,
  maxLength = 256,
): string {
  return (
    text
      // Remove Discord markdown characters that could be used for injection
      .replace(/[`*_~|]/g, '')
      // Replace potential URLs with placeholder to prevent link injection
      .replace(/https?:\/\/[^\s]+/g, '[link]')
      // Trim to max length
      .slice(0, maxLength)
      .trim()
  );
}

/**
 * Sanitize Discord description text (allows more length)
 *
 * @param text - The text to sanitize
 * @param maxLength - Maximum length (default: 2048 for embed descriptions)
 * @returns Sanitized text safe for Discord embed descriptions
 */
export function sanitizeDiscordDescription(
  text: string,
  maxLength = 2048,
): string {
  return sanitizeDiscordText(text, maxLength);
}

/**
 * Sanitize but preserve URLs (only limits length and removes markdown)
 * Use this when URLs are expected and safe (e.g., from trusted APIs)
 *
 * @param text - The text to sanitize
 * @param maxLength - Maximum length
 * @returns Sanitized text with URLs preserved
 */
export function sanitizeDiscordTextKeepUrls(
  text: string,
  maxLength = 256,
): string {
  return (
    text
      // Remove Discord markdown characters
      .replace(/[`*_~|]/g, '')
      // Trim to max length
      .slice(0, maxLength)
      .trim()
  );
}
