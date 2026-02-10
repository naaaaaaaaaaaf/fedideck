import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StreamingClient, type StreamingClientOptions } from './streamingClient';

// Mock WebSocket
class MockWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    url: string;
    readyState: number = MockWebSocket.CONNECTING;
    onopen: ((event: Event) => void) | null = null;
    onclose: ((event: CloseEvent) => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;

    sent: string[] = [];

    constructor(url: string) {
        this.url = url;
        instances.push(this);
    }

    send(data: string) {
        this.sent.push(data);
    }

    close() {
        this.readyState = MockWebSocket.CLOSED;
        if (this.onclose) {
            this.onclose(new Event('close') as CloseEvent);
        }
    }

    // Helper to simulate open
    simulateOpen() {
        this.readyState = MockWebSocket.OPEN;
        if (this.onopen) {
            this.onopen(new Event('open'));
        }
    }

    // Helper to simulate message
    simulateMessage(data: string) {
        if (this.onmessage) {
            this.onmessage({ data } as MessageEvent);
        }
    }

    // Helper to simulate error
    simulateError() {
        if (this.onerror) {
            this.onerror(new Event('error'));
        }
    }
}

let instances: MockWebSocket[] = [];

function getLastInstance(): MockWebSocket {
    return instances[instances.length - 1];
}

function createOptions(overrides: Partial<StreamingClientOptions> = {}): StreamingClientOptions {
    return {
        instanceUrl: 'https://mastodon.social',
        accessToken: 'test-token',
        ...overrides,
    };
}

