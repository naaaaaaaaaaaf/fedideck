import { LuPencil } from 'react-icons/lu';
import { useAccountsStore } from '../store/accounts';

interface SidebarProps {
    onAddAccount: () => void;
    onCompose: () => void;
}

export function Sidebar({ onAddAccount, onCompose }: SidebarProps) {
    const accounts = useAccountsStore(state => state.accounts);
    const activeAccountId = useAccountsStore(state => state.activeAccountId);
    const setActiveAccount = useAccountsStore(state => state.setActiveAccount);
    const removeAccount = useAccountsStore(state => state.removeAccount);

    return (
        <aside className="w-16 bg-slate-900 border-r border-slate-700/50 flex flex-col items-center py-4 gap-2">
            {/* Logo */}
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xl font-bold mb-2">
                🦣
            </div>

            {/* Compose button */}
            <button
                onClick={onCompose}
                className="w-10 h-10 rounded-xl bg-indigo-500 hover:bg-indigo-600 flex items-center justify-center text-white mb-4 transition-colors shadow-lg hover:shadow-indigo-500/30"
                title="新しい投稿"
            >
                <LuPencil className="w-5 h-5" />
            </button>

            {/* Account avatars */}
            <div className="flex-1 flex flex-col items-center gap-2 overflow-y-auto">
                {accounts.map((account) => (
                    <div key={account.id} className="relative group">
                        <button
                            onClick={() => setActiveAccount(account.id)}
                            className={`w-10 h-10 rounded-xl overflow-hidden transition-all duration-200 ${activeAccountId === account.id
                                ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-slate-900'
                                : 'opacity-60 hover:opacity-100'
                                }`}
                            title={`@${account.account.acct}@${new URL(account.instanceUrl).hostname}`}
                        >
                            <img
                                src={account.account.avatar}
                                alt={account.account.displayName || account.account.username}
                                className="w-full h-full object-cover"
                            />
                        </button>

                        {/* Remove button (on hover) */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (confirm('このアカウントをログアウトしますか？')) {
                                    removeAccount(account.id);
                                }
                            }}
                            className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 hover:bg-red-600 rounded-full text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            title="ログアウト"
                        >
                            ×
                        </button>
                    </div>
                ))}
            </div>

            {/* Add account button */}
            <button
                onClick={onAddAccount}
                className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-400 hover:text-slate-200 text-xl transition-all"
                title="アカウントを追加"
            >
                +
            </button>
        </aside>
    );
}
