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
 * Replaces emoji shortcodes (e.g., :shortcode:) with img tags in HTML content.
 * Uses a replacement callback and context checks to avoid replacing shortcodes inside HTML tag attributes.
 *
 * @param html - The HTML string containing emoji shortcodes
 * @param emojis - Array of custom emoji definitions from Mastodon API
 * @returns HTML with shortcodes replaced by img tags
 */
export function replaceEmojisWithImages(
  html: string,
  emojis: mastodon.v1.CustomEmoji[] | undefined
): string {
  if (!html || !emojis || emojis.length === 0) {
    return html ?? "";
  }

  // Early return if no colon in text (no possible shortcodes)
  if (!html.includes(":")) {
    return html;
  }

  let result = html;

  for (const emoji of emojis) {
    const shortcode = escapeRegExp(emoji.shortcode);
    // Match :shortcode: occurrences; actual avoidance of replacements inside
    // HTML tags/attributes is handled in the replacement callback below.
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

  return result;
}

/**
 * Replaces emoji shortcodes in plain text (like displayName).
 * Escapes the input text first to prevent XSS, then replaces emoji shortcodes.
 *
 * @param text - Plain text containing emoji shortcodes
 * @param emojis - Array of custom emoji definitions from Mastodon API
 * @returns HTML string with text escaped and shortcodes replaced by img tags
 */
export function replaceEmojisInPlainText(
  text: string,
  emojis: mastodon.v1.CustomEmoji[] | undefined
): string {
  if (!text) {
    return "";
  }

  if (!emojis || emojis.length === 0) {
    return escapeHtml(text);
  }

  // Early return if no colon in text (no possible shortcodes)
  if (!text.includes(":")) {
    return escapeHtml(text);
  }

  // First escape the text to prevent XSS
  let result = escapeHtml(text);

  for (const emoji of emojis) {
    // Use escaped shortcode for matching (since text is now escaped)
    const shortcode = escapeRegExp(escapeHtml(emoji.shortcode));
    const pattern = new RegExp(`:${shortcode}:`, "g");
    const imgTag = createEmojiImgTag(emoji);
    result = result.replace(pattern, imgTag);
  }

  return result;
}
