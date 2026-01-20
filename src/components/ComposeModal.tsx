import { useState } from 'react';
import { LuX, LuTriangleAlert, LuGlobe, LuLockOpen, LuLock, LuMail, LuLoader } from 'react-icons/lu';
import { useAccountsStore } from '../store/accounts';
import { getClient, createStatus, type CreateStatusParams } from '../api/mastoClient';

interface ComposeModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type Visibility = 'public' | 'unlisted' | 'private' | 'direct';

interface VisibilityOption {
    value: Visibility;
    label: string;
    description: string;
    icon: React.ReactNode;
}

const VISIBILITY_OPTIONS: VisibilityOption[] = [
    { value: 'public', label: '公開', description: '全員に表示', icon: <LuGlobe /> },
    { value: 'unlisted', label: '未収載', description: '公開タイムラインに表示しない', icon: <LuLockOpen /> },
    { value: 'private', label: 'フォロワーのみ', description: 'フォロワーにのみ表示', icon: <LuLock /> },
    { value: 'direct', label: 'ダイレクト', description: 'メンションしたユーザーにのみ表示', icon: <LuMail /> },
];

const MAX_CHARS = 500;

export function ComposeModal({ isOpen, onClose }: ComposeModalProps) {
    const [content, setContent] = useState('');
    const [visibility, setVisibility] = useState<Visibility>('public');
    const [showCW, setShowCW] = useState(false);
    const [cwText, setCwText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const activeAccount = useAccountsStore(state => state.getActiveAccount());

    const remainingChars = MAX_CHARS - content.length;
    const isOverLimit = remainingChars < 0;
    const canSubmit = content.trim().length > 0 && !isOverLimit && !isSubmitting && activeAccount;

    const handleSubmit = async () => {
        if (!canSubmit || !activeAccount) return;

        setIsSubmitting(true);
        setError(null);

        try {
            const client = getClient(activeAccount);
            const params: CreateStatusParams = {
                status: content,
                visibility,
            };

            if (showCW && cwText.trim()) {
                params.spoilerText = cwText.trim();
            }

            await createStatus(client, params);

            // Reset form and close modal on success
            setContent('');
            setCwText('');
            setShowCW(false);
            setVisibility('public');
            onClose();
        } catch (err) {
            console.error('Failed to post status:', err);
            setError(err instanceof Error ? err.message : '投稿に失敗しました');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        if (isSubmitting) return;
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={handleClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-lg mx-4 bg-slate-900 rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
                    <h2 className="text-lg font-semibold text-slate-100">新しい投稿</h2>
                    <button
                        onClick={handleClose}
                        disabled={isSubmitting}
                        className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-slate-200 disabled:opacity-50"
                    >
                        <LuX className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4">
                    {/* Account indicator */}
                    {activeAccount && (
                        <div className="flex items-center gap-2 mb-3">
                            <img
                                src={activeAccount.account.avatar}
                                alt=""
                                className="w-8 h-8 rounded-lg"
                            />
                            <div className="text-sm">
                                <div className="text-slate-200">{activeAccount.account.displayName || activeAccount.account.username}</div>
                                <div className="text-slate-400">@{activeAccount.account.acct}</div>
                            </div>
                        </div>
                    )}

                    {/* CW Toggle and Input */}
                    <div className="mb-3">
                        <button
                            onClick={() => setShowCW(!showCW)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${showCW
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
                                }`}
                        >
                            <LuTriangleAlert className="w-4 h-4" />
                            CW
                        </button>

                        {showCW && (
                            <input
                                type="text"
                                value={cwText}
                                onChange={(e) => setCwText(e.target.value)}
                                placeholder="警告文を入力..."
                                className="w-full mt-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                            />
                        )}
                    </div>

                    {/* Text area */}
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="今なにしてる？"
                        rows={6}
                        disabled={isSubmitting}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 resize-none focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
                        autoFocus
                    />

                    {/* Character count */}
                    <div className={`text-sm text-right mt-1 ${isOverLimit ? 'text-red-400' : remainingChars <= 50 ? 'text-amber-400' : 'text-slate-400'
                        }`}>
                        {remainingChars}
                    </div>

                    {/* Visibility selector */}
                    <div className="mt-3">
                        <label className="text-sm text-slate-400 mb-2 block">公開範囲</label>
                        <div className="grid grid-cols-2 gap-2">
                            {VISIBILITY_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => setVisibility(option.value)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all ${visibility === option.value
                                        ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                                        : 'bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-600'
                                        }`}
                                >
                                    <span className="text-lg">{option.icon}</span>
                                    <div>
                                        <div className="text-sm font-medium">{option.label}</div>
                                        <div className="text-xs text-slate-400">{option.description}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Error message */}
                    {error && (
                        <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-slate-700/50 bg-slate-800/50">
                    <button
                        onClick={handleClose}
                        disabled={isSubmitting}
                        className="px-4 py-2 text-slate-300 hover:text-slate-100 transition-colors disabled:opacity-50"
                    >
                        キャンセル
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        className="flex items-center gap-2 px-6 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium rounded-lg transition-colors"
                    >
                        {isSubmitting && <LuLoader className="w-4 h-4 animate-spin" />}
                        {isSubmitting ? '投稿中...' : '投稿'}
                    </button>
                </div>
            </div>
        </div>
    );
}
