import { createRestAPIClient, type mastodon } from 'masto';
import type { AppCredentials } from './appRegistration';

const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob';

export interface TokenResponse {
    accessToken: string;
    tokenType: string;
    scope: string;
    createdAt: number;
}

/**
 * Exchange authorization code for access token (OOB flow)
 */
export async function exchangeCodeForToken(
    credentials: AppCredentials,
    code: string
): Promise<TokenResponse> {
    const response = await fetch(`${credentials.instanceUrl}/oauth/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            client_id: credentials.clientId,
            client_secret: credentials.clientSecret,
            redirect_uri: REDIRECT_URI,
            grant_type: 'authorization_code',
            code: code.trim(),
        }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error_description || error.error || 'Failed to obtain access token');
    }

    const data = await response.json();

    return {
        accessToken: data.access_token,
        tokenType: data.token_type,
        scope: data.scope,
        createdAt: data.created_at,
    };
}

/**
 * Verify credentials and get account info
 */
export async function verifyCredentials(
    instanceUrl: string,
    accessToken: string
): Promise<mastodon.v1.AccountCredentials> {
    const client = createRestAPIClient({
        url: instanceUrl,
        accessToken,
    });

    return await client.v1.accounts.verifyCredentials();
}

/**
 * Revoke an access token
 */
export async function revokeToken(
    credentials: AppCredentials,
    accessToken: string
): Promise<void> {
    const response = await fetch(`${credentials.instanceUrl}/oauth/revoke`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            client_id: credentials.clientId,
            client_secret: credentials.clientSecret,
            token: accessToken,
        }),
    });

    if (!response.ok) {
        console.error('Failed to revoke token');
    }
}
