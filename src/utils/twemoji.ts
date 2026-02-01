import { parse, type EmojiEntity, type ParsingOptions } from "@twemoji/parser";
import { escapeHtml } from "./html";

// Re-export EmojiEntity for use in other modules
export type { EmojiEntity };

/**
 * Builds a Twemoji CDN URL for the given emoji codepoints.
 * Uses jsDelivr CDN for the jdecked/twemoji fork.
 *
 * @param codepoints - Array of Unicode codepoint strings for the emoji
 * @param format - File format (svg or png)
 * @returns CDN URL for the Twemoji image
 */
export function buildTwemojiUrl(
  codepoints: string[],
  format: "svg" | "png" = "svg"
): string {
  const fileName = codepoints.join("-");
  return `https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/${format}/${fileName}.${format}`;
}

/**
 * Parses text and returns an array of emoji entities.
 * Uses @twemoji/parser for accurate emoji detection including:
 * - Complex emojis (skin tone modifiers, ZWJ sequences, flags)
 * - Emoji 17.0 support (Unicode 17.0)
 *
 * @param text - Text to parse for emojis
 * @param options - Optional parsing options (e.g., assetType for URL generation)
 * @returns Array of emoji entities with text, url, and position info
 */
export function parseUnicodeEmojis(text: string, options?: ParsingOptions): EmojiEntity[] {
  return parse(text, options);
}

/**
 * Checks if text likely contains any Unicode emojis.
 * This is a simple heuristic check for early return optimization.
 *
 * @param text - Text to check
 * @returns true if text likely contains emojis
 */
export function hasLikelyEmoji(text: string): boolean {
  // Simple heuristic: check for UTF-16 surrogate pairs used for emoji
  // High surrogates: U+D800-U+DBFF
  // Low surrogates: U+DC00-U+DFFF
  // Most emoji are in the range starting with U+D83x
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    // Check for high surrogate (indicates potential emoji)
    if (code >= 0xd800 && code <= 0xdbff) {
      return true;
    }
  }
  return false;
}

/**
 * Creates an img tag for a Twemoji emoji.
 *
 * @param emoji - Emoji entity from @twemoji/parser
 * @returns HTML img tag string
 */
export function createTwemojiImgTag(emoji: EmojiEntity): string {
  const escapedText = escapeHtml(emoji.text);
  const escapedUrl = escapeHtml(emoji.url);
  return `<img class="emoji" src="${escapedUrl}" alt="${escapedText}" title="${escapedText}">`;
}

/**
 * Replaces all Unicode emojis in text with Twemoji img tags.
 * Preserves all other text and handles complex emojis correctly.
 * Includes BMP emoji, variation selectors, and surrogate pairs.
 *
 * @param text - Text containing Unicode emojis
 * @returns HTML string with emojis replaced by img tags
 */
export function replaceUnicodeEmojisWithImages(text: string): string {
  if (!text) {
    return "";
  }

  const emojis = parse(text, { assetType: "svg" });
  if (emojis.length === 0) {
    return text;
  }

  // Build result by replacing emojis from end to start to maintain offsets
  let result = text;
  for (let i = emojis.length - 1; i >= 0; i--) {
    const emoji = emojis[i];
    const imgTag = createTwemojiImgTag(emoji);

    const [startIndex, endIndex] = emoji.indices;
    result = result.slice(0, startIndex) + imgTag + result.slice(endIndex);
  }

  return result;
}
