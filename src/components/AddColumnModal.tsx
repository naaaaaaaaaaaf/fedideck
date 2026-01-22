import { useState, type ReactNode } from 'react';
import { LuHouse, LuBell, LuUsers, LuGlobe, LuX, LuChevronDown } from 'react-icons/lu';
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

    // State for selected account - initialized with activeAccountId or first account
    // Component is remounted when modal opens (via key prop), so initial values are recalculated
    const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
        activeAccountId ?? accounts[0]?.id ?? null
    );
    const [showAccountSelector, setShowAccountSelector] = useState(false);

    const selectedAccount = accounts.find(a => a.id === selectedAccountId);

    const handleAddColumn = (type: StreamType) => {
        if (!selectedAccountId) return;

        addColumn({
            accountId: selectedAccountId,
            stream: { type },
        });

        onClose();
    };

    if (!isOpen) return null;

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

                {/* Account selector */}
                {selectedAccount && (
                    <div className="px-6 py-3 bg-slate-900/30 border-b border-slate-700/30 relative">
                        <button
                            onClick={() => setShowAccountSelector(!showAccountSelector)}
                            className="flex items-center gap-3 w-full text-left hover:bg-slate-700/30 -mx-3 px-3 py-2 rounded-lg transition-colors"
                        >
                            <img
                                src={selectedAccount.account.avatar}
                                alt=""
                                className="w-8 h-8 rounded-lg"
                            />
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium text-slate-200 truncate">
                                    {selectedAccount.account.displayName || selectedAccount.account.username}
                                </div>
                                <div className="text-xs text-slate-400 truncate">
                                    @{selectedAccount.account.acct}@{new URL(selectedAccount.instanceUrl).hostname}
                                </div>
                            </div>
                            {accounts.length > 1 && (
                                <LuChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showAccountSelector ? 'rotate-180' : ''}`} />
                            )}
                        </button>

                        {/* Account dropdown */}
                        {showAccountSelector && accounts.length > 1 && (
                            <div className="absolute left-4 right-4 top-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-10 overflow-hidden">
                                {accounts.map(acc => (
                                    <button
                                        key={acc.id}
                                        onClick={() => {
                                            setSelectedAccountId(acc.id);
                                            setShowAccountSelector(false);
                                        }}
                                        className={`flex items-center gap-3 p-3 w-full text-left hover:bg-slate-700/50 transition-colors ${acc.id === selectedAccountId ? 'bg-slate-700/30' : ''
                                            }`}
                                    >
                                        <img
                                            src={acc.account.avatar}
                                            alt=""
                                            className="w-8 h-8 rounded-lg"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <div className="text-sm font-medium text-slate-200 truncate">
                                                {acc.account.displayName || acc.account.username}
                                            </div>
                                            <div className="text-xs text-slate-400 truncate">
                                                @{acc.account.acct}@{new URL(acc.instanceUrl).hostname}
                                            </div>
                                        </div>
                                        {acc.id === selectedAccountId && (
                                            <div className="w-2 h-2 rounded-full bg-indigo-400"></div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
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

