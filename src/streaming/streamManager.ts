/**
 * Stream Manager - centralized control of streaming connections
 *
 * Manages streaming clients per account, handles subscription lifecycle,
 * and coordinates with the UI through callbacks.
 */

import type { mastodon } from 'masto';
import { StreamingClient } from '../api/streamingClient';
import type { StreamConfig } from './streamTypes';

interface AccountConnection {
    client: StreamingClient;
    subscribedStreams: Set<string>;
    instanceUrl: string;
    accessToken: string;
}

interface StreamManagerCallbacks {
    onUpdate?: (accountId: string, status: mastodon.v1.Status) => void;
    onDelete?: (accountId: string, statusId: string) => void;
    onNotification?: (accountId: string, notification: mastodon.v1.Notification) => void;
    onStatusUpdate?: (accountId: string, status: mastodon.v1.Status) => void;
    onConnect?: (accountId: string) => void;
    onDisconnect?: (accountId: string) => void;
    onError?: (accountId: string, error: Error) => void;
}

// Global state
const connections = new Map<string, AccountConnection>();
let callbacks: StreamManagerCallbacks = {};
let isPageVisible = true;
let visibilityListenerBound = false;

/**
 * Initialize stream manager with callbacks
 */
export function initStreamManager(options: StreamManagerCallbacks): void {
    callbacks = options;

    // Setup visibility change listener
    if (typeof document !== 'undefined' && !visibilityListenerBound) {
        document.addEventListener('visibilitychange', handleVisibilityChange);
        visibilityListenerBound = true;
    }
}

/**
 * Get or create a streaming connection for an account
 */
function getOrCreateConnection(
    accountId: string,
    instanceUrl: string,
    accessToken: string
): AccountConnection {
    let connection = connections.get(accountId);

    if (!connection) {
        const client = new StreamingClient({
            instanceUrl,
            accessToken,
            onUpdate: (status) => callbacks.onUpdate?.(accountId, status),
            onDelete: (statusId) => callbacks.onDelete?.(accountId, statusId),
            onNotification: (notification) => callbacks.onNotification?.(accountId, notification),
            onStatusUpdate: (status) => callbacks.onStatusUpdate?.(accountId, status),
            onConnect: () => callbacks.onConnect?.(accountId),
            onDisconnect: () => callbacks.onDisconnect?.(accountId),
            onError: (error) => callbacks.onError?.(accountId, error),
        });

        connection = {
            client,
            subscribedStreams: new Set(),
            instanceUrl,
            accessToken,
        };

        connections.set(accountId, connection);
    }

    return connection;
}

/**
 * Get stream key from config
 */
function getStreamKey(config: StreamConfig): string {
    switch (config.type) {
        case 'list':
            return `list:${config.listId}`;
        case 'hashtag':
            return `hashtag:${config.hashtag}`;
        default:
            return config.type;
    }
}

/**
 * Subscribe to a stream for an account
 */
export function subscribeToStream(
    accountId: string,
    instanceUrl: string,
    accessToken: string,
    config: StreamConfig
): void {
    const connection = getOrCreateConnection(accountId, instanceUrl, accessToken);
    const streamKey = getStreamKey(config);

    // Already subscribed
    if (connection.subscribedStreams.has(streamKey)) {
        return;
    }

    // Connect if not already connected
    if (!connection.client.isConnected()) {
        connection.client.connect();
    }

    // Subscribe based on stream type
    switch (config.type) {
        case 'home':
        case 'notifications':
            // User stream covers both home and notifications
            if (!connection.subscribedStreams.has('user')) {
                connection.client.subscribeUser();
                connection.subscribedStreams.add('user');
            }
            break;
        case 'public':
            connection.client.subscribePublic(false);
            break;
        case 'public:local':
            connection.client.subscribePublic(true);
            break;
        case 'list':
            if (!config.listId) {
                return;
            }
            connection.client.subscribeList(config.listId);
            break;
        case 'hashtag':
            if (!config.hashtag) {
                return;
            }
            connection.client.subscribeHashtag(config.hashtag);
            break;
    }

    connection.subscribedStreams.add(streamKey);
}

/**
 * Unsubscribe from a stream
 */
export function unsubscribeFromStream(accountId: string, config: StreamConfig): void {
    const connection = connections.get(accountId);
    if (!connection) return;

    const streamKey = getStreamKey(config);
    connection.subscribedStreams.delete(streamKey);

    // Only unsubscribe from user stream if no home/notifications columns remain
    if (config.type === 'home' || config.type === 'notifications') {
        const hasHome = connection.subscribedStreams.has('home');
        const hasNotifications = connection.subscribedStreams.has('notifications');

        if (!hasHome && !hasNotifications) {
            connection.client.unsubscribe('user');
            connection.subscribedStreams.delete('user');
        }
    } else {
        connection.client.unsubscribe(streamKey);
    }

    // Disconnect if no more subscriptions
    if (connection.subscribedStreams.size === 0) {
        disconnectAccount(accountId);
    }
}

/**
 * Disconnect an account's streaming connection
 */
export function disconnectAccount(accountId: string): void {
    const connection = connections.get(accountId);
    if (!connection) return;

    connection.client.disconnect();
    connections.delete(accountId);
}

/**
 * Disconnect all streaming connections
 */
export function disconnectAll(): void {
    for (const [accountId] of connections) {
        disconnectAccount(accountId);
    }
}

/**
 * Handle page visibility change
 */
function handleVisibilityChange(): void {
    const wasVisible = isPageVisible;
    isPageVisible = document.visibilityState === 'visible';

    if (!wasVisible && isPageVisible) {
        // Page became visible - reconnect all
        for (const [, connection] of connections) {
            if (!connection.client.isConnected()) {
                connection.client.connect();
            }
        }
    }
}

/**
 * Check if streaming is connected for an account
 */
export function isStreamingConnected(accountId: string): boolean {
    return connections.get(accountId)?.client.isConnected() ?? false;
}
