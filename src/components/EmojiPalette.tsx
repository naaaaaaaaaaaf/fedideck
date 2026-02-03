import { useEffect, useRef, useState } from 'react';
import { Picker } from 'emoji-picker-element';
import { getCustomEmojis, type CustomEmoji } from '../api/emojiCache';
import type { Session } from '../auth/sessions';

interface EmojiPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (emoji: string) => void;
    session: Session | null;
    triggerRef: React.RefObject<HTMLElement | null>;
    textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

export function EmojiPalette({
    isOpen,
    onClose,
    onSelect,
    session,
    triggerRef,
    textareaRef,
}: EmojiPaletteProps) {
    const pickerRef = useRef<Picker | null>(null);
    const [customEmojis, setCustomEmojis] = useState<CustomEmoji[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const hasFetchedRef = useRef(false);

    // Reset loading state when palette closes
    useEffect(() => {
        if (!isOpen) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setIsLoading(false);
            hasFetchedRef.current = false;
        }
    }, [isOpen]);

    // Fetch custom emojis when palette opens
    useEffect(() => {
        if (!isOpen || !session || hasFetchedRef.current) return;

        hasFetchedRef.current = true;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsLoading(true);
        getCustomEmojis(session)
            .then((emojis) => setCustomEmojis(emojis))
            .catch((err) => {
                console.error('Failed to fetch custom emojis:', err);
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, [isOpen, session]);

    useEffect(() => {
        if (!isOpen) {
            // Remove picker when not open
            if (pickerRef.current) {
                pickerRef.current.remove();
                pickerRef.current = null;
            }
            return;
        }

        // Create picker on mount
        const picker = new Picker({
            customEmoji: customEmojis
                .filter((e) => e.visibleInPicker)
                .map((emoji) => ({
                    name: emoji.shortcode,
                    shortcodes: [emoji.shortcode],
                    url: emoji.url,
                    category: emoji.category || undefined,
                })),
        });

        pickerRef.current = picker;

        // Add to document body
        document.body.appendChild(picker);

        // Position picker above the trigger button
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            const pickerWidth = 320; // emoji-picker-element default width
            const pickerHeight = 400; // approximate height
            const padding = 10; // padding from viewport edges

            picker.style.position = 'fixed';

            // Center picker horizontally on the button, but keep it within viewport
            let left = rect.left + rect.width / 2 - pickerWidth / 2;

            // Ensure picker doesn't go off the left edge
            if (left < padding) {
                left = padding;
            }
            // Ensure picker doesn't go off the right edge
            if (left + pickerWidth > window.innerWidth - padding) {
                left = window.innerWidth - pickerWidth - padding;
            }

            picker.style.left = `${left}px`;

            // Position above the button if there's enough space, otherwise below
            const spaceAbove = rect.top;
            const spaceBelow = window.innerHeight - rect.bottom;

            if (spaceAbove >= pickerHeight + padding || spaceAbove >= spaceBelow) {
                // Place above the button
                picker.style.bottom = `${window.innerHeight - rect.top + 8}px`;
            } else {
                // Place below the button
                picker.style.top = `${rect.bottom + 8}px`;
                picker.style.bottom = 'auto';
            }

            picker.style.zIndex = '60';
        }

        // Handle emoji selection
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handleEmojiClick = (event: any) => {
            const { emoji, unicode } = event.detail;
            onSelect(unicode || `:${emoji.shortcodes[0]}:`);
            onClose();
            // Return focus to textarea
            textareaRef.current?.focus();
        };

        picker.addEventListener('emoji-click', handleEmojiClick);

        // Focus the search input
        const searchInput = picker.shadowRoot?.querySelector('input');
        searchInput?.focus();

        // Cleanup
        return () => {
            picker.removeEventListener('emoji-click', handleEmojiClick);
            picker.remove();
        };
    }, [isOpen, customEmojis, onClose, onSelect, triggerRef, textareaRef]);

    // Handle clicks outside the picker
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const picker = pickerRef.current;

            if (
                picker &&
                !picker.contains(target) &&
                triggerRef.current &&
                !triggerRef.current.contains(target)
            ) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose, triggerRef]);

    // Show loading indicator if fetching
    if (isLoading) {
        return (
            <div
                style={{
                    position: 'fixed',
                    bottom: '50%',
                    right: '50%',
                    transform: 'translate(50%, 50%)',
                    zIndex: 60,
                    padding: '12px 16px',
                    background: '#1e293b',
                    border: '1px solid rgba(51, 65, 85, 0.5)',
                    borderRadius: '8px',
                    color: '#94a3b8',
                    fontSize: '14px',
                }}
            >
                絵文字を読み込み中...
            </div>
        );
    }

    return null; // Picker is managed via side effects
}
