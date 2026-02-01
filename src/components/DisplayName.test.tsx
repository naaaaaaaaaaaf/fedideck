import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DisplayName } from "./DisplayName";
import type { mastodon } from "masto";

// Helper to create mock account
const createMockAccount = (
  overrides: Partial<mastodon.v1.Account> = {}
): mastodon.v1.Account => {
  const base = {
    id: "1",
    username: "testuser",
    acct: "testuser",
    displayName: "Test User",
    locked: false,
    bot: false,
    group: false,
    createdAt: new Date().toISOString(),
    note: "",
    url: "https://mastodon.social/@testuser",
    avatar: "https://example.com/avatar.png",
    avatarStatic: "https://example.com/avatar.png",
    header: "https://example.com/header.png",
    headerStatic: "https://example.com/header.png",
    followersCount: 100,
    followingCount: 50,
    statusesCount: 200,
    lastStatusAt: null,
    emojis: [],
    fields: [],
    roles: [],
    ...overrides,
  };
  return base as unknown as mastodon.v1.Account;
};

describe("DisplayName", () => {
  describe("fallback behavior", () => {
    it("should display displayName when present", () => {
      const account = createMockAccount({
        displayName: "My Display Name",
        username: "myusername",
      });

      render(<DisplayName account={account} />);

      expect(screen.getByText("My Display Name")).toBeInTheDocument();
      expect(screen.queryByText("myusername")).not.toBeInTheDocument();
    });

    it("should fall back to username when displayName is empty string", () => {
      const account = createMockAccount({
        displayName: "",
        username: "fallbackuser",
      });

      render(<DisplayName account={account} />);

      expect(screen.getByText("fallbackuser")).toBeInTheDocument();
    });

    it("should fall back to username when displayName is undefined", () => {
      const account = createMockAccount({
        username: "undefinedtest",
      });
      // @ts-expect-error Testing undefined displayName
      account.displayName = undefined;

      render(<DisplayName account={account} />);

      expect(screen.getByText("undefinedtest")).toBeInTheDocument();
    });
  });

  describe("className prop", () => {
    it("should apply className to the span element", () => {
      const account = createMockAccount({ displayName: "Test" });

      const { container } = render(
        <DisplayName account={account} className="custom-class" />
      );

      expect(container.querySelector(".custom-class")).toBeInTheDocument();
    });

    it("should work without className", () => {
      const account = createMockAccount({ displayName: "Test" });

      const { container } = render(<DisplayName account={account} />);

      expect(container.querySelector("span")).toBeInTheDocument();
    });
  });

  describe("accounts without emojis", () => {
    it("should render plain text without dangerouslySetInnerHTML", () => {
      const account = createMockAccount({
        displayName: "Plain Name",
        emojis: [],
      });

      render(<DisplayName account={account} />);

      const span = screen.getByText("Plain Name");
      // When rendered as plain text, React handles escaping
      expect(span.innerHTML).toBe("Plain Name");
    });

    it("should handle empty emojis array", () => {
      const account = createMockAccount({
        displayName: "No Emojis",
        emojis: [],
      });

      render(<DisplayName account={account} />);

      expect(screen.getByText("No Emojis")).toBeInTheDocument();
    });

    it("should handle undefined emojis", () => {
      const account = createMockAccount({
        displayName: "Undefined Emojis",
      });
      // @ts-expect-error Testing undefined emojis
      account.emojis = undefined;

      render(<DisplayName account={account} />);

      expect(screen.getByText("Undefined Emojis")).toBeInTheDocument();
    });
  });

  describe("accounts with custom emojis", () => {
    it("should replace emoji shortcodes with img tags", () => {
      const account = createMockAccount({
        displayName: "User :cat:",
        emojis: [
          {
            shortcode: "cat",
            url: "https://example.com/emojis/cat.png",
            staticUrl: "https://example.com/emojis/cat.png",
            visibleInPicker: true,
          },
        ],
      });

      const { container } = render(<DisplayName account={account} />);

      const img = container.querySelector("img.emoji");
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute("src", "https://example.com/emojis/cat.png");
      expect(img).toHaveAttribute("alt", ":cat:");
      expect(img).toHaveAttribute("title", ":cat:");
    });

    it("should handle multiple emojis", () => {
      const account = createMockAccount({
        displayName: ":star: Cool :fire: User",
        emojis: [
          {
            shortcode: "star",
            url: "https://example.com/emojis/star.png",
            staticUrl: "https://example.com/emojis/star.png",
            visibleInPicker: true,
          },
          {
            shortcode: "fire",
            url: "https://example.com/emojis/fire.png",
            staticUrl: "https://example.com/emojis/fire.png",
            visibleInPicker: true,
          },
        ],
      });

      const { container } = render(<DisplayName account={account} />);

      const imgs = container.querySelectorAll("img.emoji");
      expect(imgs).toHaveLength(2);
      expect(imgs[0]).toHaveAttribute(
        "src",
        "https://example.com/emojis/star.png"
      );
      expect(imgs[1]).toHaveAttribute(
        "src",
        "https://example.com/emojis/fire.png"
      );
    });

    it("should preserve text around emojis", () => {
      const account = createMockAccount({
        displayName: "Hello :wave: World",
        emojis: [
          {
            shortcode: "wave",
            url: "https://example.com/emojis/wave.png",
            staticUrl: "https://example.com/emojis/wave.png",
            visibleInPicker: true,
          },
        ],
      });

      const { container } = render(<DisplayName account={account} />);

      expect(container.textContent).toContain("Hello");
      expect(container.textContent).toContain("World");
    });
  });

  describe("HTML escaping (XSS prevention)", () => {
    it("should escape HTML in displayName without emojis", () => {
      const account = createMockAccount({
        displayName: '<script>alert("xss")</script>',
        emojis: [],
      });

      const { container } = render(<DisplayName account={account} />);

      // React escapes automatically for plain text rendering
      expect(container.innerHTML).not.toContain("<script>");
      expect(container.textContent).toBe('<script>alert("xss")</script>');
    });

    it("should escape HTML in displayName with emojis", () => {
      const account = createMockAccount({
        displayName: '<img src=x onerror=alert(1)> :cat:',
        emojis: [
          {
            shortcode: "cat",
            url: "https://example.com/emojis/cat.png",
            staticUrl: "https://example.com/emojis/cat.png",
            visibleInPicker: true,
          },
        ],
      });

      const { container } = render(<DisplayName account={account} />);

      // The malicious img tag should be escaped, only emoji img should exist
      const imgs = container.querySelectorAll("img");
      expect(imgs).toHaveLength(1);
      expect(imgs[0]).toHaveAttribute(
        "src",
        "https://example.com/emojis/cat.png"
      );
      // The escaped HTML should appear as text
      expect(container.textContent).toContain("<img src=x onerror=alert(1)>");
    });

    it("should escape angle brackets in displayName", () => {
      const account = createMockAccount({
        displayName: "User <Name>",
        emojis: [
          {
            shortcode: "test",
            url: "https://example.com/test.png",
            staticUrl: "https://example.com/test.png",
            visibleInPicker: true,
          },
        ],
      });

      const { container } = render(<DisplayName account={account} />);

      // Should be escaped
      expect(container.innerHTML).toContain("&lt;Name&gt;");
      expect(container.textContent).toContain("<Name>");
    });

    it("should escape ampersands in displayName", () => {
      const account = createMockAccount({
        displayName: "Tom & Jerry :cat:",
        emojis: [
          {
            shortcode: "cat",
            url: "https://example.com/cat.png",
            staticUrl: "https://example.com/cat.png",
            visibleInPicker: true,
          },
        ],
      });

      const { container } = render(<DisplayName account={account} />);

      expect(container.innerHTML).toContain("&amp;");
      expect(container.textContent).toContain("Tom & Jerry");
    });

    it("should escape quotes in displayName", () => {
      const account = createMockAccount({
        displayName: 'Say "Hello" :wave:',
        emojis: [
          {
            shortcode: "wave",
            url: "https://example.com/wave.png",
            staticUrl: "https://example.com/wave.png",
            visibleInPicker: true,
          },
        ],
      });

      const { container } = render(<DisplayName account={account} />);

      // Quotes are escaped in the HTML source but browser normalizes them in innerHTML
      // The important thing is text content is preserved correctly
      expect(container.textContent).toContain('Say "Hello"');
      // Verify only one img element (emoji) exists, no broken HTML from quotes
      expect(container.querySelectorAll("img")).toHaveLength(1);
    });
  });

  describe("emoji URL security", () => {
    it("should reject javascript: URLs in emoji", () => {
      const account = createMockAccount({
        displayName: "Evil :xss:",
        emojis: [
          {
            shortcode: "xss",
            url: "javascript:alert(1)",
            staticUrl: "javascript:alert(1)",
            visibleInPicker: true,
          },
        ],
      });

      const { container } = render(<DisplayName account={account} />);

      // Should not render an img tag with javascript: URL
      const imgs = container.querySelectorAll("img");
      expect(imgs).toHaveLength(0);
      // Should show the escaped shortcode instead
      expect(container.textContent).toContain(":xss:");
    });

    it("should reject data: URLs in emoji", () => {
      const account = createMockAccount({
        displayName: "Evil :xss:",
        emojis: [
          {
            shortcode: "xss",
            url: "data:text/html,<script>alert(1)</script>",
            staticUrl: "data:text/html,<script>alert(1)</script>",
            visibleInPicker: true,
          },
        ],
      });

      const { container } = render(<DisplayName account={account} />);

      // Should not render an img tag with data: URL
      const imgs = container.querySelectorAll("img");
      expect(imgs).toHaveLength(0);
    });

    it("should allow valid https URLs", () => {
      const account = createMockAccount({
        displayName: "Safe :emoji:",
        emojis: [
          {
            shortcode: "emoji",
            url: "https://cdn.example.com/emoji.png",
            staticUrl: "https://cdn.example.com/emoji.png",
            visibleInPicker: true,
          },
        ],
      });

      const { container } = render(<DisplayName account={account} />);

      const img = container.querySelector("img");
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute("src", "https://cdn.example.com/emoji.png");
    });

    it("should allow valid http URLs", () => {
      const account = createMockAccount({
        displayName: "HTTP :emoji:",
        emojis: [
          {
            shortcode: "emoji",
            url: "http://example.com/emoji.png",
            staticUrl: "http://example.com/emoji.png",
            visibleInPicker: true,
          },
        ],
      });

      const { container } = render(<DisplayName account={account} />);

      const img = container.querySelector("img");
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute("src", "http://example.com/emoji.png");
    });
  });

  describe("edge cases", () => {
    it("should handle emoji-like text when no emojis defined", () => {
      const account = createMockAccount({
        displayName: "User :notanemoji:",
        emojis: [],
      });

      render(<DisplayName account={account} />);

      // Should render as-is without replacement
      expect(screen.getByText("User :notanemoji:")).toBeInTheDocument();
    });

    it("should handle displayName with only emoji", () => {
      const account = createMockAccount({
        displayName: ":cat:",
        emojis: [
          {
            shortcode: "cat",
            url: "https://example.com/cat.png",
            staticUrl: "https://example.com/cat.png",
            visibleInPicker: true,
          },
        ],
      });

      const { container } = render(<DisplayName account={account} />);

      const img = container.querySelector("img.emoji");
      expect(img).toBeInTheDocument();
    });

    it("should handle shortcode that appears in text but is not in emojis array", () => {
      const account = createMockAccount({
        displayName: ":cat: and :dog:",
        emojis: [
          {
            shortcode: "cat",
            url: "https://example.com/cat.png",
            staticUrl: "https://example.com/cat.png",
            visibleInPicker: true,
          },
          // :dog: is not in the emojis array
        ],
      });

      const { container } = render(<DisplayName account={account} />);

      const imgs = container.querySelectorAll("img");
      expect(imgs).toHaveLength(1);
      expect(container.textContent).toContain(":dog:");
    });

    it("should handle special characters in shortcode", () => {
      const account = createMockAccount({
        displayName: ":cat_face:",
        emojis: [
          {
            shortcode: "cat_face",
            url: "https://example.com/cat_face.png",
            staticUrl: "https://example.com/cat_face.png",
            visibleInPicker: true,
          },
        ],
      });

      const { container } = render(<DisplayName account={account} />);

      const img = container.querySelector("img");
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute("alt", ":cat_face:");
    });
  });
});
