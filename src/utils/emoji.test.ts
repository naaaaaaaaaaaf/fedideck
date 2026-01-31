import { describe, it, expect } from "vitest";
import { replaceEmojisWithImages } from "./emoji";
import type { mastodon } from "masto";

const createEmoji = (
  shortcode: string,
  url?: string
): mastodon.v1.CustomEmoji => ({
  shortcode,
  url: url ?? `https://example.com/emoji/${shortcode}.png`,
  staticUrl: url ?? `https://example.com/emoji/${shortcode}.png`,
  visibleInPicker: true,
});

describe("replaceEmojisWithImages", () => {
  it("should replace a single emoji shortcode with img tag", () => {
    const emojis = [createEmoji("blobcat")];
    const result = replaceEmojisWithImages("Hello :blobcat:", emojis);

    expect(result).toBe(
      'Hello <img class="emoji" src="https://example.com/emoji/blobcat.png" alt=":blobcat:" title=":blobcat:">'
    );
  });

  it("should replace multiple different emoji shortcodes", () => {
    const emojis = [createEmoji("blobcat"), createEmoji("fire")];
    const result = replaceEmojisWithImages(
      ":blobcat: is on :fire:",
      emojis
    );

    expect(result).toContain(
      '<img class="emoji" src="https://example.com/emoji/blobcat.png"'
    );
    expect(result).toContain(
      '<img class="emoji" src="https://example.com/emoji/fire.png"'
    );
  });

  it("should replace the same emoji multiple times", () => {
    const emojis = [createEmoji("star")];
    const result = replaceEmojisWithImages(
      ":star: :star: :star:",
      emojis
    );

    const imgCount = (result.match(/<img/g) || []).length;
    expect(imgCount).toBe(3);
  });

  it("should return original text when emojis array is empty", () => {
    const result = replaceEmojisWithImages("Hello :blobcat:", []);
    expect(result).toBe("Hello :blobcat:");
  });

  it("should return original text when emojis is undefined", () => {
    const result = replaceEmojisWithImages("Hello :blobcat:", undefined);
    expect(result).toBe("Hello :blobcat:");
  });

  it("should return empty string when text is empty", () => {
    const emojis = [createEmoji("blobcat")];
    const result = replaceEmojisWithImages("", emojis);
    expect(result).toBe("");
  });

  it("should not replace unknown shortcodes", () => {
    const emojis = [createEmoji("blobcat")];
    const result = replaceEmojisWithImages(
      ":unknown: emoji :blobcat:",
      emojis
    );

    expect(result).toContain(":unknown:");
    expect(result).toContain('<img class="emoji"');
  });

  it("should handle shortcodes with underscores", () => {
    const emojis = [createEmoji("blob_cat_box")];
    const result = replaceEmojisWithImages(":blob_cat_box:", emojis);

    expect(result).toContain('alt=":blob_cat_box:"');
  });

  it("should handle shortcodes with numbers", () => {
    const emojis = [createEmoji("emoji123")];
    const result = replaceEmojisWithImages(":emoji123:", emojis);

    expect(result).toContain('alt=":emoji123:"');
  });

  it("should escape HTML in shortcodes to prevent XSS", () => {
    const maliciousEmoji: mastodon.v1.CustomEmoji = {
      shortcode: '<script>alert("xss")</script>',
      url: "https://example.com/emoji/safe.png",
      staticUrl: "https://example.com/emoji/safe.png",
      visibleInPicker: true,
    };
    const result = replaceEmojisWithImages(
      ':<script>alert("xss")</script>:',
      [maliciousEmoji]
    );

    // alt and title attributes should have escaped HTML
    expect(result).toContain("&lt;script&gt;");
    expect(result).toContain("&lt;/script&gt;");
    // Should not execute scripts via alt/title attributes
    expect(result).toContain('alt=":&lt;script&gt;');
  });

  it("should handle special regex characters in shortcodes", () => {
    const emojis = [createEmoji("emoji.test")];
    const result = replaceEmojisWithImages(":emoji.test:", emojis);

    expect(result).toContain('<img class="emoji"');
  });

  it("should not affect text without shortcode format", () => {
    const emojis = [createEmoji("blobcat")];
    const result = replaceEmojisWithImages(
      "Just text without colons",
      emojis
    );

    expect(result).toBe("Just text without colons");
  });

  it("should handle partial shortcode matches correctly", () => {
    const emojis = [createEmoji("cat")];
    const result = replaceEmojisWithImages(
      ":cat: and :category:",
      emojis
    );

    expect(result).toContain('<img class="emoji"');
    expect(result).toContain(":category:");
  });
});
