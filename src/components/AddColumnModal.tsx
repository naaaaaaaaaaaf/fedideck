import { useState, useRef, useEffect, type ReactNode } from 'react';
import { LuHouse, LuBell, LuUsers, LuGlobe, LuX, LuChevronDown } from 'react-icons/lu';
import { useAccountsStore } from '../store/accounts';
import { useColumnsStore } from '../store/columns';
import type { StreamType } from '../streaming/streamTypes';
import { useModalAccessibility } from '../hooks/useModalAccessibility';
import { formatAccountHandle } from '../utils/accountHandle';

interface AddColumnModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Whether this modal is the active (top-most) overlay */
    isActive?: boolean;
    zIndex?: number;
}

const COLUMN_TYPES: { type: StreamType; icon: ReactNode; label: string; description: string }[] = [
    {
        type: 'home',
        icon: <LuHouse aria-hidden="true" />,
        label: 'ホーム',
        description: 'フォロー中のユーザーの投稿',
    },
    {
        type: 'notifications',
        icon: <LuBell aria-hidden="true" />,
        label: '通知',
        description: 'メンション、ブースト、お気に入りなど',
    },
    {
        type: 'public:local',
        icon: <LuUsers aria-hidden="true" />,
        label: 'ローカル',
        description: 'このサーバーの投稿',
    },
    {
        type: 'public',
        icon: <LuGlobe aria-hidden="true" />,
        label: '連合',
        description: 'すべての連合サーバーの投稿',
    },
];

export function AddColumnModal({ isOpen, onClose, isActive = true, zIndex }: AddColumnModalProps) {
    const accounts = useAccountsStore((state) => state.accounts);
    const activeAccountId = useAccountsStore((state) => state.activeAccountId);
    const addColumn = useColumnsStore((state) => state.addColumn);

    // State for selected account - initialized with activeAccountId or first account
    // Component is remounted when modal opens (via key prop), so initial values are recalculated
    const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
        activeAccountId ?? accounts[0]?.id ?? null
    );
    const [showAccountSelector, setShowAccountSelector] = useState(false);
    const [focusedAccountIndex, setFocusedAccountIndex] = useState(0);

    const modalRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const listboxRef = useRef<HTMLDivElement>(null);

    const { handleKeyDown } = useModalAccessibility({
        isOpen,
        onClose,
        closeButtonRef,
        modalRef,
    });

    // Focus management for account selector listbox
    useEffect(() => {
        if (showAccountSelector && listboxRef.current) {
            listboxRef.current.focus();
        }
    }, [showAccountSelector]);

    const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

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
        <div
            className="fixed inset-0 flex items-center justify-center p-4"
            style={zIndex != null ? { zIndex } : undefined}
            onKeyDown={isActive ? handleKeyDown : undefined}
            role="dialog"
            aria-modal={isActive ? 'true' : undefined}
            aria-hidden={!isActive ? true : undefined}
            aria-labelledby="add-column-modal-title"
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Modal */}
            <div
                ref={modalRef}
                className="relative w-full max-w-md bg-slate-800 rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
                    <h2
                        id="add-column-modal-title"
                        className="text-lg font-semibold text-slate-100"
                    >
                        カラムを追加
                    </h2>
                    <button
                        ref={closeButtonRef}
                        onClick={onClose}
                        className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-slate-200"
                        aria-label="閉じる"
                    >
                        <LuX aria-hidden="true" />
                    </button>
                </div>

                {/* Account selector */}
                {selectedAccount && (
                    <div className="px-6 py-3 bg-slate-900/30 border-b border-slate-700/30 relative">
                        <button
                            onClick={() => {
                                const newState = !showAccountSelector;
                                setShowAccountSelector(newState);
                                if (newState) {
                                    // Reset focused index to current account when opening
                                    const currentIndex = accounts.findIndex(
                                        (a) => a.id === selectedAccountId
                                    );
                                    setFocusedAccountIndex(currentIndex >= 0 ? currentIndex : 0);
                                }
                            }}
                            className="flex items-center gap-3 w-full text-left hover:bg-slate-700/30 -mx-3 px-3 py-2 rounded-lg transition-colors"
                            aria-expanded={showAccountSelector}
                            aria-haspopup="listbox"
                            aria-label={`アカウント選択: ${selectedAccount.account.displayName || selectedAccount.account.username}`}
                        >
                            <img
                                src={selectedAccount.account.avatar}
                                alt=""
                                className="w-8 h-8 rounded-lg"
                            />
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium text-slate-200 truncate">
                                    {selectedAccount.account.displayName ||
                                        selectedAccount.account.username}
                                </div>
                                <div className="text-xs text-slate-400 truncate">
                                    {formatAccountHandle(selectedAccount)}
                                </div>
                            </div>
                            {accounts.length > 1 && (
                                <LuChevronDown
                                    className={`w-4 h-4 text-slate-400 transition-transform ${showAccountSelector ? 'rotate-180' : ''}`}
                                    aria-hidden="true"
                                />
                            )}
                        </button>

                        {/* Account dropdown */}
                        {showAccountSelector && accounts.length > 1 && (
                            <div
                                ref={listboxRef}
                                className="absolute left-4 right-4 top-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-10 overflow-hidden"
                                role="listbox"
                                aria-label="アカウント一覧"
                                aria-activedescendant={
                                    focusedAccountIndex >= 0 &&
                                    focusedAccountIndex < accounts.length &&
                                    accounts[focusedAccountIndex]?.id
                                        ? `account-option-${accounts[focusedAccountIndex].id}`
                                        : undefined
                                }
                                tabIndex={-1}
                                onKeyDown={(e) => {
                                    if (e.key === 'ArrowDown') {
                                        e.preventDefault();
                                        setFocusedAccountIndex(
                                            (prev) => (prev + 1) % accounts.length
                                        );
                                    } else if (e.key === 'ArrowUp') {
                                        e.preventDefault();
                                        setFocusedAccountIndex(
                                            (prev) => (prev - 1 + accounts.length) % accounts.length
                                        );
                                    } else if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setSelectedAccountId(accounts[focusedAccountIndex].id);
                                        setShowAccountSelector(false);
                                    } else if (e.key === 'Escape') {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setShowAccountSelector(false);
                                    } else if (e.key === 'Tab') {
                                        // Close listbox and allow Tab to move focus naturally
                                        setShowAccountSelector(false);
                                        // stopPropagation to prevent modal's focus trap from interfering
                                        e.stopPropagation();
                                    }
                                }}
                            >
                                {accounts.map((acc, index) => (
                                    <button
                                        key={acc.id}
                                        id={`account-option-${acc.id}`}
                                        onClick={() => {
                                            setSelectedAccountId(acc.id);
                                            setShowAccountSelector(false);
                                        }}
                                        className={`flex items-center gap-3 p-3 w-full text-left hover:bg-slate-700/50 transition-colors ${acc.id === selectedAccountId ? 'bg-slate-700/30' : ''} ${index === focusedAccountIndex ? 'bg-slate-700/40' : ''}
                                            }`}
                                        role="option"
                                        aria-selected={acc.id === selectedAccountId}
                                        tabIndex={-1}
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
                                                {formatAccountHandle(acc)}
                                            </div>
                                        </div>
                                        {acc.id === selectedAccountId && (
                                            <div
                                                className="w-2 h-2 rounded-full bg-indigo-400"
                                                aria-hidden="true"
                                            ></div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Column types */}
                <div className="p-4">
                    <div className="space-y-2" role="group" aria-label="カラムタイプを選択">
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
