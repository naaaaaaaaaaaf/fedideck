import { describe, it, expect } from "vitest";
import { replaceEmojisWithImages, replaceEmojisInPlainText } from "./emoji";
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

  // Security tests for URL validation
  describe("URL security", () => {
    it("should reject javascript: URLs", () => {
      const maliciousEmoji = createEmoji("evil", "javascript:alert('xss')");
      const result = replaceEmojisWithImages(":evil:", [maliciousEmoji]);

      expect(result).not.toContain("javascript:");
      expect(result).toBe(":evil:");
    });

    it("should reject data: URLs", () => {
      const maliciousEmoji = createEmoji("evil", "data:text/html,<script>alert('xss')</script>");
      const result = replaceEmojisWithImages(":evil:", [maliciousEmoji]);

      expect(result).not.toContain("data:");
      expect(result).toBe(":evil:");
    });

    it("should allow http URLs", () => {
      const emoji = createEmoji("test", "http://example.com/emoji.png");
      const result = replaceEmojisWithImages(":test:", [emoji]);

      expect(result).toContain('src="http://example.com/emoji.png"');
    });

    it("should allow https URLs", () => {
      const emoji = createEmoji("test", "https://example.com/emoji.png");
      const result = replaceEmojisWithImages(":test:", [emoji]);

      expect(result).toContain('src="https://example.com/emoji.png"');
    });

    it("should escape HTML characters in URL", () => {
      const emoji = createEmoji("test", 'https://example.com/emoji.png?a=1&b=2');
      const result = replaceEmojisWithImages(":test:", [emoji]);

      expect(result).toContain("&amp;");
      expect(result).not.toContain('&b=2"');
    });

    it("should handle invalid URLs gracefully", () => {
      const invalidEmoji = createEmoji("broken", "not-a-valid-url");
      const result = replaceEmojisWithImages(":broken:", [invalidEmoji]);

      expect(result).toBe(":broken:");
    });
  });

  // Tests for HTML tag protection
  describe("HTML tag protection", () => {
    it("should not replace shortcodes inside HTML tag attributes", () => {
      const emojis = [createEmoji("test")];
      const html = '<a href="https://example.com/:test:/page">Link</a> :test:';
      const result = replaceEmojisWithImages(html, emojis);

      // Should replace the :test: outside the tag
      expect(result).toContain('<img class="emoji"');
      // Should NOT replace the :test: inside the href attribute
      expect(result).toContain('href="https://example.com/:test:/page"');
    });

    it("should not replace shortcodes inside img alt attributes", () => {
      const emojis = [createEmoji("emoji")];
      const html = '<img alt=":emoji:" src="x.png"> :emoji:';
      const result = replaceEmojisWithImages(html, emojis);

      // Count img tags - should have 2 (original + replacement)
      const imgCount = (result.match(/<img/g) || []).length;
      expect(imgCount).toBe(2);
      // Original alt should be preserved
      expect(result).toContain('alt=":emoji:"');
    });

    it("should replace shortcodes in text nodes between tags", () => {
      const emojis = [createEmoji("smile")];
      const html = '<p>Hello :smile: world</p>';
      const result = replaceEmojisWithImages(html, emojis);

      expect(result).toContain('<img class="emoji"');
      expect(result).toContain("<p>Hello");
      expect(result).toContain("world</p>");
    });

    it("should handle > character inside attribute values", () => {
      const emojis = [createEmoji("emoji")];
      // The > inside alt=">" should not close the tag
      const html = '<img alt=">" src=":emoji:"> :emoji:';
      const result = replaceEmojisWithImages(html, emojis);

      // Should NOT replace :emoji: inside src attribute
      expect(result).toContain('src=":emoji:"');
      // Should replace :emoji: outside the tag
      const imgCount = (result.match(/<img/g) || []).length;
      expect(imgCount).toBe(2);
    });

    it("should handle < character inside attribute values", () => {
      const emojis = [createEmoji("emoji")];
      // The < inside alt="<" should not open a new tag
      const html = '<img alt="<" src=":emoji:"> :emoji:';
      const result = replaceEmojisWithImages(html, emojis);

      // Should NOT replace :emoji: inside src attribute
      expect(result).toContain('src=":emoji:"');
      // Should replace :emoji: outside the tag
      const imgCount = (result.match(/<img/g) || []).length;
      expect(imgCount).toBe(2);
    });

    it("should handle both < and > inside attribute values", () => {
      const emojis = [createEmoji("test")];
      const html = '<a title="click > here < now" href=":test:">:test:</a>';
      const result = replaceEmojisWithImages(html, emojis);

      // Should NOT replace :test: inside href attribute
      expect(result).toContain('href=":test:"');
      // Should replace :test: in the text content
      expect(result).toContain('<img class="emoji"');
    });

    it("should handle single quotes in attributes", () => {
      const emojis = [createEmoji("emoji")];
      const html = "<img alt='>' src=':emoji:'> :emoji:";
      const result = replaceEmojisWithImages(html, emojis);

      // Should NOT replace :emoji: inside src attribute
      expect(result).toContain("src=':emoji:'");
      // Should replace :emoji: outside the tag
      const imgCount = (result.match(/<img/g) || []).length;
      expect(imgCount).toBe(2);
    });

    it("should handle mixed quotes with special characters", () => {
      const emojis = [createEmoji("emoji")];
      const html = `<a href=":emoji:" title='say ">hello<"'>:emoji:</a>`;
      const result = replaceEmojisWithImages(html, emojis);

      // Should NOT replace :emoji: inside href attribute
      expect(result).toContain('href=":emoji:"');
      // Should replace :emoji: in text content
      expect(result).toContain('<img class="emoji"');
    });

    it("should handle nested angle brackets in attributes", () => {
      const emojis = [createEmoji("test")];
      const html = '<span data-html="<b>:test:</b>">:test:</span>';
      const result = replaceEmojisWithImages(html, emojis);

      // Should NOT replace :test: inside data-html attribute
      expect(result).toContain('data-html="<b>:test:</b>"');
      // Should replace :test: in text content
      expect(result).toContain('<img class="emoji"');
    });
  });

  // Performance optimization tests
  describe("performance optimizations", () => {
    it("should return early when text has no colons", () => {
      const emojis = [createEmoji("test")];
      const text = "No colons here at all";
      const result = replaceEmojisWithImages(text, emojis);

      expect(result).toBe(text);
    });
  });
});

