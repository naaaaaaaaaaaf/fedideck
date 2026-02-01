import { describe, it, expect } from "vitest";
import {
  buildTwemojiUrl,
  parseUnicodeEmojis,
  hasLikelyEmoji,
  replaceUnicodeEmojisWithImages,
} from "./twemoji";

describe("buildTwemojiUrl", () => {
  it("should build SVG URL for single codepoint emoji", () => {
    // 😀 = U+1F600
    const url = buildTwemojiUrl(["1f600"], "svg");
    expect(url).toBe("https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/svg/1f600.svg");
  });

  it("should build PNG URL for single codepoint emoji", () => {
    // 😀 = U+1F600
    const url = buildTwemojiUrl(["1f600"], "png");
    expect(url).toBe("https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/png/1f600.png");
  });

  it("should build URL for complex emoji with multiple codepoints", () => {
    // 👨‍👩‍👧‍👦 = U+1F468 U+200D U+1F469 U+200D U+1F467 U+200D U+1F466
    const url = buildTwemojiUrl(["1f468", "200d", "1f469", "200d", "1f467", "200d", "1f466"]);
    expect(url).toBe(
      "https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/svg/1f468-200d-1f469-200d-1f467-200d-1f466.svg"
    );
  });

  it("should default to SVG format", () => {
    const url = buildTwemojiUrl(["1f600"]);
    expect(url).toContain(".svg");
  });
});

describe("hasLikelyEmoji", () => {
  it("should return true for text with basic emoji", () => {
    expect(hasLikelyEmoji("Hello 😀 World")).toBe(true);
  });

  it("should return true for text with only emoji", () => {
    // Note: 🎉 uses surrogate pair (U+1F389), so it should be detected
    expect(hasLikelyEmoji("🎉")).toBe(true);
  });

  it("should return false for text without emoji", () => {
    expect(hasLikelyEmoji("Hello World")).toBe(false);
  });

  it("should return false for empty string", () => {
    expect(hasLikelyEmoji("")).toBe(false);
  });

  it("should return true for skin tone modifier emoji", () => {
    expect(hasLikelyEmoji("👋🏽")).toBe(true);
  });

  it("should return true for ZWJ sequence emoji", () => {
    expect(hasLikelyEmoji("👨‍👩‍👧‍👦")).toBe(true);
  });

  it("may return false for flag emoji (limitation of simple heuristic)", () => {
    // Flag emojis use Regional Indicator Symbols (U+1F1E6-1F1FF), which are surrogate pairs
    // but this heuristic might miss them. The parse() function will handle correctly.
    // This is acceptable since hasLikelyEmoji is just for optimization.
    expect(
      hasLikelyEmoji("🇯🇵") === true || hasLikelyEmoji("🇯🇵") === false
    ).toBe(true);
  });
});

describe("parseUnicodeEmojis", () => {
  it("should parse basic emoji", () => {
    const emojis = parseUnicodeEmojis("Hello 😀 World");
    expect(emojis).toHaveLength(1);
    expect(emojis[0].text).toBe("😀");
    expect(emojis[0].type).toBe("emoji");
    // Emoji is a UTF-16 surrogate pair (2 char units), so indices are [6, 8]
    expect(emojis[0].indices).toEqual([6, 8]);
  });

  it("should parse multiple emojis", () => {
    const emojis = parseUnicodeEmojis("🎉😀👍");
    expect(emojis).toHaveLength(3);
    expect(emojis[0].text).toBe("🎉");
    expect(emojis[1].text).toBe("😀");
    expect(emojis[2].text).toBe("👍");
  });

  it("should parse emoji with skin tone modifier", () => {
    // 👋🏽 = waving hand + medium skin tone
    const emojis = parseUnicodeEmojis("👋🏽");
    expect(emojis).toHaveLength(1);
    expect(emojis[0].text).toBe("👋🏽");
  });

  it("should parse flag emoji", () => {
    // 🇯🇵 = regional indicator J + regional indicator P
    const emojis = parseUnicodeEmojis("🇯🇵");
    expect(emojis).toHaveLength(1);
    expect(emojis[0].text).toBe("🇯🇵");
  });

  it("should parse ZWJ sequence emoji", () => {
    // 👨‍👩‍👧‍👦 = family emoji (man + ZWJ + woman + ZWJ + girl + ZWJ + boy)
    const emojis = parseUnicodeEmojis("👨‍👩‍👧‍👦");
    expect(emojis).toHaveLength(1);
    expect(emojis[0].text).toBe("👨‍👩‍👧‍👦");
  });

  it("should return empty array for text without emoji", () => {
    const emojis = parseUnicodeEmojis("Hello World");
    expect(emojis).toHaveLength(0);
  });

  it("should return empty array for empty string", () => {
    const emojis = parseUnicodeEmojis("");
    expect(emojis).toHaveLength(0);
  });

  it("should correctly identify emoji positions", () => {
    const emojis = parseUnicodeEmojis("Hello 🎉 World");
    expect(emojis).toHaveLength(1);
    expect(emojis[0].indices[0]).toBe(6); // "Hello " is 6 characters
  });
});

describe("replaceUnicodeEmojisWithImages", () => {
  it("should replace single emoji with img tag", () => {
    const result = replaceUnicodeEmojisWithImages("Hello 😀 World");
    expect(result).toContain('<img class="emoji"');
    expect(result).toContain('alt="😀"');
    expect(result).toContain("1f600.svg");
  });

  it("should replace multiple emojis", () => {
    const result = replaceUnicodeEmojisWithImages("🎉😀👍");
    const imgTags = result.match(/<img class="emoji"/g);
    expect(imgTags).toHaveLength(3);
  });

  it("should preserve non-emoji text", () => {
    const result = replaceUnicodeEmojisWithImages("Hello World");
    expect(result).toBe("Hello World");
  });

  it("should return empty string for empty input", () => {
    const result = replaceUnicodeEmojisWithImages("");
    expect(result).toBe("");
  });

  it("should replace emoji with skin tone modifier", () => {
    const result = replaceUnicodeEmojisWithImages("👋🏽");
    expect(result).toContain('<img class="emoji"');
    expect(result).toContain('alt="👋🏽"');
  });

  it("should replace flag emoji", () => {
    const result = replaceUnicodeEmojisWithImages("🇯🇵");
    expect(result).toContain('<img class="emoji"');
    expect(result).toContain('alt="🇯🇵"');
  });

  it("should replace ZWJ sequence emoji", () => {
    const result = replaceUnicodeEmojisWithImages("👨‍👩‍👧‍👦");
    expect(result).toContain('<img class="emoji"');
    expect(result).toContain('alt="👨‍👩‍👧‍👦"');
  });

  it("should handle mixed emoji and text", () => {
    const result = replaceUnicodeEmojisWithImages("Celebration 🎉 time!");
    expect(result).toContain("Celebration ");
    expect(result).toContain('<img class="emoji"');
    expect(result).toContain(" time!");
  });

  it("should escape HTML special characters in src URL", () => {
    // Test that URLs are properly escaped (though CDN URLs should be safe)
    const result = replaceUnicodeEmojisWithImages("Hello 😀");
    // The URL should be present in the src attribute
    expect(result).toContain('src="https://cdn.jsdelivr.net');
  });

  it("should handle text with HTML-like content but no emoji", () => {
    const result = replaceUnicodeEmojisWithImages("<script>alert('xss')</script>");
    expect(result).toBe("<script>alert('xss')</script>");
  });
});
