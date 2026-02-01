import type { mastodon } from "masto";
import {
  createTwemojiImgTag,
  parseUnicodeEmojis,
} from "./twemoji";

/**
 * Escapes special characters for use in RegExp
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Escapes special HTML characters to prevent XSS
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Validates and sanitizes emoji URL.
 * Only allows http/https URLs and escapes special characters.
 *
 * @param url - The URL to validate
 * @returns Sanitized URL or empty string if invalid
 */
function sanitizeEmojiUrl(url: string): string {
  if (!url) return "";

  // Only allow http and https schemes
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }
  } catch {
    // Invalid URL
    return "";
  }

  // Escape HTML special characters in URL
  return escapeHtml(url);
}

/**
 * Creates an img tag for a custom emoji.
 *
 * @param emoji - The custom emoji definition
 * @returns HTML img tag string or empty string if URL is invalid
 */
function createEmojiImgTag(emoji: mastodon.v1.CustomEmoji): string {
  const sanitizedUrl = sanitizeEmojiUrl(emoji.url);
  if (!sanitizedUrl) {
    return `:${escapeHtml(emoji.shortcode)}:`;
  }

  const escapedShortcode = escapeHtml(emoji.shortcode);
  return `<img class="emoji" src="${sanitizedUrl}" alt=":${escapedShortcode}:" title=":${escapedShortcode}:">`;
}

/**
 * Checks if a given offset in an HTML string is inside an HTML tag.
 * Properly handles quoted attribute values that may contain < or > characters.
 *
 * @param html - The HTML string to check
 * @param offset - The character offset to check
 * @returns true if the offset is inside an HTML tag, false otherwise
 */
function isInsideHtmlTag(html: string, offset: number): boolean {
  let insideTag = false;
  let quoteChar: string | null = null;

  for (let i = 0; i < offset && i < html.length; i++) {
    const char = html[i];

    if (quoteChar) {
      // Inside quotes - only exit when we see the matching quote
      if (char === quoteChar) {
        quoteChar = null;
      }
      // Ignore < and > inside quotes
    } else if (insideTag) {
      // Inside a tag but not in quotes
      if (char === '"' || char === "'") {
        quoteChar = char;
      } else if (char === ">") {
        insideTag = false;
      }
    } else {
      // Outside a tag
      if (char === "<") {
        insideTag = true;
      }
    }
  }

  return insideTag;
}

/**
 * Splits HTML into text segments and tag segments.
 * Returns an array of segments where each segment is either a text segment
 * (outside tags) or a tag segment (inside tags).
 *
 * @param html - The HTML string to split
 * @returns Array of segments with type and content
 */
function splitHtmlByTags(html: string): Array<{ type: "text" | "tag"; content: string }> {
  const segments: Array<{ type: "text" | "tag"; content: string }> = [];
  let currentSegment = "";
  let insideTag = false;
  let quoteChar: string | null = null;

  for (let i = 0; i < html.length; i++) {
    const char = html[i];

    if (quoteChar) {
      currentSegment += char;
      if (char === quoteChar) {
        quoteChar = null;
      }
    } else if (insideTag) {
      currentSegment += char;
      if (char === '"' || char === "'") {
        quoteChar = char;
      } else if (char === ">") {
        insideTag = false;
        segments.push({ type: "tag", content: currentSegment });
        currentSegment = "";
      }
    } else {
      if (char === "<") {
        if (currentSegment) {
          segments.push({ type: "text", content: currentSegment });
        }
        currentSegment = "<";
        insideTag = true;
      } else {
        currentSegment += char;
      }
    }
  }

  // Add remaining segment
  if (currentSegment) {
    segments.push({ type: insideTag ? "tag" : "text", content: currentSegment });
  }

  return segments;
}

/**
 * Replaces Unicode emojis with Twemoji img tags in HTML content.
 * Only processes text segments outside of HTML tags to avoid breaking attributes.
 * Handles BMP emoji, variation selectors, and surrogate pairs.
 *
 * @param html - The HTML string that may contain Unicode emojis
 * @returns HTML with Unicode emojis replaced by img tags
 */
