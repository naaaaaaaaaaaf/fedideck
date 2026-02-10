import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRestAPIClient } from 'masto';
import { exchangeCodeForToken, revokeToken, verifyCredentials } from './oauthOob';

vi.mock('masto', () => ({
    createRestAPIClient: vi.fn(),
}));

describe('oauthOob', () => {
    const mockedCreateRestAPIClient = vi.mocked(createRestAPIClient);
    const credentials = {
        clientId: 'client-id',
        clientSecret: 'client-secret',
        instanceUrl: 'https://example.com',
    };

    afterEach(() => {
        mockedCreateRestAPIClient.mockReset();
        vi.unstubAllGlobals();
    });

    it('exchanges authorization code for access token', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({
                access_token: 'token',
                token_type: 'Bearer',
                scope: 'read write',
                created_at: 123,
            }),
        });
        vi.stubGlobal('fetch', fetchMock);

        const result = await exchangeCodeForToken(credentials, '  code ');

        expect(fetchMock).toHaveBeenCalledWith(
            'https://example.com/oauth/token',
            expect.objectContaining({
                method: 'POST',
            })
        );
        expect(result).toEqual({
            accessToken: 'token',
            tokenType: 'Bearer',
            scope: 'read write',
            createdAt: 123,
        });
    });

    it('throws a descriptive error when token exchange fails', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: false,
            json: vi.fn().mockResolvedValue({
                error_description: 'invalid code',
            }),
        });
        vi.stubGlobal('fetch', fetchMock);

        await expect(exchangeCodeForToken(credentials, 'bad')).rejects.toThrow('invalid code');
    });

    it('verifies credentials with the REST client', async () => {
        const verifyCredentialsMock = vi.fn().mockResolvedValue({ id: 'account-id' });
        mockedCreateRestAPIClient.mockReturnValue({
            v1: {
                accounts: {
                    verifyCredentials: verifyCredentialsMock,
                },
            },
        } as never);

        const result = await verifyCredentials('https://example.com', 'token');

        expect(mockedCreateRestAPIClient).toHaveBeenCalledWith({
            url: 'https://example.com',
            accessToken: 'token',
        });
        expect(result).toEqual({ id: 'account-id' });
    });

    it('logs an error when revoke fails', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: false });
        vi.stubGlobal('fetch', fetchMock);
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        try {
            await revokeToken(credentials, 'token');

            expect(fetchMock).toHaveBeenCalledWith(
                'https://example.com/oauth/revoke',
                expect.any(Object)
            );
            expect(consoleSpy).toHaveBeenCalledWith('Failed to revoke token');
        } finally {
            consoleSpy.mockRestore();
        }
    });
});
