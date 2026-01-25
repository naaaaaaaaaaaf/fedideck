import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginModal } from './LoginModal';

const mockRegisterApp = vi.fn();
const mockGetAuthorizationUrl = vi.fn();
const mockExchangeCodeForToken = vi.fn();
const mockVerifyCredentials = vi.fn();
const mockCreateSession = vi.fn();
const mockAddAccount = vi.fn();

vi.mock('../auth/appRegistration', () => ({
    registerApp: (...args: unknown[]) => mockRegisterApp(...args),
    getAuthorizationUrl: (...args: unknown[]) => mockGetAuthorizationUrl(...args),
}));

vi.mock('../auth/oauthOob', () => ({
    exchangeCodeForToken: (...args: unknown[]) => mockExchangeCodeForToken(...args),
    verifyCredentials: (...args: unknown[]) => mockVerifyCredentials(...args),
}));

vi.mock('../auth/sessions', () => ({
    createSession: (...args: unknown[]) => mockCreateSession(...args),
}));

vi.mock('../store/accounts', () => ({
    useAccountsStore: (selector: (state: unknown) => unknown) => {
        const state = {
            addAccount: mockAddAccount,
        };
        return selector(state);
    },
}));

vi.mock('../hooks/useModalAccessibility', () => ({
    useModalAccessibility: ({ onClose, canClose }: { onClose: () => void; canClose?: boolean }) => ({
        handleKeyDown: (e: KeyboardEvent) => {
            if (e.key === 'Escape' && canClose !== false) onClose();
        },
    }),
}));

