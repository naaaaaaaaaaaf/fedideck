import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import fakeIndexedDB from 'fake-indexeddb';

// Polyfill IndexedDB for emoji-picker-element
globalThis.indexedDB = fakeIndexedDB;

// Provide a base IntersectionObserver mock that can be overridden by vi.stubGlobal
// This prevents "IntersectionObserver is not defined" errors in jsdom
const baseIntersectionObserver = class IntersectionObserver {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_callback: IntersectionObserverCallback, _options?: IntersectionObserverInit) {}
    observe() {}
    unobserve() {}
    disconnect() {}
    readonly root = null;
    readonly rootMargin = '';
    readonly thresholds: readonly number[] = [];
    takeRecords(): IntersectionObserverEntry[] {
        return [];
    }
};

// Set on both globalThis and window to ensure coverage in jsdom
if (!globalThis.IntersectionObserver) {
    globalThis.IntersectionObserver =
        baseIntersectionObserver as unknown as typeof IntersectionObserver;
}
if (typeof window !== 'undefined' && !window.IntersectionObserver) {
    window.IntersectionObserver =
        baseIntersectionObserver as unknown as typeof IntersectionObserver;
}

// Mock fetch to prevent emoji-picker-element from accessing CDN
// This prevents "fetch failed" errors in tests when offline
const originalFetch = globalThis.fetch;
globalThis.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

    // Block CDN requests for emoji data - make them fail silently
    // emoji-picker-element will fall back to its built-in database
    if (url.includes('cdn.jsdelivr.net') || url.includes('emoji-data')) {
        return Promise.reject(
            new TypeError('Network request blocked in test environment')
        ) as never;
    }

    // Allow other requests to pass through
    return originalFetch(input, init);
}) as typeof fetch;

// Suppress console errors for blocked CDN requests and custom emoji fetch errors in tests
const originalError = console.error;
console.error = vi.fn((...args: unknown[]) => {
    const firstArg = args[0];

    // Check if this is an error we want to suppress
    const shouldSuppress = (() => {
        // String messages
        if (typeof firstArg === 'string') {
            return (
                firstArg.includes('Network request blocked in test environment') ||
                firstArg.includes('emoji-picker-element') ||
                firstArg.includes('Failed to fetch custom emojis')
            );
        }

        // Error objects (TypeError, Error, etc.)
        if (firstArg instanceof Error) {
            return (
                firstArg.message.includes('Network request blocked in test environment') ||
                firstArg.message.includes('emoji-picker-element') ||
                firstArg.message.includes('customEmojis') ||
                firstArg.name === 'AbortError'
            );
        }

        return false;
    })();

    if (shouldSuppress) {
        return; // Suppress the error
    }

    originalError(...args);
});

// Cleanup after each test case
afterEach(() => {
    cleanup();
});

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: vi.fn((key: string) => store[key] ?? null),
        setItem: vi.fn((key: string, value: string) => {
            store[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
            delete store[key];
        }),
        clear: vi.fn(() => {
            store = {};
        }),
        get length() {
            return Object.keys(store).length;
        },
        key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    };
})();

Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
});

// Reset localStorage mock before each test
afterEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
});
