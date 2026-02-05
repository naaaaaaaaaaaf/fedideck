import type { mastodon } from 'masto';
import { Column } from './Column';
import { LuPlus, LuList } from 'react-icons/lu';
import { SiMastodon } from 'react-icons/si';
import { useColumnsStore } from '../store/columns';
import { useAccountsStore } from '../store/accounts';
import type { ImageViewerImage } from '../components/ImageViewer';

interface ColumnContainerProps {
    onAddColumn?: () => void;
    onReply?: (status: mastodon.v1.Status, accountSessionId: string) => void;
    onStatusClick?: (status: mastodon.v1.Status, accountSessionId: string) => void;
    onImageClick?: (images: ImageViewerImage[], index: number) => void;
    onAccountClick?: (account: mastodon.v1.Account, accountSessionId: string | undefined) => void;
    onNsfwReveal?: (statusId: string) => void;
}

export function ColumnContainer({
    onAddColumn,
    onReply,
    onStatusClick,
    onImageClick,
    onAccountClick,
    onNsfwReveal,
}: ColumnContainerProps) {
    const columns = useColumnsStore((state) => state.columns);
    const removeColumn = useColumnsStore((state) => state.removeColumn);
    const activeAccountId = useAccountsStore((state) => state.activeAccountId);
    const accounts = useAccountsStore((state) => state.accounts);

    // Filter columns for accounts that exist
    const validColumns = columns.filter((col) => accounts.some((acc) => acc.id === col.accountId));

    return (
        <div className="flex-1 flex overflow-x-auto">
            {/* Columns */}
            {validColumns.map((column) => (
                <Column
                    key={column.id}
                    id={column.id}
                    accountId={column.accountId}
                    stream={column.stream}
                    onRemove={() => removeColumn(column.id)}
                    onReply={onReply}
                    onStatusClick={onStatusClick}
                    onImageClick={onImageClick}
                    onAccountClick={onAccountClick}
                    onNsfwReveal={onNsfwReveal}
                />
            ))}

            {/* Add column button */}
            {activeAccountId && (
                <div className="flex items-center justify-center w-20 shrink-0 bg-slate-900/30">
                    <button
                        onClick={onAddColumn}
                        className="w-12 h-12 rounded-xl bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 hover:border-slate-600 text-slate-400 hover:text-slate-200 text-2xl transition-all duration-200 hover:scale-105"
                        title="カラムを追加"
                    >
                        <LuPlus />
                    </button>
                </div>
            )}

            {/* Empty state when no columns and no accounts */}
            {!validColumns.length && !accounts.length && (
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center text-slate-400">
                        <SiMastodon className="text-6xl mb-4" />
                        <h2 className="text-xl font-semibold text-slate-200 mb-2">
                            FediDeckへようこそ
                        </h2>
                        <p className="mb-4">まずはアカウントを追加してください</p>
                    </div>
                </div>
            )}

            {/* Empty state when has account but no columns */}
            {!validColumns.length && accounts.length > 0 && (
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center text-slate-400">
                        <LuList className="text-6xl mb-4" />
                        <h2 className="text-xl font-semibold text-slate-200 mb-2">
                            カラムがありません
                        </h2>
                        <p className="mb-4">+ボタンからカラムを追加してください</p>
                    </div>
                </div>
            )}
        </div>
    );
}
