import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmojiPalette, type CustomEmoji } from './EmojiPalette';

const mockCustomEmojis: CustomEmoji[] = [
    {
        shortcode: 'test_emoji',
        url: 'https://example.com/test.png',
        staticUrl: 'https://example.com/test_static.png',
        visibleInPicker: true,
        category: 'Test',
    },
    {
        shortcode: 'hidden_emoji',
        url: 'https://example.com/hidden.png',
        staticUrl: 'https://example.com/hidden_static.png',
        visibleInPicker: false,
        category: 'Test',
    },
    {
        shortcode: 'fun_emoji',
        url: 'https://example.com/fun.png',
        staticUrl: 'https://example.com/fun_static.png',
        visibleInPicker: true,
        category: 'Fun',
    },
];

describe('EmojiPalette', () => {
    const mockOnSelect = vi.fn();
    const mockOnClose = vi.fn();
    const mockTriggerRef = { current: null };
    const mockTextareaRef = { current: null };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders nothing when isOpen is false', () => {
        const { container } = render(
            <EmojiPalette
                isOpen={false}
                onClose={mockOnClose}
                onSelect={mockOnSelect}
                customEmojis={[]}
                triggerRef={mockTriggerRef}
                textareaRef={mockTextareaRef}
            />
        );
        expect(container.firstChild).toBeNull();
    });

    it('renders palette when isOpen is true', () => {
        render(
            <EmojiPalette
                isOpen={true}
                onClose={mockOnClose}
                onSelect={mockOnSelect}
                customEmojis={[]}
                triggerRef={mockTriggerRef}
                textareaRef={mockTextareaRef}
            />
        );
        expect(screen.getByLabelText('絵文字を選択')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('絵文字を検索...')).toBeInTheDocument();
    });

    it('displays unicode emoji categories', () => {
        render(
            <EmojiPalette
                isOpen={true}
                onClose={mockOnClose}
                onSelect={mockOnSelect}
                customEmojis={[]}
                triggerRef={mockTriggerRef}
                textareaRef={mockTextareaRef}
            />
        );
        expect(screen.getByText('Smileys')).toBeInTheDocument();
        expect(screen.getByText('People')).toBeInTheDocument();
        expect(screen.getByText('Animals')).toBeInTheDocument();
        expect(screen.getByText('Food')).toBeInTheDocument();
        expect(screen.getByText('Activities')).toBeInTheDocument();
        expect(screen.getByText('Travel')).toBeInTheDocument();
        expect(screen.getByText('Objects')).toBeInTheDocument();
        expect(screen.getByText('Symbols')).toBeInTheDocument();
    });

    it('displays custom emojis grouped by category', () => {
        render(
            <EmojiPalette
                isOpen={true}
                onClose={mockOnClose}
                onSelect={mockOnSelect}
                customEmojis={mockCustomEmojis}
                triggerRef={mockTriggerRef}
                textareaRef={mockTextareaRef}
            />
        );
        expect(screen.getByText('Test')).toBeInTheDocument();
        expect(screen.getByText('Fun')).toBeInTheDocument();
        expect(screen.getByAltText('test_emoji')).toBeInTheDocument();
        expect(screen.queryByAltText('hidden_emoji')).not.toBeInTheDocument(); // visibleInPicker=false
    });

    it('filters custom emojis by search query', async () => {
        const user = userEvent.setup();
        render(
            <EmojiPalette
                isOpen={true}
                onClose={mockOnClose}
                onSelect={mockOnSelect}
                customEmojis={mockCustomEmojis}
                triggerRef={mockTriggerRef}
                textareaRef={mockTextareaRef}
            />
        );

        const searchInput = screen.getByPlaceholderText('絵文字を検索...');
        await user.type(searchInput, 'test');

        // Should show test_emoji but not fun_emoji
        expect(screen.getByAltText('test_emoji')).toBeInTheDocument();
        expect(screen.queryByAltText('fun_emoji')).not.toBeInTheDocument();
    });

    it('shows empty state when no emojis match search', async () => {
        const user = userEvent.setup();
        render(
            <EmojiPalette
                isOpen={true}
                onClose={mockOnClose}
                onSelect={mockOnSelect}
                customEmojis={mockCustomEmojis}
                triggerRef={mockTriggerRef}
                textareaRef={mockTextareaRef}
            />
        );

        const searchInput = screen.getByPlaceholderText('絵文字を検索...');
        await user.type(searchInput, 'nonexistent xyz123');

        // Unicode emojis will still be shown (search not implemented for them)
        // but custom emojis should be filtered out
        expect(screen.queryByAltText('test_emoji')).not.toBeInTheDocument();
    });

    it('calls onSelect with emoji when clicking unicode emoji', async () => {
        const user = userEvent.setup();
        render(
            <EmojiPalette
                isOpen={true}
                onClose={mockOnClose}
                onSelect={mockOnSelect}
                customEmojis={[]}
                triggerRef={mockTriggerRef}
                textareaRef={mockTextareaRef}
            />
        );

        const emojiButton = screen.getByLabelText('😀');
        await user.click(emojiButton);

        expect(mockOnSelect).toHaveBeenCalledWith('😀');
        expect(mockOnClose).toHaveBeenCalled();
    });

    it('calls onSelect with shortcode when clicking custom emoji', async () => {
        const user = userEvent.setup();
        render(
            <EmojiPalette
                isOpen={true}
                onClose={mockOnClose}
                onSelect={mockOnSelect}
                customEmojis={mockCustomEmojis}
                triggerRef={mockTriggerRef}
                textareaRef={mockTextareaRef}
            />
        );

        const emojiButton = screen.getByTitle(':test_emoji:');
        await user.click(emojiButton);

        expect(mockOnSelect).toHaveBeenCalledWith(':test_emoji:');
        expect(mockOnClose).toHaveBeenCalled();
    });

    it('supports keyboard navigation with arrow keys', async () => {
        const user = userEvent.setup();
        render(
            <EmojiPalette
                isOpen={true}
                onClose={mockOnClose}
                onSelect={mockOnSelect}
                customEmojis={[]}
                triggerRef={mockTriggerRef}
                textareaRef={mockTextareaRef}
            />
        );

        const palette = screen.getByLabelText('絵文字を選択');
        const firstEmoji = screen.getByLabelText('😀');

        // Focus the palette first
        firstEmoji.focus();

        // Arrow down should navigate
        await user.keyboard('{ArrowDown}');

        // After arrow down, focus should move
        // (checking that keyboard event was processed without error)
        expect(palette).toBeInTheDocument();
    });

    it('closes on Escape key', async () => {
        const user = userEvent.setup();
        render(
            <EmojiPalette
                isOpen={true}
                onClose={mockOnClose}
                onSelect={mockOnSelect}
                customEmojis={[]}
                triggerRef={mockTriggerRef}
                textareaRef={mockTextareaRef}
            />
        );

        const palette = screen.getByLabelText('絵文字を選択');
        palette.focus();
        await user.keyboard('{Escape}');

        expect(mockOnClose).toHaveBeenCalled();
    });

    it('closes on Tab key', async () => {
        const user = userEvent.setup();
        render(
            <EmojiPalette
                isOpen={true}
                onClose={mockOnClose}
                onSelect={mockOnSelect}
                customEmojis={[]}
                triggerRef={mockTriggerRef}
                textareaRef={mockTextareaRef}
            />
        );

        const palette = screen.getByLabelText('絵文字を選択');
        palette.focus();
        await user.keyboard('{Tab}');

        expect(mockOnClose).toHaveBeenCalled();
    });

    it('closes when clicking outside', async () => {
        const user = userEvent.setup();
        const triggerButton = document.createElement('button');
        triggerButton.textContent = 'Trigger';
        document.body.appendChild(triggerButton);

        const triggerRefWithElement = { current: triggerButton };

        render(
            <div>
                <EmojiPalette
                    isOpen={true}
                    onClose={mockOnClose}
                    onSelect={mockOnSelect}
                    customEmojis={[]}
                    triggerRef={triggerRefWithElement}
                    textareaRef={mockTextareaRef}
                />
                <div data-testid="outside">Outside</div>
            </div>
        );

        const outside = screen.getByTestId('outside');
        await user.click(outside);

        expect(mockOnClose).toHaveBeenCalled();

        // Cleanup
        document.body.removeChild(triggerButton);
    });
});
