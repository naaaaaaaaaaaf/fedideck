import { createRestAPIClient, type mastodon } from 'masto';

export type MastoClient = mastodon.rest.Client;

export interface AccountSession {
    id: string;
    instanceUrl: string;
    accessToken: string;
    account: mastodon.v1.Account;
}

// Cache of Mastodon REST clients per account
const clientCache = new Map<string, MastoClient>();

/**
 * Create or retrieve a cached Mastodon REST API client for an account
 */
export function getClient(session: AccountSession): MastoClient {
    const cacheKey = `${session.instanceUrl}:${session.id}`;

    let client = clientCache.get(cacheKey);
    if (!client) {
        client = createRestAPIClient({
            url: session.instanceUrl,
            accessToken: session.accessToken,
        });
        clientCache.set(cacheKey, client);
    }

    return client;
}

/**
 * Remove a client from cache (e.g., on logout)
 */
export function removeClient(session: AccountSession): void {
    const cacheKey = `${session.instanceUrl}:${session.id}`;
    clientCache.delete(cacheKey);
}

/**
 * Clear all cached clients
 */
export function clearAllClients(): void {
    clientCache.clear();
}

/**
 * Fetch home timeline
 */
export async function fetchHomeTimeline(
    client: MastoClient,
    options?: { maxId?: string; sinceId?: string; limit?: number }
): Promise<mastodon.v1.Status[]> {
    const statuses = await client.v1.timelines.home.list({
        maxId: options?.maxId,
        sinceId: options?.sinceId,
        limit: options?.limit ?? 20,
    });
    return statuses;
}

/**
 * Fetch public timeline
 */
export async function fetchPublicTimeline(
    client: MastoClient,
    options?: { local?: boolean; maxId?: string; sinceId?: string; limit?: number }
): Promise<mastodon.v1.Status[]> {
    const statuses = await client.v1.timelines.public.list({
        local: options?.local,
        maxId: options?.maxId,
        sinceId: options?.sinceId,
        limit: options?.limit ?? 20,
    });
    return statuses;
}

/**
 * Fetch notifications
 */
export async function fetchNotifications(
    client: MastoClient,
    options?: { maxId?: string; sinceId?: string; limit?: number }
): Promise<mastodon.v1.Notification[]> {
    const notifications = await client.v1.notifications.list({
        maxId: options?.maxId,
        sinceId: options?.sinceId,
        limit: options?.limit ?? 20,
    });
    return notifications;
}

/**
 * Fetch list timeline
 */
export async function fetchListTimeline(
    client: MastoClient,
    listId: string,
    options?: { maxId?: string; sinceId?: string; limit?: number }
): Promise<mastodon.v1.Status[]> {
    const statuses = await client.v1.timelines.list.$select(listId).list({
        maxId: options?.maxId,
        sinceId: options?.sinceId,
        limit: options?.limit ?? 20,
    });
    return statuses;
}

/**
 * Fetch hashtag timeline
 */
export async function fetchHashtagTimeline(
    client: MastoClient,
    hashtag: string,
    options?: { maxId?: string; sinceId?: string; limit?: number }
): Promise<mastodon.v1.Status[]> {
    const statuses = await client.v1.timelines.tag.$select(hashtag).list({
        maxId: options?.maxId,
        sinceId: options?.sinceId,
        limit: options?.limit ?? 20,
    });
    return statuses;
}
