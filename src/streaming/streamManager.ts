import type { StreamConfig } from './streamTypes';

// Placeholder for streaming functionality
// The actual masto.js streaming API uses async iterators which require different handling
// For now, we'll stub this out and rely on REST API polling

interface StreamManagerOptions {
    onUpdate?: (accountId: string, streamKey: string, status: unknown) => void;
    onDelete?: (accountId: string, streamKey: string, statusId: string) => void;
    onNotification?: (accountId: string, notification: unknown) => void;
    onStatusUpdate?: (accountId: string, streamKey: string, status: unknown) => void;
    onReconnect?: (accountId: string) => void;
    onError?: (accountId: string, error: Error) => void;
}

// Manager options (for future use)
// Manager options stored for future streaming implementation
export let managerOptions: StreamManagerOptions = {};

/**
 * Initialize the stream manager with event handlers
 */
export function initStreamManager(options: StreamManagerOptions): void {
    managerOptions = options;
    // Store for future use
    void managerOptions;
}

/**
 * Subscribe to a stream for an account (stub for now)
 * In a full implementation, this would use masto.js async iterators
 */
export async function subscribeToStream(
    _accountId: string,
    _instanceUrl: string,
    _accessToken: string,
    _config: StreamConfig
): Promise<void> {
    // Streaming will be implemented with async iterators in a future update
    // For now, the app relies on REST API initial loads
    console.log('Streaming subscription requested (not yet implemented)');
}

/**
 * Unsubscribe from a stream
 */
export function unsubscribeFromStream(_accountId: string, _config: StreamConfig): void {
    // No-op for now
}

/**
 * Disconnect all streams for an account
 */
export function disconnectAccount(_accountId: string): void {
    // No-op for now
}

/**
 * Disconnect all streams
 */
export function disconnectAll(): void {
    // No-op for now
}

/**
 * Handle visibility change (pause/resume streams)
 */
export function handleVisibilityChange(_isVisible: boolean): void {
    // No-op for now
}
