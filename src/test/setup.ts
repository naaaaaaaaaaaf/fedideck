import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import fakeIndexedDB from 'fake-indexeddb';

// Polyfill IndexedDB for emoji-picker-element
globalThis.indexedDB = fakeIndexedDB;

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
