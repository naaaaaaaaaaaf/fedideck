import { useEffect, useRef } from 'react';
import { Picker } from 'emoji-picker-element';

// Custom emoji type matching Mastodon's CustomEmoji entity
export interface CustomEmoji {
    shortcode: string;
    url: string;
    staticUrl: string;
    visibleInPicker: boolean;
    category?: string | null;
}

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
    const pickerRef = useRef<Picker | null>(null);

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

    return null; // Picker is managed via side effects
}