describe('LoginModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(window, 'open').mockImplementation(() => null);
    });

    describe('rendering', () => {
        it('should return null when isOpen is false', () => {
            const { container } = render(<LoginModal isOpen={false} onClose={vi.fn()} />);
            expect(container.firstChild).toBeNull();
        });

        it('should display initial step title', () => {
            render(<LoginModal isOpen={true} onClose={vi.fn()} />);
            expect(screen.getByText('アカウントを追加')).toBeInTheDocument();
        });

        it('should hide close button when canClose is false', () => {
            render(<LoginModal isOpen={true} onClose={vi.fn()} canClose={false} />);
            expect(screen.queryByLabelText('閉じる')).not.toBeInTheDocument();
        });

        it('should show close button when canClose is true', () => {
            render(<LoginModal isOpen={true} onClose={vi.fn()} canClose={true} />);
            expect(screen.getByLabelText('閉じる')).toBeInTheDocument();
        });

        it('should have dialog role and aria attributes', () => {
            render(<LoginModal isOpen={true} onClose={vi.fn()} />);
            const dialog = screen.getByRole('dialog');
            expect(dialog).toHaveAttribute('aria-modal', 'true');
            expect(dialog).toHaveAttribute('aria-labelledby', 'login-modal-title');
        });
    });

    describe('Step 1: Instance URL', () => {
        it('should disable submit button when URL is empty', () => {
            render(<LoginModal isOpen={true} onClose={vi.fn()} />);
            const button = screen.getByText('次へ');
            expect(button).toBeDisabled();
        });

        it('should enable submit button when URL is entered', async () => {
            const user = userEvent.setup();
            render(<LoginModal isOpen={true} onClose={vi.fn()} />);

            await user.type(screen.getByLabelText('インスタンスURL'), 'mastodon.social');
            expect(screen.getByText('次へ')).not.toBeDisabled();
        });

        it('should call registerApp on form submit', async () => {
            const user = userEvent.setup();
            mockRegisterApp.mockResolvedValue({ clientId: 'id', clientSecret: 'secret' });
            mockGetAuthorizationUrl.mockReturnValue('https://mastodon.social/oauth/authorize');

            render(<LoginModal isOpen={true} onClose={vi.fn()} />);

            await user.type(screen.getByLabelText('インスタンスURL'), 'mastodon.social');
            await user.click(screen.getByText('次へ'));

            await waitFor(() => {
                expect(mockRegisterApp).toHaveBeenCalledWith('https://mastodon.social');
            });
        });

        it('should auto-prepend https:// to URL', async () => {
            const user = userEvent.setup();
            mockRegisterApp.mockResolvedValue({ clientId: 'id', clientSecret: 'secret' });
            mockGetAuthorizationUrl.mockReturnValue('https://mastodon.social/oauth/authorize');

            render(<LoginModal isOpen={true} onClose={vi.fn()} />);

            await user.type(screen.getByLabelText('インスタンスURL'), 'mastodon.social');
            await user.click(screen.getByText('次へ'));

            await waitFor(() => {
                expect(mockRegisterApp).toHaveBeenCalledWith('https://mastodon.social');
            });
        });

        it('should strip trailing slashes from URL', async () => {
            const user = userEvent.setup();
            mockRegisterApp.mockResolvedValue({ clientId: 'id', clientSecret: 'secret' });
            mockGetAuthorizationUrl.mockReturnValue('https://mastodon.social/oauth/authorize');

            render(<LoginModal isOpen={true} onClose={vi.fn()} />);

            await user.type(screen.getByLabelText('インスタンスURL'), 'https://mastodon.social///');
            await user.click(screen.getByText('次へ'));

            await waitFor(() => {
                expect(mockRegisterApp).toHaveBeenCalledWith('https://mastodon.social');
            });
        });

        it('should transition to Step 2 on success and open auth URL', async () => {
            const user = userEvent.setup();
            mockRegisterApp.mockResolvedValue({ clientId: 'id', clientSecret: 'secret' });
            mockGetAuthorizationUrl.mockReturnValue('https://mastodon.social/oauth/authorize');

            render(<LoginModal isOpen={true} onClose={vi.fn()} />);

            await user.type(screen.getByLabelText('インスタンスURL'), 'mastodon.social');
            await user.click(screen.getByText('次へ'));

            await waitFor(() => {
                expect(screen.getByText('認証')).toBeInTheDocument();
            });
            expect(window.open).toHaveBeenCalledWith('https://mastodon.social/oauth/authorize', '_blank');
        });

        it('should display error on failure', async () => {
            const user = userEvent.setup();
            mockRegisterApp.mockRejectedValue(new Error('Connection failed'));

            render(<LoginModal isOpen={true} onClose={vi.fn()} />);

            await user.type(screen.getByLabelText('インスタンスURL'), 'bad.instance');
            await user.click(screen.getByText('次へ'));

            await waitFor(() => {
                expect(screen.getByRole('alert')).toHaveTextContent('Connection failed');
            });
        });
    });

    describe('Step 2: Authorization', () => {
        async function goToStep2() {
            const user = userEvent.setup();
            mockRegisterApp.mockResolvedValue({ clientId: 'id', clientSecret: 'secret' });
            mockGetAuthorizationUrl.mockReturnValue('https://mastodon.social/oauth/authorize');

            render(<LoginModal isOpen={true} onClose={vi.fn()} />);
            await user.type(screen.getByLabelText('インスタンスURL'), 'mastodon.social');
            await user.click(screen.getByText('次へ'));

            await waitFor(() => {
                expect(screen.getByText('認証')).toBeInTheDocument();
            });
            return user;
        }

        it('should display auth URL', async () => {
            await goToStep2();
            expect(screen.getByText('https://mastodon.social/oauth/authorize')).toBeInTheDocument();
        });

        it('should go back to Step 1 when back button is clicked', async () => {
            const user = await goToStep2();
            await user.click(screen.getByText('戻る'));
            expect(screen.getByText('アカウントを追加')).toBeInTheDocument();
        });

        it('should go to Step 3 when "コードを入力" is clicked', async () => {
            const user = await goToStep2();
            await user.click(screen.getByText('コードを入力'));
            expect(screen.getByText('認証コードを入力')).toBeInTheDocument();
        });
    });

    describe('Step 3: Code Input', () => {
        async function goToStep3() {
            const user = userEvent.setup();
            mockRegisterApp.mockResolvedValue({ clientId: 'id', clientSecret: 'secret' });
            mockGetAuthorizationUrl.mockReturnValue('https://mastodon.social/oauth/authorize');

            const result = render(<LoginModal isOpen={true} onClose={vi.fn()} />);
            await user.type(screen.getByLabelText('インスタンスURL'), 'mastodon.social');
            await user.click(screen.getByText('次へ'));

            await waitFor(() => {
                expect(screen.getByText('認証')).toBeInTheDocument();
            });
            await user.click(screen.getByText('コードを入力'));

            await waitFor(() => {
                expect(screen.getByText('認証コードを入力')).toBeInTheDocument();
            });
            return { user, result };
        }

        it('should disable login button when code is empty', async () => {
            await goToStep3();
            expect(screen.getByText('ログイン')).toBeDisabled();
        });

        it('should enable login button when code is entered', async () => {
            const { user } = await goToStep3();
            await user.type(screen.getByLabelText('認証コード'), 'test-code');
            expect(screen.getByText('ログイン')).not.toBeDisabled();
        });

        it('should call auth functions and onClose on successful login', async () => {
            const { user } = await goToStep3();

            mockExchangeCodeForToken.mockResolvedValue({ accessToken: 'new-token' });
            mockVerifyCredentials.mockResolvedValue({ id: '1', username: 'user' });
            mockCreateSession.mockReturnValue({ id: 'session-1' });

            await user.type(screen.getByLabelText('認証コード'), 'auth-code-123');
            await user.click(screen.getByText('ログイン'));

            await waitFor(() => {
                expect(mockRegisterApp).toHaveBeenCalled();
                expect(mockExchangeCodeForToken).toHaveBeenCalled();
                expect(mockVerifyCredentials).toHaveBeenCalled();
                expect(mockCreateSession).toHaveBeenCalled();
                expect(mockAddAccount).toHaveBeenCalled();
            });
        });

        it('should display error on login failure', async () => {
            const { user } = await goToStep3();

            mockExchangeCodeForToken.mockRejectedValue(new Error('Invalid code'));

            await user.type(screen.getByLabelText('認証コード'), 'bad-code');
            await user.click(screen.getByText('ログイン'));

            await waitFor(() => {
                expect(screen.getByRole('alert')).toHaveTextContent('Invalid code');
            });
        });
    });
});
