import { parse, toCodePoints, type EmojiEntity, type ParsingOptions } from '@twemoji/parser';
import { escapeHtml } from './html';

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
    format: 'svg' | 'png' = 'svg'
): string {
    const fileName = codepoints.join('-');
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
 * Validates that a URL is a safe Twemoji CDN URL.
 * Only allows HTTPS URLs from cdn.jsdelivr.net with the correct path format.
 *
 * @param url - URL to validate
 * @returns true if URL is safe, false otherwise
 */
export function validateTwemojiUrl(url: string): boolean {
    if (!url) return false;

    try {
        const parsed = new URL(url);
        return (
            parsed.protocol === 'https:' &&
            parsed.hostname === 'cdn.jsdelivr.net' &&
            parsed.pathname.startsWith('/gh/jdecked/twemoji@')
        );
    } catch {
        return false;
    }
}

/**
 * Creates an img tag for a Twemoji emoji.
 * Uses toCodePoints() to build the URL from emoji text instead of trusting emoji.url.
 *
 * @param emoji - Emoji entity from @twemoji/parser
 * @returns HTML img tag string, or escaped text if URL validation fails
 */
export function createTwemojiImgTag(emoji: EmojiEntity): string {
    const escapedText = escapeHtml(emoji.text);
    // Build URL from codepoints instead of trusting emoji.url
    const codepoints = toCodePoints(emoji.text);
    const url = buildTwemojiUrl(codepoints, 'svg');

    // Validate URL before using it
    if (!validateTwemojiUrl(url)) {
        return escapedText;
    }

    const escapedUrl = escapeHtml(url);
    return `<img class="emoji" src="${escapedUrl}" alt="${escapedText}" title="${escapedText}">`;
}

/**
 * Replaces all Unicode emojis in text with Twemoji img tags.
 * Preserves all other text and handles complex emojis correctly.
 * Includes BMP emoji, variation selectors, and surrogate pairs.
 *
 * @warning SECURITY: This function does NOT escape HTML. Only use with
 * trusted plain text, or combine with HTML escaping. For user-generated
 * content, use `replaceEmojisInPlainText` from `emoji.ts` instead.
 *
 * @param text - Text containing Unicode emojis
 * @returns HTML string with emojis replaced by img tags
 */
export function replaceUnicodeEmojisWithImages(text: string): string {
    if (!text) {
        return '';
    }

    const emojis = parse(text, { assetType: 'svg' });
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
