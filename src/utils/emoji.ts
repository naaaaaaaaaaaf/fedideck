import type { mastodon } from "masto";

/**
 * Escapes special characters for use in RegExp
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Escapes special HTML characters to prevent XSS
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Replaces emoji shortcodes (e.g., :shortcode:) with img tags.
 *
 * @param text - The text containing emoji shortcodes
 * @param emojis - Array of custom emoji definitions from Mastodon API
 * @returns Text with shortcodes replaced by img tags
 */
export function replaceEmojisWithImages(
  text: string,
  emojis: mastodon.v1.CustomEmoji[] | undefined
): string {
  if (!text || !emojis || emojis.length === 0) {
    return text ?? "";
  }

  let result = text;

  for (const emoji of emojis) {
    const shortcode = escapeRegExp(emoji.shortcode);
    const pattern = new RegExp(`:${shortcode}:`, "g");
    const escapedShortcode = escapeHtml(emoji.shortcode);
    const imgTag = `<img class="emoji" src="${emoji.url}" alt=":${escapedShortcode}:" title=":${escapedShortcode}:">`;
    result = result.replace(pattern, imgTag);
  }

  return result;
}
