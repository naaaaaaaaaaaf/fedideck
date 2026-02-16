import { LuPencil, LuPlus, LuX } from 'react-icons/lu';
import { useAccountsStore } from '../store/accounts';
import { formatAccountHandle } from '../utils/accountHandle';

interface SidebarProps {
    onAddAccount: () => void;
    onCompose: () => void;
}

export function Sidebar({ onAddAccount, onCompose }: SidebarProps) {
    const accounts = useAccountsStore((state) => state.accounts);
    const removeAccount = useAccountsStore((state) => state.removeAccount);

    return (
        <aside
            className="w-16 bg-slate-900 border-r border-slate-700/50 flex flex-col items-center py-4 gap-2"
            aria-label="サイドバー"
        >
            {/* Logo */}
            <div
                className="w-10 h-10 rounded-xl bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xl font-bold mb-2"
                aria-hidden="true"
            >
                🦣
            </div>

            {/* Compose button */}
            <button
                onClick={onCompose}
                className="w-10 h-10 rounded-xl bg-indigo-500 hover:bg-indigo-600 flex items-center justify-center text-white mb-4 transition-colors shadow-lg hover:shadow-indigo-500/30"
                aria-label="新しい投稿を作成"
                title="新しい投稿"
            >
                <LuPencil className="w-5 h-5" aria-hidden="true" />
            </button>

            {/* Account avatars */}
            <nav
                className="flex-1 flex flex-col items-center gap-2 overflow-y-auto overflow-x-hidden"
                aria-label="アカウント一覧"
            >
                {accounts.map((account) => {
                    const handle = formatAccountHandle(account);
                    return (
                        <div key={account.id} className="relative group">
                            <div
                                className="w-10 h-10 rounded-xl overflow-hidden"
                                title={handle ?? ''}
                            >
                                <img
                                    src={account.account.avatar}
                                    alt={`${account.account.displayName || account.account.username}のアバター`}
                                    className="w-full h-full object-cover"
                                />
                            </div>

                            {/* Remove button (on hover) */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm('このアカウントをログアウトしますか？')) {
                                        removeAccount(account.id);
                                    }
                                }}
                                className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                aria-label={`${account.account.displayName || account.account.username}をログアウト`}
                                title="ログアウト"
                            >
                                <LuX className="w-3 h-3" aria-hidden="true" />
                            </button>
                        </div>
                    );
                })}
            </nav>

            {/* Add account button */}
            <button
                onClick={onAddAccount}
                className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-400 hover:text-slate-200 flex items-center justify-center transition-all"
                aria-label="アカウントを追加"
                title="アカウントを追加"
            >
                <LuPlus className="w-5 h-5" aria-hidden="true" />
            </button>
        </aside>
    );
}