describe('StreamingClient', () => {
    beforeEach(() => {
        instances = [];
        vi.useFakeTimers();
        vi.stubGlobal('WebSocket', MockWebSocket);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    describe('connect', () => {
        it('should construct WebSocket URL with wss for https instances', () => {
            const client = new StreamingClient(
                createOptions({
                    instanceUrl: 'https://mastodon.social',
                })
            );

            client.connect();

            const ws = getLastInstance();
            expect(ws.url).toBe('wss://mastodon.social/api/v1/streaming?access_token=test-token');
        });

        it('should construct WebSocket URL with ws for http instances', () => {
            const client = new StreamingClient(
                createOptions({
                    instanceUrl: 'http://localhost:3000',
                })
            );

            client.connect();

            const ws = getLastInstance();
            expect(ws.url).toBe('ws://localhost:3000/api/v1/streaming?access_token=test-token');
        });

        it('should not reconnect if already OPEN', () => {
            const client = new StreamingClient(createOptions());
            client.connect();
            const ws = getLastInstance();
            ws.simulateOpen();

            client.connect();

            expect(instances.length).toBe(1);
        });

        it('should call onConnect callback when connected', () => {
            const onConnect = vi.fn();
            const client = new StreamingClient(createOptions({ onConnect }));

            client.connect();
            getLastInstance().simulateOpen();

            expect(onConnect).toHaveBeenCalledTimes(1);
        });

        it('should reset reconnectAttempts on successful open, restarting backoff from 1s', () => {
            const client = new StreamingClient(createOptions());
            client.connect();

            // First disconnect -> reconnect after 1s
            getLastInstance().close();
            vi.advanceTimersByTime(1000);
            expect(instances.length).toBe(2);

            // Second disconnect -> reconnect after 2s
            getLastInstance().close();
            vi.advanceTimersByTime(2000);
            expect(instances.length).toBe(3);

            // Now simulate successful connection (this should reset reconnectAttempts)
            getLastInstance().simulateOpen();

            // Third disconnect after successful open -> should reconnect after 1s (not 4s)
            getLastInstance().close();
            vi.advanceTimersByTime(1000);
            expect(instances.length).toBe(4); // Would be 3 if not reset (waiting 4s)
        });

        it('should re-subscribe to all streams after reconnect', () => {
            const client = new StreamingClient(createOptions());
            client.connect();
            const ws1 = getLastInstance();
            ws1.simulateOpen();

            client.subscribeUser();
            client.subscribePublic();

            // Simulate disconnect and reconnect
            ws1.sent = [];
            ws1.readyState = MockWebSocket.CLOSED;
            client.connect();
            const ws2 = getLastInstance();
            ws2.simulateOpen();

            const sentMessages = ws2.sent.map((s) => JSON.parse(s));
            expect(sentMessages).toContainEqual({ type: 'subscribe', stream: 'user' });
            expect(sentMessages).toContainEqual({ type: 'subscribe', stream: 'public' });
        });
    });

    describe('disconnect', () => {
        it('should call ws.close()', () => {
            const client = new StreamingClient(createOptions());
            client.connect();
            const ws = getLastInstance();
            ws.simulateOpen();
            const closeSpy = vi.spyOn(ws, 'close');

            client.disconnect();

            expect(closeSpy).toHaveBeenCalled();
        });

        it('should not schedule reconnect after intentional disconnect', () => {
            const client = new StreamingClient(createOptions());
            client.connect();
            const ws = getLastInstance();
            ws.simulateOpen();

            client.disconnect();
            vi.advanceTimersByTime(60000);

            // Only 1 instance (no reconnect)
            expect(instances.length).toBe(1);
        });

        it('should clear reconnect timeout', () => {
            const client = new StreamingClient(createOptions());
            client.connect();
            const ws = getLastInstance();
            ws.simulateOpen();

            // Trigger close to schedule reconnect
            ws.readyState = MockWebSocket.CLOSED;
            if (ws.onclose) ws.onclose(new Event('close') as CloseEvent);

            // Now disconnect intentionally
            client.disconnect();
            vi.advanceTimersByTime(60000);

            // Only 1 instance was created (no reconnect happened)
            expect(instances.length).toBe(1);
        });
    });

    describe('scheduleReconnect', () => {
        it('should use exponential backoff (1s, 2s, 4s, ...)', () => {
            const client = new StreamingClient(createOptions());
            client.connect();

            // First disconnect -> reconnect after 1s
            getLastInstance().close();
            expect(instances.length).toBe(1);

            vi.advanceTimersByTime(1000);
            expect(instances.length).toBe(2);

            // Second disconnect -> reconnect after 2s
            getLastInstance().close();
            vi.advanceTimersByTime(1999);
            expect(instances.length).toBe(2);
            vi.advanceTimersByTime(1);
            expect(instances.length).toBe(3);

            // Third disconnect -> reconnect after 4s
            getLastInstance().close();
            vi.advanceTimersByTime(3999);
            expect(instances.length).toBe(3);
            vi.advanceTimersByTime(1);
            expect(instances.length).toBe(4);
        });

        it('should cap delay at 30 seconds', () => {
            const client = new StreamingClient(createOptions());
            client.connect();

            // Simulate multiple disconnects to reach cap
            for (let i = 0; i < 5; i++) {
                getLastInstance().close();
                vi.advanceTimersByTime(30000);
            }

            // At attempt 5, delay = min(1000 * 2^5, 30000) = 30000
            const countBefore = instances.length;
            getLastInstance().close();
            vi.advanceTimersByTime(29999);
            expect(instances.length).toBe(countBefore);
            vi.advanceTimersByTime(1);
            expect(instances.length).toBe(countBefore + 1);
        });

        it('should call onError when max reconnect attempts (10) reached', () => {
            const onError = vi.fn();
            const client = new StreamingClient(createOptions({ onError }));
            client.connect();

            // Exhaust all reconnect attempts
            for (let i = 0; i < 10; i++) {
                getLastInstance().close();
                vi.advanceTimersByTime(30000);
            }

            // 11th close should trigger onError with max attempts reached
            getLastInstance().close();

            expect(onError).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Max reconnection attempts reached',
                })
            );
        });

        it('should not reconnect if intentionally closed', () => {
            const client = new StreamingClient(createOptions());
            client.connect();
            const ws = getLastInstance();
            ws.simulateOpen();

            client.disconnect();

            // No new instances should be created
            vi.advanceTimersByTime(60000);
            expect(instances.length).toBe(1);
        });
    });

    describe('handleMessage', () => {
        it('should parse update event with string payload and call onUpdate', () => {
            const onUpdate = vi.fn();
            const client = new StreamingClient(createOptions({ onUpdate }));
            client.connect();
            getLastInstance().simulateOpen();

            const payload = { id: '1', content: '<p>hello</p>', created_at: '2024-01-01' };
            getLastInstance().simulateMessage(
                JSON.stringify({
                    event: 'update',
                    payload: JSON.stringify(payload),
                    stream: ['user'],
                })
            );

            expect(onUpdate).toHaveBeenCalledTimes(1);
            // Should convert snake_case to camelCase
            expect(onUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: '1',
                    content: '<p>hello</p>',
                    createdAt: '2024-01-01',
                })
            );
        });

        it('should handle update event with object payload directly', () => {
            const onUpdate = vi.fn();
            const client = new StreamingClient(createOptions({ onUpdate }));
            client.connect();
            getLastInstance().simulateOpen();

            const payload = { id: '2', content: '<p>world</p>' };
            getLastInstance().simulateMessage(
                JSON.stringify({
                    event: 'update',
                    payload,
                    stream: ['user'],
                })
            );

            expect(onUpdate).toHaveBeenCalledWith(payload);
        });

        it('should handle delete event and pass statusId to onDelete', () => {
            const onDelete = vi.fn();
            const client = new StreamingClient(createOptions({ onDelete }));
            client.connect();
            getLastInstance().simulateOpen();

            getLastInstance().simulateMessage(
                JSON.stringify({
                    event: 'delete',
                    payload: '12345',
                    stream: ['user'],
                })
            );

            expect(onDelete).toHaveBeenCalledWith('12345');
        });

        it('should handle notification event and call onNotification', () => {
            const onNotification = vi.fn();
            const client = new StreamingClient(createOptions({ onNotification }));
            client.connect();
            getLastInstance().simulateOpen();

            const payload = { id: '1', type: 'favourite', created_at: '2024-01-01' };
            getLastInstance().simulateMessage(
                JSON.stringify({
                    event: 'notification',
                    payload: JSON.stringify(payload),
                    stream: ['user'],
                })
            );

            expect(onNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: '1',
                    type: 'favourite',
                    createdAt: '2024-01-01',
                })
            );
        });

        it('should handle status.update event and call onStatusUpdate', () => {
            const onStatusUpdate = vi.fn();
            const client = new StreamingClient(createOptions({ onStatusUpdate }));
            client.connect();
            getLastInstance().simulateOpen();

            const payload = { id: '1', content: '<p>edited</p>', created_at: '2024-01-01' };
            getLastInstance().simulateMessage(
                JSON.stringify({
                    event: 'status.update',
                    payload: JSON.stringify(payload),
                    stream: ['user'],
                })
            );

            expect(onStatusUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: '1',
                    content: '<p>edited</p>',
                    createdAt: '2024-01-01',
                })
            );
        });

        it('should not throw on invalid JSON', () => {
            const client = new StreamingClient(createOptions());
            client.connect();
            getLastInstance().simulateOpen();

            expect(() => {
                getLastInstance().simulateMessage('invalid json{{{');
            }).not.toThrow();
        });
    });

    describe('subscriptions', () => {
        it('should subscribe to user stream', () => {
            const client = new StreamingClient(createOptions());
            client.connect();
            getLastInstance().simulateOpen();

            client.subscribeUser();

            const sent = JSON.parse(getLastInstance().sent[0]);
            expect(sent).toEqual({ type: 'subscribe', stream: 'user' });
        });

        it('should subscribe to public stream', () => {
            const client = new StreamingClient(createOptions());
            client.connect();
            getLastInstance().simulateOpen();

            client.subscribePublic(false);

            const sent = JSON.parse(getLastInstance().sent[0]);
            expect(sent).toEqual({ type: 'subscribe', stream: 'public' });
        });

        it('should subscribe to public:local stream', () => {
            const client = new StreamingClient(createOptions());
            client.connect();
            getLastInstance().simulateOpen();

            client.subscribePublic(true);

            const sent = JSON.parse(getLastInstance().sent[0]);
            expect(sent).toEqual({ type: 'subscribe', stream: 'public:local' });
        });

        it('should subscribe to list stream with params', () => {
            const client = new StreamingClient(createOptions());
            client.connect();
            getLastInstance().simulateOpen();

            client.subscribeList('42');

            const sent = JSON.parse(getLastInstance().sent[0]);
            expect(sent).toEqual({ type: 'subscribe', stream: 'list', list: '42' });
        });

        it('should subscribe to hashtag stream with params', () => {
            const client = new StreamingClient(createOptions());
            client.connect();
            getLastInstance().simulateOpen();

            client.subscribeHashtag('typescript');

            const sent = JSON.parse(getLastInstance().sent[0]);
            expect(sent).toEqual({ type: 'subscribe', stream: 'hashtag', tag: 'typescript' });
        });

        it('should unsubscribe from a stream', () => {
            const client = new StreamingClient(createOptions());
            client.connect();
            getLastInstance().simulateOpen();

            client.subscribeUser();
            client.unsubscribe('user');

            const sent = JSON.parse(getLastInstance().sent[1]);
            expect(sent).toEqual({ type: 'unsubscribe', stream: 'user' });
        });

        it('should unsubscribe from all streams', () => {
            const client = new StreamingClient(createOptions());
            client.connect();
            getLastInstance().simulateOpen();

            client.subscribeUser();
            client.subscribePublic();
            client.unsubscribeAll();

            const messages = getLastInstance().sent.map((s) => JSON.parse(s));
            const unsubscribes = messages.filter((m) => m.type === 'unsubscribe');
            expect(unsubscribes.length).toBe(2);
        });

        it('should not send if ws is not connected', () => {
            const client = new StreamingClient(createOptions());
            client.connect();
            // Don't open the connection

            client.subscribeUser();

            expect(getLastInstance().sent.length).toBe(0);
        });
    });

    describe('isConnected', () => {
        it('should return true when ws is OPEN', () => {
            const client = new StreamingClient(createOptions());
            client.connect();
            getLastInstance().simulateOpen();

            expect(client.isConnected()).toBe(true);
        });

        it('should return false when ws is CLOSED', () => {
            const client = new StreamingClient(createOptions());
            client.connect();
            getLastInstance().readyState = MockWebSocket.CLOSED;

            expect(client.isConnected()).toBe(false);
        });

        it('should return false when ws is null', () => {
            const client = new StreamingClient(createOptions());

            expect(client.isConnected()).toBe(false);
        });
    });
});
