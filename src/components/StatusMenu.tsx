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
    const [focusedIndex, setFocusedIndex] = useState(-1);

    async function copyToClipboard(text: string) {
        try {
            await navigator.clipboard.writeText(text);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
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
                setTimeout(() => setCopySuccess(false), 2000);
            } catch (err) {
                console.error('Failed to copy link:', err);
            }
        }
    }

    const handleCopyLink = useCallback(() => {
        copyToClipboard(statusUrl);
    }, [statusUrl]);

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
        if (disabled || isOpen) return;

        switch (e.key) {
            case 'ArrowDown':
            case 'Enter':
            case ' ': {
                e.preventDefault();
                setIsOpen(true);
                setFocusedIndex(0);
                break;
            }
            case 'ArrowUp':
                e.preventDefault();
                setIsOpen(true);
                setFocusedIndex(menuItems.length - 1);
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

    // Keyboard navigation
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            switch (e.key) {
                case 'Escape':
                    e.preventDefault();
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
                    if (focusedIndex >= 0) {
                        menuItems[focusedIndex]?.onClick();
                    }
                    break;
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, focusedIndex, menuItems, handleClose]);

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
                    className="absolute right-0 top-full mt-1 w-40 bg-slate-800 border border-slate-700 rounded-lg shadow-lg overflow-hidden z-[60]"
                >
                    {menuItems.map((item, index) => (
                        <button
                            key={item.id}
                            type="button"
                            role="menuitem"
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
