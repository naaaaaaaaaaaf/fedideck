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

/**
 * Parameters for creating a poll
 */
export interface PollParams {
    options: string[];
    expiresIn: number;
    multiple?: boolean;
    hideTotals?: boolean;
}

/**
 * Parameters for creating a new status
 */
export interface CreateStatusParams {
    status: string;
    visibility?: 'public' | 'unlisted' | 'private' | 'direct';
    spoilerText?: string;
    inReplyToId?: string;
    sensitive?: boolean;
    language?: string;
    mediaIds?: string[];
    poll?: PollParams;
}

/**
 * Create a new status (post/toot)
 */
export async function createStatus(
    client: MastoClient,
    params: CreateStatusParams
): Promise<mastodon.v1.Status> {
    // Build params conditionally to satisfy masto.js types
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createParams: any = {
        status: params.status,
    };

    if (params.visibility) createParams.visibility = params.visibility;
    if (params.spoilerText) createParams.spoilerText = params.spoilerText;
    if (params.inReplyToId) createParams.inReplyToId = params.inReplyToId;
    if (params.sensitive !== undefined) createParams.sensitive = params.sensitive;
    if (params.language) createParams.language = params.language;
    if (params.mediaIds && params.mediaIds.length > 0) createParams.mediaIds = params.mediaIds;
    if (params.poll) createParams.poll = params.poll;

    const status = await client.v1.statuses.create(createParams);
    return status;
}

/**
 * Upload a media attachment
 */
export async function uploadMedia(
    client: MastoClient,
    file: File,
    description?: string
): Promise<mastodon.v1.MediaAttachment> {
    const params: { file: File; description?: string } = { file };

    // Only include description if it has a value
    if (description && description.trim().length > 0) {
        params.description = description.trim();
    }

    const media = await client.v2.media.create(params);
    return media;
}

/**
 * Update media attachment description (alt text)
 */
export async function updateMediaDescription(
    client: MastoClient,
    mediaId: string,
    description: string
): Promise<mastodon.v1.MediaAttachment> {
    const media = await client.v1.media.$select(mediaId).update({
        description,
    });
    return media;
}

/**
 * Favourite a status (add to favorites)
 */
export async function favouriteStatus(
    client: MastoClient,
    statusId: string
): Promise<mastodon.v1.Status> {
    const status = await client.v1.statuses.$select(statusId).favourite();
    return status;
}

/**
 * Unfavourite a status (remove from favorites)
 */
export async function unfavouriteStatus(
    client: MastoClient,
    statusId: string
): Promise<mastodon.v1.Status> {
    const status = await client.v1.statuses.$select(statusId).unfavourite();
    return status;
}

/**
 * Reblog a status (boost)
 */
export async function reblogStatus(
    client: MastoClient,
    statusId: string
): Promise<mastodon.v1.Status> {
    const status = await client.v1.statuses.$select(statusId).reblog();
    return status;
}

/**
 * Unreblog a status (remove boost)
 */
export async function unreblogStatus(
    client: MastoClient,
    statusId: string
): Promise<mastodon.v1.Status> {
    const status = await client.v1.statuses.$select(statusId).unreblog();
    return status;
}
