import type { ReactNode } from 'react';
import { LuHouse, LuBell, LuUsers, LuGlobe, LuX } from 'react-icons/lu';
import { useAccountsStore } from '../store/accounts';
import { useColumnsStore } from '../store/columns';
import type { StreamType } from '../streaming/streamTypes';

interface AddColumnModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const COLUMN_TYPES: { type: StreamType; icon: ReactNode; label: string; description: string }[] = [
    { type: 'home', icon: <LuHouse />, label: 'ホーム', description: 'フォロー中のユーザーの投稿' },
    { type: 'notifications', icon: <LuBell />, label: '通知', description: 'メンション、ブースト、お気に入りなど' },
    { type: 'public:local', icon: <LuUsers />, label: 'ローカル', description: 'このサーバーの投稿' },
    { type: 'public', icon: <LuGlobe />, label: '連合', description: 'すべての連合サーバーの投稿' },
];

export function AddColumnModal({ isOpen, onClose }: AddColumnModalProps) {
    const accounts = useAccountsStore(state => state.accounts);
    const activeAccountId = useAccountsStore(state => state.activeAccountId);
    const addColumn = useColumnsStore(state => state.addColumn);

    const handleAddColumn = (type: StreamType) => {
        if (!activeAccountId) return;

        addColumn({
            accountId: activeAccountId,
            stream: { type },
        });

        onClose();
    };

    if (!isOpen) return null;

    const activeAccount = accounts.find(a => a.id === activeAccountId);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-md bg-slate-800 rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
                    <h2 className="text-lg font-semibold text-slate-100">カラムを追加</h2>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-200 transition-colors"
                    >
                        <LuX />
                    </button>
                </div>

                {/* Account info */}
                {activeAccount && (
                    <div className="px-6 py-3 bg-slate-900/30 border-b border-slate-700/30 flex items-center gap-3">
                        <img
                            src={activeAccount.account.avatar}
                            alt=""
                            className="w-8 h-8 rounded-lg"
                        />
                        <div className="min-w-0">
                            <div className="text-sm font-medium text-slate-200 truncate">
                                {activeAccount.account.displayName || activeAccount.account.username}
                            </div>
                            <div className="text-xs text-slate-400 truncate">
                                @{activeAccount.account.acct}@{new URL(activeAccount.instanceUrl).hostname}
                            </div>
                        </div>
                    </div>
                )}

                {/* Column types */}
                <div className="p-4">
                    <div className="space-y-2">
                        {COLUMN_TYPES.map(({ type, icon, label, description }) => (
                            <button
                                key={type}
                                onClick={() => handleAddColumn(type)}
                                className="w-full flex items-center gap-4 p-4 bg-slate-900/30 hover:bg-slate-700/30 rounded-xl border border-transparent hover:border-slate-600/50 transition-all text-left"
                            >
                                <span className="text-2xl">{icon}</span>
                                <div>
                                    <div className="font-medium text-slate-100">{label}</div>
                                    <div className="text-sm text-slate-400">{description}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
