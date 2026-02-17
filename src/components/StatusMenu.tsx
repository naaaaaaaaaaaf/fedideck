import {
    useEffect,
    useRef,
    useState,
    useCallback,
    useMemo,
    useId,
    type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { LuEllipsis, LuLink, LuPencil, LuTrash2 } from 'react-icons/lu';

interface StatusMenuProps {
    statusUrl: string;
    canDelete: boolean;
    canEdit: boolean;
    onDelete: () => void;
    onEdit: () => void;
    disabled?: boolean;
    className?: string;
}

export function StatusMenu({
    statusUrl,
    canDelete,
    canEdit,
    onDelete,
    onEdit,
    disabled = false,
    className,
}: StatusMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const copySuccessTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const menuItemRefs = useRef<(HTMLButtonElement | null)[]>([]);
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const menuId = useId();

    const scheduleCopySuccessReset = useCallback(() => {
        if (copySuccessTimeoutRef.current !== null) {
            clearTimeout(copySuccessTimeoutRef.current);
        }
        copySuccessTimeoutRef.current = setTimeout(() => setCopySuccess(false), 2000);
    }, []);

    const copyToClipboard = useCallback(
        async (text: string) => {
            try {
                await navigator.clipboard.writeText(text);
                setCopySuccess(true);
                scheduleCopySuccessReset();
            } catch {
                // Fallback for older browsers
                try {
                    const textArea = document.createElement('textarea');
                    textArea.value = text;
                    textArea.style.position = 'fixed';
                    textArea.style.left = '-9999px';
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    setCopySuccess(true);
                    scheduleCopySuccessReset();
                } catch (err) {
                    console.error('Failed to copy link:', err);
                }
            }
        },
        [scheduleCopySuccessReset]
    );

    const handleCopyLink = useCallback(async () => {
        await copyToClipboard(statusUrl);
        setIsOpen(false);
    }, [statusUrl, copyToClipboard]);

    const handleDeleteClick = useCallback(() => {
        setIsOpen(false);
        onDelete();
    }, [onDelete]);

    const handleEditClick = useCallback(() => {
        setIsOpen(false);
        onEdit();
    }, [onEdit]);

    // Calculate menu items based on canDelete and canEdit
    const menuItems = useMemo(
        () => [
            {
                id: 'copy-link',
                label: copySuccess ? 'コピーしました' : 'リンクをコピー',
                icon: LuLink,
                onClick: handleCopyLink,
                danger: false,
            },
            ...(canEdit
                ? [
                      {
                          id: 'edit',
                          label: '編集',
                          icon: LuPencil,
                          onClick: handleEditClick,
                          danger: false,
                      },
                  ]
                : []),
            ...(canDelete
                ? [
                      {
                          id: 'delete',
                          label: '削除',
                          icon: LuTrash2,
                          onClick: handleDeleteClick,
                          danger: true,
                      },
                  ]
                : []),
        ],
        [copySuccess, canEdit, canDelete, handleCopyLink, handleEditClick, handleDeleteClick]
    );

    const handleClose = useCallback(() => {
        setIsOpen(false);
        setCopySuccess(false);
        setFocusedIndex(-1);
    }, []);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (copySuccessTimeoutRef.current !== null) {
                clearTimeout(copySuccessTimeoutRef.current);
            }
        };
    }, []);

    // Move DOM focus when focusedIndex changes (roving tabindex pattern)
    useEffect(() => {
        if (focusedIndex >= 0 && menuItemRefs.current[focusedIndex]) {
            menuItemRefs.current[focusedIndex]?.focus();
        }
    }, [focusedIndex]);

    const handleToggle = () => {
        if (disabled) return;

        if (isOpen) {
            handleClose();
            return;
        }

        setIsOpen(true);
        setFocusedIndex(-1);
    };

    const handleTriggerKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
        if (disabled) return;

        switch (e.key) {
            case 'ArrowDown':
            case 'Enter':
            case ' ': {
                e.preventDefault();
                if (isOpen) {
                    // Menu is open, move focus to first item
                    setFocusedIndex(0);
                } else {
                    setIsOpen(true);
                    setFocusedIndex(0);
                }
                break;
            }
            case 'ArrowUp':
                e.preventDefault();
                if (isOpen) {
                    // Menu is open, move focus to last item
                    setFocusedIndex(menuItems.length - 1);
                } else {
                    setIsOpen(true);
                    setFocusedIndex(menuItems.length - 1);
                }
                break;
        }
    };

    // Click outside to close
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (
                menuRef.current &&
                !menuRef.current.contains(e.target as Node) &&
                triggerRef.current &&
                !triggerRef.current.contains(e.target as Node)
            ) {
                handleClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, handleClose]);

    // Keyboard navigation using React capture phase to prevent bubbling to parent modals
    const handleMenuKeyDown = useCallback(
        (e: ReactKeyboardEvent) => {
            if (!isOpen) return;

            switch (e.key) {
                case 'Escape':
                    e.preventDefault();
                    e.stopPropagation(); // Prevent bubbling to parent modal's Escape handler
                    handleClose();
                    triggerRef.current?.focus();
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    setFocusedIndex((prev) => (prev < 0 ? 0 : (prev + 1) % menuItems.length));
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setFocusedIndex((prev) =>
                        prev < 0
                            ? menuItems.length - 1
                            : (prev - 1 + menuItems.length) % menuItems.length
                    );
                    break;
                case 'Enter':
                case ' ':
                    e.preventDefault();
                    e.stopPropagation(); // Prevent bubbling to parent (e.g., page scroll)
                    if (focusedIndex >= 0) {
                        menuItems[focusedIndex]?.onClick();
                    }
                    break;
            }
        },
        [isOpen, focusedIndex, menuItems, handleClose]
    );

    return (
        <div className={`relative ${className ?? ''}`}>
            <button
                ref={triggerRef}
                id={`${menuId}-trigger`}
                type="button"
                onClick={handleToggle}
                onKeyDown={handleTriggerKeyDown}
                disabled={disabled}
                className={`inline-flex h-[36px] w-[36px] items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40 ${
                    disabled
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:text-indigo-400 hover:bg-indigo-400/10'
                }`}
                aria-label="メニュー"
                aria-expanded={isOpen}
                aria-haspopup="menu"
                aria-controls={menuId}
            >
                <LuEllipsis className="w-4 h-4" aria-hidden="true" />
            </button>

            {isOpen && (
                <div
                    ref={menuRef}
                    id={menuId}
                    role="menu"
                    aria-orientation="vertical"
                    aria-labelledby={`${menuId}-trigger`}
                    onKeyDownCapture={handleMenuKeyDown}
                    className="absolute right-0 top-full mt-1 w-40 bg-slate-800 border border-slate-700 rounded-lg shadow-lg overflow-hidden z-[60]"
                >
                    {/* eslint-disable-next-line react-hooks/refs -- callback ref for roving tabindex is a valid pattern */}
                    {menuItems.map((item, index) => (
                        <button
                            key={item.id}
                            ref={(el) => {
                                menuItemRefs.current[index] = el;
                            }}
                            type="button"
                            role="menuitem"
                            tabIndex={index === (focusedIndex < 0 ? 0 : focusedIndex) ? 0 : -1}
                            onClick={item.onClick}
                            className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors ${
                                index === focusedIndex ? 'bg-slate-700' : ''
                            } ${item.danger ? 'text-red-400 hover:bg-slate-700' : 'text-slate-200 hover:bg-slate-700'}`}
                        >
                            <item.icon aria-hidden="true" className="shrink-0" />
                            <span>{item.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
