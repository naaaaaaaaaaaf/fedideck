import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';

// Custom emoji type matching Mastodon's CustomEmoji entity
export interface CustomEmoji {
    shortcode: string;
    url: string;
    staticUrl: string;
    visibleInPicker: boolean;
    category?: string | null;
}

// Common Unicode emojis for each category
const UNICODE_EMOJIS = {
    Smileys: [
        '😀',
        '😃',
        '😄',
        '😁',
        '😅',
        '😂',
        '🤣',
        '😊',
        '😇',
        '🙂',
        '😉',
        '😌',
        '😍',
        '🥰',
        '😘',
        '😗',
        '😙',
        '😚',
        '😋',
        '😛',
        '😝',
        '😜',
        '🤪',
        '🤨',
        '🧐',
        '🤓',
        '😎',
        '🥸',
        '🤩',
        '🥳',
    ],
    People: [
        '👋',
        '🤚',
        '🖐️',
        '✋',
        '🖖',
        '👌',
        '🤌',
        '🤏',
        '✌️',
        '🤞',
        '🤟',
        '🤘',
        '🤙',
        '👈',
        '👉',
        '👆',
        '🖕',
        '👇',
        '☝️',
        '👍',
        '👎',
        '✊',
        '👊',
        '🤛',
        '🤜',
        '👏',
        '🙌',
        '👐',
        '🤲',
        '🤝',
        '🙏',
    ],
    Animals: [
        '🐶',
        '🐱',
        '🐭',
        '🐹',
        '🐰',
        '🦊',
        '🐻',
        '🐼',
        '🐨',
        '🐯',
        '🦁',
        '🐮',
        '🐷',
        '🐸',
        '🐵',
        '🐔',
        '🐧',
        '🐦',
        '🐤',
        '🦆',
        '🦅',
        '🦉',
        '🦇',
        '🐺',
        '🐗',
        '🐴',
        '🦄',
        '🐝',
        '🐛',
        '🦋',
    ],
    Food: [
        '🍎',
        '🍊',
        '🍋',
        '🍌',
        '🍉',
        '🍇',
        '🍓',
        '🫐',
        '🍈',
        '🍒',
        '🍑',
        '🥭',
        '🍍',
        '🥥',
        '🥝',
        '🍅',
        '🍆',
        '🥑',
        '🥦',
        '🥬',
        '🥒',
        '🌶️',
        '🫑',
        '🌽',
        '🥕',
        '🫒',
        '🧄',
        '🧅',
        '🥔',
        '🍠',
    ],
    Activities: [
        '⚽',
        '🏀',
        '🏈',
        '⚾',
        '🥎',
        '🎾',
        '🏐',
        '🏉',
        '🥏',
        '🎱',
        '🪀',
        '🏓',
        '🏸',
        '🏒',
        '🏑',
        '🥍',
        '🏏',
        '🪃',
        '🥅',
        '⛳',
        '🪁',
        '🏹',
        '🎣',
        '🤿',
        '🥊',
        '🥋',
        '🎽',
        '🛹',
        '🛼',
        '🛷',
    ],
    Travel: [
        '🚗',
        '🚕',
        '🚙',
        '🚌',
        '🚎',
        '🏎️',
        '🚓',
        '🚑',
        '🚒',
        '🚐',
        '🛻',
        '🚚',
        '🚛',
        '🚜',
        '🦯',
        '🦽',
        '🦼',
        '🛴',
        '🚲',
        '🛵',
        '🏍️',
        '🛺',
        '🚨',
        '🚔',
        '🚍',
        '🚘',
        '🚖',
        '🚡',
        '🚠',
        '🚟',
        '🚃',
    ],
    Objects: [
        '⌚',
        '📱',
        '💻',
        '⌨️',
        '🖥️',
        '🖨️',
        '🖱️',
        '🖲️',
        '🕹️',
        '🗜️',
        '💾',
        '💿',
        '📀',
        '📼',
        '📷',
        '📸',
        '📹',
        '🎥',
        '📞',
        '☎️',
        '📟',
        '📠',
        '📺',
        '📻',
        '🎙️',
        '🎚️',
        '🎛️',
        '🧭',
        '⏱️',
        '⏲️',
    ],
    Symbols: [
        '❤️',
        '🧡',
        '💛',
        '💚',
        '💙',
        '💜',
        '🖤',
        '🤍',
        '🤎',
        '💔',
        '❣️',
        '💕',
        '💞',
        '💓',
        '💗',
        '💖',
        '💘',
        '💝',
        '💟',
        '☮️',
        '✝️',
        '☪️',
        '🕉️',
        '☸️',
        '✡️',
        '🔯',
        '🕎',
        '☯️',
        '☦️',
        '🛐',
    ],
};

