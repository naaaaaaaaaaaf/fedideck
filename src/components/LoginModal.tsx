import { useState, useRef } from 'react';
import { LuX } from 'react-icons/lu';
import { registerApp, getAuthorizationUrl } from '../auth/appRegistration';
import { exchangeCodeForToken, verifyCredentials } from '../auth/oauthOob';
import { createSession } from '../auth/sessions';
import { useAccountsStore } from '../store/accounts';
import { useModalAccessibility } from '../hooks/useModalAccessibility';

interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
    canClose?: boolean;
}

type Step = 'instance' | 'authorize' | 'code';

export function LoginModal({ isOpen, onClose, canClose = true }: LoginModalProps) {
    const [step, setStep] = useState<Step>('instance');
    const [instanceUrl, setInstanceUrl] = useState('');
    const [authUrl, setAuthUrl] = useState('');
    const [code, setCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const modalRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);

    const addAccount = useAccountsStore(state => state.addAccount);

    const { handleKeyDown } = useModalAccessibility({
        isOpen,
        onClose,
        closeButtonRef,
        modalRef,
        canClose,
    });

    const handleInstanceSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            // Normalize URL
            let url = instanceUrl.trim();
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                url = 'https://' + url;
            }
            url = url.replace(/\/+$/, '');

            const credentials = await registerApp(url);
            const authorizationUrl = getAuthorizationUrl(credentials);

            setAuthUrl(authorizationUrl);
            setInstanceUrl(url);
            setStep('authorize');

            // Open authorization URL in new tab
            window.open(authorizationUrl, '_blank');
        } catch (err) {
            setError((err as Error).message || 'インスタンスへの接続に失敗しました');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCodeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const credentials = await registerApp(instanceUrl);
            const token = await exchangeCodeForToken(credentials, code);
            const account = await verifyCredentials(instanceUrl, token.accessToken);

            const session = createSession(instanceUrl, token.accessToken, account);
            addAccount(session);

            // Reset and close
            setStep('instance');
            setInstanceUrl('');
            setCode('');
            onClose();
        } catch (err) {
            setError((err as Error).message || '認証に失敗しました');
        } finally {
            setIsLoading(false);
        }
    };

    const handleBack = () => {
        setStep('instance');
        setError('');
    };

    if (!isOpen) return null;

    const getTitle = () => {
        switch (step) {
            case 'instance':
                return 'アカウントを追加';
            case 'authorize':
                return '認証';
            case 'code':
                return '認証コードを入力';
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onKeyDown={handleKeyDown}
            role="dialog"
            aria-modal="true"
            aria-labelledby="login-modal-title"
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={canClose ? onClose : undefined}
                aria-hidden="true"
            />

            {/* Modal */}
            <div
                ref={modalRef}
                className="relative w-full max-w-md bg-slate-800 rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
                    <h2 id="login-modal-title" className="text-lg font-semibold text-slate-100">
                        {getTitle()}
                    </h2>
                    {canClose && (
                        <button
                            ref={closeButtonRef}
                            onClick={onClose}
                            className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-slate-200"
                            aria-label="閉じる"
                            title="閉じる"
                        >
                            <LuX className="w-5 h-5" aria-hidden="true" />
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="p-6">
                    {error && (
                        <div className="mb-4 p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300 text-sm" role="alert">
                            {error}
                        </div>
                    )}

                    {/* Step 1: Instance URL */}
                    {step === 'instance' && (
                        <form onSubmit={handleInstanceSubmit}>
                            <label htmlFor="instance-url-input" className="block text-sm text-slate-300 mb-2">
                                インスタンスURL
                            </label>
                            <input
                                id="instance-url-input"
                                type="text"
                                value={instanceUrl}
                                onChange={(e) => setInstanceUrl(e.target.value)}
                                placeholder="mastodon.social"
                                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                                disabled={isLoading}
                                autoFocus
                            />
                            <p className="mt-2 text-xs text-slate-400">
                                例: mastodon.social, mstdn.jp, pawoo.net
                            </p>
                            <button
                                type="submit"
                                disabled={!instanceUrl.trim() || isLoading}
                                className="w-full mt-4 px-4 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg font-medium transition-colors"
                            >
                                {isLoading ? '接続中...' : '次へ'}
                            </button>
                        </form>
                    )}

                    {/* Step 2: Authorization */}
                    {step === 'authorize' && (
                        <div>
                            <p className="text-slate-300 mb-4">
                                新しいタブで認証ページが開きました。ログインして認証を許可し、表示されたコードをコピーしてください。
                            </p>

                            <div className="p-3 bg-slate-900/50 rounded-lg mb-4">
                                <p className="text-xs text-slate-400 mb-1">認証URL</p>
                                <a
                                    href={authUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-indigo-400 hover:text-indigo-300 break-all"
                                >
                                    {authUrl}
                                </a>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={handleBack}
                                    className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors"
                                >
                                    戻る
                                </button>
                                <button
                                    onClick={() => setStep('code')}
                                    className="flex-1 px-4 py-3 bg-indigo-500 hover:bg-indigo-600 rounded-lg font-medium transition-colors"
                                >
                                    コードを入力
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Enter code */}
                    {step === 'code' && (
                        <form onSubmit={handleCodeSubmit}>
                            <label htmlFor="auth-code-input" className="block text-sm text-slate-300 mb-2">
                                認証コード
                            </label>
                            <input
                                id="auth-code-input"
                                type="text"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                placeholder="認証コードを貼り付け"
                                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                                disabled={isLoading}
                                autoFocus
                            />
                            <div className="flex gap-2 mt-4">
                                <button
                                    type="button"
                                    onClick={() => setStep('authorize')}
                                    className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors"
                                    disabled={isLoading}
                                >
                                    戻る
                                </button>
                                <button
                                    type="submit"
                                    disabled={!code.trim() || isLoading}
                                    className="flex-1 px-4 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg font-medium transition-colors"
                                >
                                    {isLoading ? '認証中...' : 'ログイン'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
