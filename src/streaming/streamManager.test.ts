import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    disconnectAll,
    initStreamManager,
    isStreamingConnected,
    subscribeToStream,
    unsubscribeFromStream,
} from './streamManager';

class MockStreamingClient {
    static instances: MockStreamingClient[] = [];
    connect = vi.fn(() => {
        this.connected = true;
    });
    disconnect = vi.fn(() => {
        this.connected = false;
    });
    subscribeUser = vi.fn();
    subscribePublic = vi.fn();
    subscribeList = vi.fn();
    subscribeHashtag = vi.fn();
    unsubscribe = vi.fn();
    connected = false;
    options: unknown;

    constructor(options: unknown) {
        this.options = options;
        MockStreamingClient.instances.push(this);
    }

    isConnected = vi.fn(() => this.connected);
}

vi.mock('../api/streamingClient', () => ({
    StreamingClient: MockStreamingClient,
}));

describe('streamManager', () => {
    beforeEach(() => {
        MockStreamingClient.instances = [];
        initStreamManager({});
    });

    afterEach(() => {
        disconnectAll();
    });

    it('subscribes to home and notifications via user stream once', () => {
        subscribeToStream('account-1', 'https://example.com', 'token', { type: 'home' });
        subscribeToStream('account-1', 'https://example.com', 'token', { type: 'notifications' });

        const client = MockStreamingClient.instances[0];
        expect(client.connect).toHaveBeenCalledTimes(1);
        expect(client.subscribeUser).toHaveBeenCalledTimes(1);
        expect(isStreamingConnected('account-1')).toBe(true);
    });

    it('subscribes to public, list, and hashtag streams', () => {
        subscribeToStream('account-1', 'https://example.com', 'token', { type: 'public:local' });
        subscribeToStream('account-1', 'https://example.com', 'token', { type: 'list', listId: '123' });
        subscribeToStream('account-1', 'https://example.com', 'token', { type: 'hashtag', hashtag: 'fediverse' });

        const client = MockStreamingClient.instances[0];
        expect(client.subscribePublic).toHaveBeenCalledWith(true);
        expect(client.subscribeList).toHaveBeenCalledWith('123');
        expect(client.subscribeHashtag).toHaveBeenCalledWith('fediverse');
    });

    it('unsubscribes from user stream when no home or notifications remain', () => {
        subscribeToStream('account-1', 'https://example.com', 'token', { type: 'home' });
        subscribeToStream('account-1', 'https://example.com', 'token', { type: 'notifications' });

        unsubscribeFromStream('account-1', { type: 'home' });
        const client = MockStreamingClient.instances[0];
        expect(client.unsubscribe).not.toHaveBeenCalled();

        unsubscribeFromStream('account-1', { type: 'notifications' });
        expect(client.unsubscribe).toHaveBeenCalledWith('user');
        expect(client.disconnect).toHaveBeenCalled();
    });

    it('reconnects when the page becomes visible again', () => {
        let visibilityState = 'visible';
        Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            get: () => visibilityState,
        });

        subscribeToStream('account-1', 'https://example.com', 'token', { type: 'public' });
        const client = MockStreamingClient.instances[0];
        client.connected = false;
        client.connect.mockClear();

        visibilityState = 'hidden';
        document.dispatchEvent(new Event('visibilitychange'));
        visibilityState = 'visible';
        document.dispatchEvent(new Event('visibilitychange'));

        expect(client.connect).toHaveBeenCalledTimes(1);
    });
});