function replaceUnicodeEmojisInHtml(html: string): string {
  if (!html) {
    return "";
  }

  // Split HTML into text and tag segments
  const segments = splitHtmlByTags(html);

  // Process only text segments
  return segments
    .map((segment) => {
      if (segment.type === "tag") {
        return segment.content; // Preserve tags as-is
      }

      // Process text segment for emojis
      const emojis = parseUnicodeEmojis(segment.content, { assetType: "svg" });
      if (emojis.length === 0) {
        return segment.content;
      }

      // Replace emojis from end to start to maintain offsets
      let result = segment.content;
      for (let i = emojis.length - 1; i >= 0; i--) {
        const emoji = emojis[i];
        const imgTag = createTwemojiImgTag(emoji);
        const [startIndex, endIndex] = emoji.indices;
        result = result.slice(0, startIndex) + imgTag + result.slice(endIndex);
      }

      return result;
    })
    .join("");
}

/**
 * Replaces emoji shortcodes (e.g., :shortcode:) with img tags in HTML content.
 * Uses a replacement callback and context checks to avoid replacing shortcodes inside HTML tag attributes.
 * Also replaces Unicode emojis with Twemoji images after processing custom emojis.
 *
 * Processing order:
 * 1. Custom emojis (:shortcode:) - processed first to avoid conflicts
 * 2. Unicode emojis (😀) - processed after custom emojis
 *
 * @param html - The HTML string containing emoji shortcodes and/or Unicode emojis
 * @param emojis - Array of custom emoji definitions from Mastodon API
 * @returns HTML with shortcodes and Unicode emojis replaced by img tags
 */
export function replaceEmojisWithImages(
  html: string,
  emojis: mastodon.v1.CustomEmoji[] | undefined
): string {
  if (!html) {
    return "";
  }

  let result = html;

  // Step 1: Process custom emojis (:shortcode:)
  if (emojis && emojis.length > 0 && html.includes(":")) {
    for (const emoji of emojis) {
      const shortcode = escapeRegExp(emoji.shortcode);
      const pattern = new RegExp(`:${shortcode}:`, "g");
      const imgTag = createEmojiImgTag(emoji);

      result = result.replace(pattern, (match, offset) => {
        // Check if we're inside an HTML tag (handles quoted attributes properly)
        if (isInsideHtmlTag(result, offset)) {
          return match;
        }
        return imgTag;
      });
    }
  }

  // Step 2: Process Unicode emojis (😀)
  result = replaceUnicodeEmojisInHtml(result);

  return result;
}

/**
 * Replaces emoji shortcodes in plain text (like displayName).
 * Escapes the input text first to prevent XSS, then replaces emoji shortcodes.
 * Also replaces Unicode emojis with Twemoji images after processing custom emojis.
 *
 * Processing order:
 * 1. Escape HTML to prevent XSS
 * 2. Custom emojis (:shortcode:) - processed first
 * 3. Unicode emojis (😀) - processed after custom emojis
 *
 * @param text - Plain text containing emoji shortcodes and/or Unicode emojis
 * @param emojis - Array of custom emoji definitions from Mastodon API
 * @returns HTML string with text escaped and emojis replaced by img tags
 */
export function replaceEmojisInPlainText(
  text: string,
  emojis: mastodon.v1.CustomEmoji[] | undefined
): string {
  if (!text) {
    return "";
  }

  // Step 1: Always escape HTML first to prevent XSS
  let result = escapeHtml(text);

  // Step 2: Process custom emojis (:shortcode:)
  if (emojis && emojis.length > 0) {
    for (const emoji of emojis) {
      const shortcode = escapeRegExp(escapeHtml(emoji.shortcode));
      const pattern = new RegExp(`:${shortcode}:`, "g");
      const imgTag = createEmojiImgTag(emoji);
      result = result.replace(pattern, imgTag);
    }
  }

  // Step 3: Process Unicode emojis (😀)
  // Since text is already escaped, we can safely parse and replace Unicode emojis
  const unicodeEmojis = parseUnicodeEmojis(result, { assetType: "svg" });
  if (unicodeEmojis.length > 0) {
    // Replace emojis from end to start to maintain offsets
    for (let i = unicodeEmojis.length - 1; i >= 0; i--) {
      const emoji = unicodeEmojis[i];
      const imgTag = createTwemojiImgTag(emoji);
      const [startIndex, endIndex] = emoji.indices;
      result = result.slice(0, startIndex) + imgTag + result.slice(endIndex);
    }
  }

  return result;
}
