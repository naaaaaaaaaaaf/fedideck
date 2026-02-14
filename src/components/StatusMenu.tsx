import {
    useEffect,
    useRef,
    useState,
    useCallback,
    useMemo,
    type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { LuEllipsis, LuLink, LuTrash2 } from 'react-icons/lu';

interface StatusMenuProps {
    statusUrl: string;
    canDelete: boolean;
    onDelete: () => void;
    disabled?: boolean;
}

export function StatusMenu({ statusUrl, canDelete, onDelete, disabled = false }: StatusMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const copySuccessTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const menuItemRefs = useRef<(HTMLButtonElement | null)[]>([]);
    const [focusedIndex, setFocusedIndex] = useState(-1);

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

    // Calculate menu items based on canDelete
    const menuItems = useMemo(
        () => [
            {
                id: 'copy-link',
                label: copySuccess ? 'コピーしました' : 'リンクをコピー',
                icon: LuLink,
                onClick: handleCopyLink,
                danger: false,
            },
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
        [copySuccess, canDelete, handleCopyLink, handleDeleteClick]
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
        <div className="relative">
            <button
                ref={triggerRef}
                type="button"
                onClick={handleToggle}
                onKeyDown={handleTriggerKeyDown}
                disabled={disabled}
                className={`hover:text-indigo-400 transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                aria-label="メニュー"
                aria-expanded={isOpen}
                aria-haspopup="menu"
            >
                <LuEllipsis aria-hidden="true" />
            </button>

            {isOpen && (
                <div
                    ref={menuRef}
                    role="menu"
                    aria-orientation="vertical"
                    onKeyDownCapture={handleMenuKeyDown}
                    className="absolute right-0 top-full mt-1 w-40 bg-slate-800 border border-slate-700 rounded-lg shadow-lg overflow-hidden z-[60]"
                >
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