interface EmojiPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (emoji: string) => void;
    customEmojis: CustomEmoji[];
    triggerRef: React.RefObject<HTMLElement | null>;
    textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

export function EmojiPalette({
    isOpen,
    onClose,
    onSelect,
    customEmojis,
    triggerRef,
    textareaRef,
}: EmojiPaletteProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [focusedEmojiIndex, setFocusedEmojiIndex] = useState(-1);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const paletteRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Calculate position based on trigger button
    useEffect(() => {
        if (isOpen && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            // Position palette above the button, aligned with left edge
            // Account for viewport to prevent overflow
            const maxLeft = window.innerWidth - 340; // 320px width + margin
            const left = Math.min(rect.left, maxLeft);
            setPosition({
                top: rect.top,
                left: Math.max(10, left), // Minimum 10px from left edge
            });
        }
    }, [isOpen, triggerRef]);

    // Filter custom emojis that are visible in picker
    const visibleCustomEmojis = customEmojis.filter((e) => e.visibleInPicker);

    // Group custom emojis by category
    const groupedCustomEmojis = visibleCustomEmojis.reduce<Record<string, CustomEmoji[]>>(
        (acc, emoji) => {
            const category = emoji.category || 'Uncategorized';
            if (!acc[category]) acc[category] = [];
            acc[category].push(emoji);
            return acc;
        },
        {}
    );

    // Filter emojis based on search query
    const filteredEmojiCategories = Object.entries(UNICODE_EMOJIS)
        .map(([category, emojis]) => ({
            category,
            emojis: emojis.filter(() => !searchQuery || true), // Unicode search not implemented yet
        }))
        .filter(({ emojis }) => emojis.length > 0);

    const filteredCustomCategories = Object.entries(groupedCustomEmojis)
        .map(([category, emojis]) => ({
            category,
            emojis: emojis.filter(
                (e) => !searchQuery || e.shortcode.toLowerCase().includes(searchQuery.toLowerCase())
            ),
        }))
        .filter(({ emojis }) => emojis.length > 0);

    // Type for emoji items in the unified list
    type EmojiItem =
        | { type: 'unicode'; emoji: string; category: string }
        | { type: 'custom'; emoji: CustomEmoji; category: string };

    // Get all visible emojis for keyboard navigation
    const allVisibleEmojis: EmojiItem[] = [
        ...filteredEmojiCategories.flatMap(({ category, emojis }) =>
            emojis.map((emoji) => ({ type: 'unicode' as const, emoji, category }))
        ),
        ...filteredCustomCategories.flatMap(({ category, emojis }) =>
            emojis.map((emoji) => ({ type: 'custom' as const, emoji, category }))
        ),
    ];

    // Focus search input when palette opens
    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isOpen]);

    // Close palette when clicking outside
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (
                paletteRef.current &&
                !paletteRef.current.contains(e.target as Node) &&
                triggerRef.current &&
                !triggerRef.current.contains(e.target as Node)
            ) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose, triggerRef]);

    const handleEmojiClick = useCallback(
        (emoji: string) => {
            onSelect(emoji);
            setSearchQuery('');
            onClose();
            // Return focus to textarea after selection
            textareaRef.current?.focus();
        },
        [onSelect, onClose, textareaRef]
    );

    const handleKeyDown = useCallback(
        (e: KeyboardEvent<HTMLDivElement>) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
                textareaRef.current?.focus();
                return;
            }

            if (e.key === 'Tab') {
                onClose();
                return;
            }

            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const direction = e.key === 'ArrowDown' ? 1 : -1;
                const newIndex =
                    (focusedEmojiIndex + direction + allVisibleEmojis.length) %
                    allVisibleEmojis.length;
                setFocusedEmojiIndex(newIndex);
            }

            if (e.key === 'Enter' && focusedEmojiIndex >= 0) {
                e.preventDefault();
                const selected = allVisibleEmojis[focusedEmojiIndex];
                if (selected) {
                    const emoji =
                        selected.type === 'unicode'
                            ? selected.emoji
                            : `:${(selected.emoji as CustomEmoji).shortcode}:`;
                    handleEmojiClick(emoji);
                }
            }
        },
        [focusedEmojiIndex, allVisibleEmojis, handleEmojiClick, onClose, textareaRef]
    );

    if (!isOpen) return null;

    const palette = (
        <div
            ref={paletteRef}
            className="fixed w-80 max-h-96 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-[60] overflow-hidden flex flex-col"
            style={{
                bottom: `${window.innerHeight - position.top + 8}px`, // Position above button with 8px gap
                left: `${position.left}px`,
            }}
            role="dialog"
            aria-label="絵文字を選択"
            onKeyDown={handleKeyDown}
        >
            {/* Search input */}
            <div className="p-3 border-b border-slate-700/50">
                <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="絵文字を検索..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                />
            </div>

            {/* Emoji list */}
            <div className="flex-1 overflow-y-auto p-2">
                {allVisibleEmojis.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-sm">
                        絵文字が見つかりません
                    </div>
                ) : (
                    <>
                        {/* Custom emojis section */}
                        {filteredCustomCategories.map(({ category, emojis }) => (
                            <div key={category} className="mb-3">
                                <div className="px-2 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                                    {category}
                                </div>
                                <div className="grid grid-cols-6 gap-1">
                                    {emojis.map((emoji) => {
                                        const globalIndex = allVisibleEmojis.findIndex(
                                            (e) =>
                                                e.type === 'custom' &&
                                                e.emoji.shortcode === emoji.shortcode
                                        );
                                        return (
                                            <button
                                                key={emoji.shortcode}
                                                onClick={() =>
                                                    handleEmojiClick(`:${emoji.shortcode}:`)
                                                }
                                                className={`p-1 hover:bg-slate-700 rounded transition-colors ${
                                                    globalIndex === focusedEmojiIndex
                                                        ? 'bg-slate-700 ring-1 ring-indigo-500'
                                                        : ''
                                                }`}
                                                title={`:${emoji.shortcode}:`}
                                                aria-label={`:${emoji.shortcode}:`}
                                            >
                                                <img
                                                    src={emoji.url}
                                                    alt={emoji.shortcode}
                                                    className="w-6 h-6"
                                                />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}

                        {/* Unicode emojis section */}
                        {filteredEmojiCategories.map(({ category, emojis }) => (
                            <div key={category} className="mb-3">
                                <div className="px-2 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                                    {category}
                                </div>
                                <div className="grid grid-cols-6 gap-1">
                                    {emojis.map((emoji) => {
                                        const globalIndex = allVisibleEmojis.findIndex(
                                            (e) =>
                                                e.type === 'unicode' &&
                                                e.emoji === emoji &&
                                                e.category === category
                                        );
                                        return (
                                            <button
                                                key={emoji}
                                                onClick={() => handleEmojiClick(emoji)}
                                                className={`p-1 hover:bg-slate-700 rounded transition-colors text-lg ${
                                                    globalIndex === focusedEmojiIndex
                                                        ? 'bg-slate-700 ring-1 ring-indigo-500'
                                                        : ''
                                                }`}
                                                aria-label={emoji}
                                            >
                                                {emoji}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </>
                )}
            </div>
        </div>
    );

    return createPortal(palette, document.body);
}
