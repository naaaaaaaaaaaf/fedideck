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

// In-memory cache for fetched statuses (to avoid duplicate fetches for ShallowQuote resolution)
const statusCache = new Map<string, mastodon.v1.Status>();

// In-flight requests map to deduplicate concurrent fetches for the same status
const inFlightStatusRequests = new Map<string, Promise<mastodon.v1.Status>>();

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
 * Wait for media processing to complete before using it in a status.
 * Audio/video files may require async processing on the server.
 *
 * @param client - Mastodon API client
 * @param mediaId - ID of the uploaded media attachment
 * @param timeoutMs - Maximum time to wait in milliseconds (default: 45000ms = 45s)
 * @param pollIntervalMs - Interval between polling attempts in milliseconds (default: 1000ms)
 * @throws Error if processing times out
 *
 * @remarks
 * When uploading audio or video via POST /api/v2/media, the server may
 * process the file asynchronously. We must poll GET /api/v1/media/:id
 * until the `url` field is populated, indicating processing is complete.
 */
export async function waitForMediaReady(
    client: MastoClient,
    mediaId: string,
    timeoutMs = 45000,
    pollIntervalMs = 1000
): Promise<void> {
    const deadline = Date.now() + timeoutMs;

    while (true) {
        const media = await client.v1.media.$select(mediaId).fetch();

        // If url is populated, processing is complete
        if (media.url) {
            return;
        }

        // Check timeout after checking media status to ensure final poll
        if (Date.now() >= deadline) {
            throw new Error(`メディア処理がタイムアウトしました (mediaId: ${mediaId})`);
        }

        // Wait before next poll
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
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

/**
 * Bookmark a status
 */
export async function bookmarkStatus(
    client: MastoClient,
    statusId: string
): Promise<mastodon.v1.Status> {
    const status = await client.v1.statuses.$select(statusId).bookmark();
    return status;
}

/**
 * Remove bookmark from a status
 */
export async function unbookmarkStatus(
    client: MastoClient,
    statusId: string
): Promise<mastodon.v1.Status> {
    const status = await client.v1.statuses.$select(statusId).unbookmark();
    return status;
}

/**
 * Context for a status containing ancestors (parent chain) and descendants (replies)
 */
export type StatusContext = mastodon.v1.Context;

/**
 * Fetch the context (ancestors and descendants) for a status
 * - ancestors: The chain of parent statuses leading up to this one
 * - descendants: All replies and nested replies to this status
 */
export async function getStatusContext(
    client: MastoClient,
    statusId: string
): Promise<StatusContext> {
    const context = await client.v1.statuses.$select(statusId).context.fetch();
    return context;
}

/**
 * Fetch a single status by ID with caching and in-flight deduplication.
 * This prevents duplicate API calls when multiple components request the same status
 * (e.g., multiple ShallowQuote cards for the same quotedStatusId).
 *
 * @param client - Mastodon API client
 * @param statusId - ID of the status to fetch
 * @returns The requested status
 */
export async function fetchStatus(
    client: MastoClient,
    statusId: string
): Promise<mastodon.v1.Status> {
    // Check cache first
    const cached = statusCache.get(statusId);
    if (cached) {
        return cached;
    }

    // Check if there's an in-flight request for this status
    const inFlight = inFlightStatusRequests.get(statusId);
    if (inFlight) {
        return inFlight;
    }

    // Create new request and store in in-flight map
    const request = client.v1.statuses.$select(statusId).fetch();
    inFlightStatusRequests.set(statusId, request);

    try {
        const status = await request;
        // Cache the result
        statusCache.set(statusId, status);
        return status;
    } finally {
        // Remove from in-flight map regardless of success/failure
        inFlightStatusRequests.delete(statusId);
    }
}

/**
 * Clear the status cache (e.g., on logout or account switch)
 */
export function clearStatusCache(): void {
    statusCache.clear();
    inFlightStatusRequests.clear();
}

/**
 * Custom emoji type matching Mastodon's CustomEmoji entity
 */
export interface CustomEmoji {
    shortcode: string;
    url: string;
    staticUrl: string;
    visibleInPicker: boolean;
    category?: string | null;
}

/**
 * Fetch instance custom emojis
 */
export async function fetchCustomEmojis(client: MastoClient): Promise<CustomEmoji[]> {
    const emojis = await client.v1.customEmojis.list();
    return emojis.map((emoji) => ({
        shortcode: emoji.shortcode,
        url: emoji.url,
        staticUrl: emoji.staticUrl,
        visibleInPicker: emoji.visibleInPicker,
        category: emoji.category ?? null,
    }));
}

/**
 * Fetch account by ID
 */
export async function fetchAccount(
    client: MastoClient,
    accountId: string
): Promise<mastodon.v1.Account> {
    const account = await client.v1.accounts.$select(accountId).fetch();
    return account;
}

/**
 * Delete a status (post)
 * Only the author of a status can delete it.
 */
export async function deleteStatus(
    client: MastoClient,
    statusId: string
): Promise<mastodon.v1.Status> {
    const status = await client.v1.statuses.$select(statusId).remove();
    return status;
}

/**
 * Status source containing raw text for editing
 * Mastodon 3.5.0+ API response from /api/v1/statuses/:id/source
 */
export interface StatusSource {
    id: string;
    text: string;
    spoilerText: string;
}

/**
 * Fetch the source of a status for editing
 * Returns raw text and spoiler text without HTML formatting
 * Mastodon 3.5.0+ only
 */
export async function getStatusSource(
    client: MastoClient,
    statusId: string
): Promise<StatusSource> {
    const source = await client.v1.statuses.$select(statusId).source.fetch();
    return source;
}

/**
 * Parameters for editing an existing status
 * Note: visibility cannot be changed after posting (Mastodon API limitation)
 */
export interface EditStatusParams {
    status: string;
    spoilerText?: string;
    sensitive?: boolean;
    language?: string;
    mediaIds?: string[];
    mediaAttributes?: Array<{ id: string; description?: string }>;
}

/**
 * Edit an existing status (Mastodon 3.5.0+)
 * Only the author of a status can edit it.
 * Note: visibility cannot be changed after posting
 */
export async function editStatus(
    client: MastoClient,
    statusId: string,
    params: EditStatusParams
): Promise<mastodon.v1.Status> {
    // Build params conditionally to satisfy masto.js types
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const editParams: any = {
        status: params.status,
    };

    if (params.spoilerText !== undefined) editParams.spoilerText = params.spoilerText;
    if (params.sensitive !== undefined) editParams.sensitive = params.sensitive;
    if (params.language !== undefined) editParams.language = params.language;
    // Allow empty array to clear all media
    if (params.mediaIds !== undefined) editParams.mediaIds = params.mediaIds;
    if (params.mediaAttributes && params.mediaAttributes.length > 0) {
        editParams.mediaAttributes = params.mediaAttributes;
    }

    const status = await client.v1.statuses.$select(statusId).update(editParams);
    return status;
}

/**
 * Vote on a poll
 * @param client - Mastodon API client
 * @param pollId - ID of the poll
 * @param choices - Array of option indices to vote for (0-based)
 * @returns Updated poll with vote results
 */
export async function votePoll(
    client: MastoClient,
    pollId: string,
    choices: readonly number[]
): Promise<mastodon.v1.Poll> {
    return client.v1.polls.$select(pollId).votes.create({ choices });
}

/**
 * Fetch a poll by ID
 * @param client - Mastodon API client
 * @param pollId - ID of the poll
 * @returns Poll with current vote counts
 */
export async function fetchPoll(client: MastoClient, pollId: string): Promise<mastodon.v1.Poll> {
    return client.v1.polls.$select(pollId).fetch();
}
