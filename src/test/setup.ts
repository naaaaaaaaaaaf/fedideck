import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import fakeIndexedDB from 'fake-indexeddb';

// Polyfill IndexedDB for emoji-picker-element
globalThis.indexedDB = fakeIndexedDB;

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

// Suppress console errors for blocked CDN requests in tests
const originalError = console.error;
console.error = vi.fn((...args: unknown[]) => {
    const message = args[0];
    if (
        typeof message === 'string' &&
        (message.includes('Network request blocked in test environment') ||
            message.includes('emoji-picker-element'))
    ) {
        return; // Suppress CDN-related errors
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