describe("replaceEmojisInPlainText", () => {
  it("should escape HTML in plain text before replacing emojis", () => {
    const emojis = [createEmoji("smile")];
    const result = replaceEmojisInPlainText("<script>alert('xss')</script> :smile:", emojis);

    expect(result).toContain("&lt;script&gt;");
    expect(result).toContain("&lt;/script&gt;");
    expect(result).toContain('<img class="emoji"');
    expect(result).not.toContain("<script>");
  });

  it("should replace emoji shortcodes with img tags", () => {
    const emojis = [createEmoji("heart")];
    const result = replaceEmojisInPlainText("I :heart: you", emojis);

    expect(result).toContain('<img class="emoji"');
    expect(result).toContain("I ");
    expect(result).toContain(" you");
  });

  it("should escape text when no emojis provided", () => {
    const result = replaceEmojisInPlainText("<b>Bold</b>", []);

    expect(result).toBe("&lt;b&gt;Bold&lt;/b&gt;");
  });

  it("should escape text when emojis is undefined", () => {
    const result = replaceEmojisInPlainText("<b>Bold</b>", undefined);

    expect(result).toBe("&lt;b&gt;Bold&lt;/b&gt;");
  });

  it("should return empty string for empty input", () => {
    const emojis = [createEmoji("test")];
    const result = replaceEmojisInPlainText("", emojis);

    expect(result).toBe("");
  });

  it("should return early when text has no colons", () => {
    const emojis = [createEmoji("test")];
    const result = replaceEmojisInPlainText("No colons <b>here</b>", emojis);

    expect(result).toBe("No colons &lt;b&gt;here&lt;/b&gt;");
  });

  it("should handle multiple emojis in text", () => {
    const emojis = [createEmoji("cat"), createEmoji("dog")];
    const result = replaceEmojisInPlainText(":cat: and :dog:", emojis);

    const imgCount = (result.match(/<img/g) || []).length;
    expect(imgCount).toBe(2);
  });

  it("should reject javascript URLs in plain text mode", () => {
    const maliciousEmoji = createEmoji("evil", "javascript:alert('xss')");
    const result = replaceEmojisInPlainText(":evil:", [maliciousEmoji]);

    expect(result).not.toContain("javascript:");
    expect(result).toBe(":evil:");
  });
});
