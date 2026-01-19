import { createRestAPIClient } from 'masto';

const APP_NAME = 'FediDeck';
const SCOPES = 'read write follow push';
const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob';

export interface AppCredentials {
    clientId: string;
    clientSecret: string;
    instanceUrl: string;
}

const STORAGE_KEY = 'fedideck:app_credentials';

/**
 * Get stored app credentials for an instance
 */
export function getStoredCredentials(instanceUrl: string): AppCredentials | null {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return null;

        const allCredentials: Record<string, AppCredentials> = JSON.parse(stored);
        return allCredentials[instanceUrl] || null;
    } catch {
        return null;
    }
}

/**
 * Store app credentials for an instance
 */
function storeCredentials(credentials: AppCredentials): void {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const allCredentials: Record<string, AppCredentials> = stored ? JSON.parse(stored) : {};
        allCredentials[credentials.instanceUrl] = credentials;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allCredentials));
    } catch (e) {
        console.error('Failed to store app credentials:', e);
    }
}

/**
 * Register the application with a Mastodon instance
 * Returns cached credentials if already registered
 */
export async function registerApp(instanceUrl: string): Promise<AppCredentials> {
    // Normalize URL
    const normalizedUrl = instanceUrl.replace(/\/+$/, '');

    // Check for cached credentials
    const cached = getStoredCredentials(normalizedUrl);
    if (cached) {
        return cached;
    }

    // Create a temporary client without auth for registration
    const client = createRestAPIClient({ url: normalizedUrl });

    // Register the application
    const app = await client.v1.apps.create({
        clientName: APP_NAME,
        redirectUris: REDIRECT_URI,
        scopes: SCOPES,
        website: 'https://github.com/example/fedideck',
    });

    if (!app.clientId || !app.clientSecret) {
        throw new Error('Failed to register application: missing client credentials');
    }

    const credentials: AppCredentials = {
        clientId: app.clientId,
        clientSecret: app.clientSecret,
        instanceUrl: normalizedUrl,
    };

    storeCredentials(credentials);
    return credentials;
}

/**
 * Get the OAuth authorization URL for OOB flow
 */
export function getAuthorizationUrl(credentials: AppCredentials): string {
    const params = new URLSearchParams({
        client_id: credentials.clientId,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: SCOPES,
    });

    return `${credentials.instanceUrl}/oauth/authorize?${params.toString()}`;
}
