/**
 * Streaming Client using native WebSocket for Mastodon Streaming API
 * 
 * masto.js streaming uses async iterators which don't fit well with React's
 * event-driven model. We use native WebSocket with masto.js types for better control.
 */

import type { mastodon } from 'masto';

export type StreamEventType = 'update' | 'delete' | 'notification' | 'status.update' | 'filters_changed';

export interface StreamEvent<T = unknown> {
    stream: string[];
    event: StreamEventType;
    payload: T;
}

export interface StreamingClientOptions {
    instanceUrl: string;
    accessToken: string;
    onUpdate?: (status: mastodon.v1.Status) => void;
    onDelete?: (statusId: string) => void;
    onNotification?: (notification: mastodon.v1.Notification) => void;
    onStatusUpdate?: (status: mastodon.v1.Status) => void;
    onConnect?: () => void;
    onDisconnect?: () => void;
    onError?: (error: Error) => void;
}

export class StreamingClient {
    private ws: WebSocket | null = null;
    private options: StreamingClientOptions;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 10;
    private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    private isIntentionallyClosed = false;
    private subscribedStreams = new Set<string>();

    constructor(options: StreamingClientOptions) {
        this.options = options;
    }

    /**
     * Get WebSocket streaming URL
     */
    private getStreamingUrl(): string {
        const url = new URL(this.options.instanceUrl);
        const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${wsProtocol}//${url.host}/api/v1/streaming?access_token=${this.options.accessToken}`;
    }

    /**
     * Connect to streaming API
     */
    connect(): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            return;
        }

        this.isIntentionallyClosed = false;

        try {
            this.ws = new WebSocket(this.getStreamingUrl());

            this.ws.onopen = () => {
                this.reconnectAttempts = 0;
                this.options.onConnect?.();

                // Re-subscribe to all streams after reconnect
                for (const stream of this.subscribedStreams) {
                    this.sendSubscribe(stream);
                }
            };

            this.ws.onmessage = (event) => {
                this.handleMessage(event.data);
            };

            this.ws.onerror = (event) => {
                console.error('WebSocket error:', event);
                this.options.onError?.(new Error('WebSocket error'));
            };

            this.ws.onclose = () => {
                this.options.onDisconnect?.();

                if (!this.isIntentionallyClosed) {
                    this.scheduleReconnect();
                }
            };
        } catch (error) {
            console.error('Failed to create WebSocket:', error);
            this.options.onError?.(error as Error);
            this.scheduleReconnect();
        }
    }

    /**
     * Schedule reconnection with exponential backoff
     */
    private scheduleReconnect(): void {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            this.options.onError?.(new Error('Max reconnection attempts reached'));
            return;
        }

        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        this.reconnectAttempts++;

        console.log(`Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);

        this.reconnectTimeout = setTimeout(() => {
            this.connect();
        }, delay);
    }

    /**
     * Handle incoming WebSocket message
     */
    private handleMessage(data: string): void {
        try {
            const event = JSON.parse(data) as StreamEvent;

            switch (event.event) {
                case 'update': {
                    const status = typeof event.payload === 'string'
                        ? JSON.parse(event.payload) as mastodon.v1.Status
                        : event.payload as mastodon.v1.Status;
                    this.options.onUpdate?.(status);
                    break;
                }
                case 'delete': {
                    const statusId = event.payload as string;
                    this.options.onDelete?.(statusId);
                    break;
                }
                case 'notification': {
                    const notification = typeof event.payload === 'string'
                        ? JSON.parse(event.payload) as mastodon.v1.Notification
                        : event.payload as mastodon.v1.Notification;
                    this.options.onNotification?.(notification);
                    break;
                }
                case 'status.update': {
                    const status = typeof event.payload === 'string'
                        ? JSON.parse(event.payload) as mastodon.v1.Status
                        : event.payload as mastodon.v1.Status;
                    this.options.onStatusUpdate?.(status);
                    break;
                }
            }
        } catch (error) {
            console.error('Failed to parse streaming message:', error);
        }
    }

    /**
     * Send subscribe message
     */
    private sendSubscribe(stream: string, params?: Record<string, string>): void {
        if (this.ws?.readyState !== WebSocket.OPEN) return;

        const message: Record<string, unknown> = {
            type: 'subscribe',
            stream,
        };

        if (params) {
            Object.assign(message, params);
        }

        this.ws.send(JSON.stringify(message));
    }

    /**
     * Send unsubscribe message
     */
    private sendUnsubscribe(stream: string): void {
        if (this.ws?.readyState !== WebSocket.OPEN) return;

        this.ws.send(JSON.stringify({
            type: 'unsubscribe',
            stream,
        }));
    }

    /**
     * Subscribe to user stream (home + notifications)
     */
    subscribeUser(): void {
        this.subscribedStreams.add('user');
        this.sendSubscribe('user');
    }

    /**
     * Subscribe to public timeline
     */
    subscribePublic(local = false): void {
        const stream = local ? 'public:local' : 'public';
        this.subscribedStreams.add(stream);
        this.sendSubscribe(stream);
    }

    /**
     * Subscribe to list timeline
     */
    subscribeList(listId: string): void {
        const stream = `list:${listId}`;
        this.subscribedStreams.add(stream);
        this.sendSubscribe('list', { list: listId });
    }

    /**
     * Subscribe to hashtag timeline
     */
    subscribeHashtag(tag: string): void {
        const stream = `hashtag:${tag}`;
        this.subscribedStreams.add(stream);
        this.sendSubscribe('hashtag', { tag });
    }

    /**
     * Unsubscribe from a stream
     */
    unsubscribe(stream: string): void {
        this.subscribedStreams.delete(stream);
        this.sendUnsubscribe(stream);
    }

    /**
     * Unsubscribe from all streams
     */
    unsubscribeAll(): void {
        for (const stream of this.subscribedStreams) {
            this.sendUnsubscribe(stream);
        }
        this.subscribedStreams.clear();
    }

    /**
     * Disconnect from streaming API
     */
    disconnect(): void {
        this.isIntentionallyClosed = true;

        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    /**
     * Check if connected
     */
    isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }
}
