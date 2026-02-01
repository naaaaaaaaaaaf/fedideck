import { describe, it, expect } from "vitest";
import { escapeHtml, escapeRegExp } from "./html";

describe("escapeHtml", () => {
  describe("basic functionality", () => {
    it("should escape ampersand & to &amp;", () => {
      expect(escapeHtml("Hello & World")).toBe("Hello &amp; World");
    });

    it("should escape less than < to &lt;", () => {
      expect(escapeHtml("1 < 2")).toBe("1 &lt; 2");
    });

    it("should escape greater than > to &gt;", () => {
      expect(escapeHtml("2 > 1")).toBe("2 &gt; 1");
    });

    it("should escape double quote \" to &quot;", () => {
      expect(escapeHtml('He said "hello"')).toBe("He said &quot;hello&quot;");
    });

    it("should escape single quote ' to &#039;", () => {
      expect(escapeHtml("It's great")).toBe("It&#039;s great");
    });
  });
});
