import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRestAPIClient } from 'masto';
import { getAuthorizationUrl, getStoredCredentials, registerApp } from './appRegistration';

vi.mock('masto', () => ({
    createRestAPIClient: vi.fn(),
}));

describe('appRegistration', () => {
    const mockedCreateRestAPIClient = vi.mocked(createRestAPIClient);

    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
    });

    it('returns null when no stored credentials', () => {
        expect(getStoredCredentials('https://example.com')).toBeNull();
    });

    it('returns null when stored credentials are invalid JSON', () => {
        localStorage.setItem('fedideck:app_credentials', '{invalid');
        expect(getStoredCredentials('https://example.com')).toBeNull();
    });

    it('returns stored credentials for an instance', () => {
        const credentials = {
            clientId: 'client-id',
            clientSecret: 'client-secret',
            instanceUrl: 'https://example.com',
        };
        localStorage.setItem(
            'fedideck:app_credentials',
            JSON.stringify({
                'https://example.com': credentials,
            })
        );

        expect(getStoredCredentials('https://example.com')).toEqual(credentials);
    });

    it('registers and stores credentials for a normalized instance URL', async () => {
        const create = vi.fn().mockResolvedValue({
            clientId: 'client-id',
            clientSecret: 'client-secret',
        });
        mockedCreateRestAPIClient.mockReturnValue({
            v1: {
                apps: {
                    create,
                },
            },
        } as never);

        const result = await registerApp('https://example.com///');

        expect(mockedCreateRestAPIClient).toHaveBeenCalledWith({
            url: 'https://example.com',
        });
        expect(result).toEqual({
            clientId: 'client-id',
            clientSecret: 'client-secret',
            instanceUrl: 'https://example.com',
        });

        const stored = JSON.parse(localStorage.getItem('fedideck:app_credentials') ?? '{}');
        expect(stored['https://example.com']).toEqual(result);
    });

    it('returns cached credentials when available', async () => {
        const credentials = {
            clientId: 'client-id',
            clientSecret: 'client-secret',
            instanceUrl: 'https://example.com',
        };
        localStorage.setItem(
            'fedideck:app_credentials',
            JSON.stringify({
                'https://example.com': credentials,
            })
        );

        const result = await registerApp('https://example.com');

        expect(result).toEqual(credentials);
        expect(mockedCreateRestAPIClient).not.toHaveBeenCalled();
    });

    it('throws when registration response is missing credentials', async () => {
        const create = vi.fn().mockResolvedValue({});
        mockedCreateRestAPIClient.mockReturnValue({
            v1: {
                apps: {
                    create,
                },
            },
        } as never);

        await expect(registerApp('https://example.com')).rejects.toThrow(
            'Failed to register application: missing client credentials'
        );
    });

    it('builds the authorization URL with expected parameters', () => {
        const url = getAuthorizationUrl({
            clientId: 'client-id',
            clientSecret: 'client-secret',
            instanceUrl: 'https://example.com',
        });

        expect(url).toContain('https://example.com/oauth/authorize');
        expect(url).toContain('client_id=client-id');
        expect(url).toContain('response_type=code');
        expect(url).toContain('redirect_uri=urn%3Aietf%3Awg%3Aoauth%3A2.0%3Aoob');
        expect(url).toContain('scope=read+write+follow+push');
    });
});
