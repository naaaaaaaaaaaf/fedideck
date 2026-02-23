import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ComposeOptionButtons } from './ComposeOptionButtons';

// Mock EmojiPalette
vi.mock('../EmojiPalette', () => ({
    EmojiPalette: () => null,
}));

describe('ComposeOptionButtons', () => {
    const mockOnToggleCW = vi.fn();
    const mockOnToggleEmojiPalette = vi.fn();
    const mockOnOpenFilePicker = vi.fn();
    const mockOnTogglePoll = vi.fn();
    const mockInsertAtCursor = vi.fn();

    const defaultProps = {
        showCW: false,
        onToggleCW: mockOnToggleCW,
        showEmojiPalette: false,
        onToggleEmojiPalette: mockOnToggleEmojiPalette,
        emojiButtonRef: { current: null },
        textareaRef: { current: null },
        composingAccount: null,
        insertAtCursor: mockInsertAtCursor,
        hasMedia: false,
        mediaCount: 0,
        instanceConfig: {
            maxCharacters: 500,
            maxMediaAttachments: 4,
            supportedMimeTypes: ['image/jpeg', 'image/png'],
        },
        isUploading: false,
        showPoll: false,
        isEditMode: false,
        onOpenFilePicker: mockOnOpenFilePicker,
        onTogglePoll: mockOnTogglePoll,
        fileInputRef: { current: null },
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render all option buttons', () => {
        render(<ComposeOptionButtons {...defaultProps} />);

        expect(screen.getByText('CW')).toBeInTheDocument();
        expect(screen.getByText('絵文字')).toBeInTheDocument();
        expect(screen.getByText('画像/動画/音声')).toBeInTheDocument();
        expect(screen.getByText('投票')).toBeInTheDocument();
    });

    it('should highlight CW button when active', () => {
        render(<ComposeOptionButtons {...defaultProps} showCW={true} />);

        const cwButton = screen.getByRole('button', { name: /CW/ });
        expect(cwButton).toHaveClass('bg-amber-500/20');
    });

    it('should call onToggleCW when clicking CW button', () => {
        render(<ComposeOptionButtons {...defaultProps} />);

        fireEvent.click(screen.getByText('CW'));

        expect(mockOnToggleCW).toHaveBeenCalled();
    });

    it('should call onToggleEmojiPalette when clicking emoji button', () => {
        render(<ComposeOptionButtons {...defaultProps} />);

        fireEvent.click(screen.getByText('絵文字'));

        expect(mockOnToggleEmojiPalette).toHaveBeenCalled();
    });

    it('should call onOpenFilePicker when clicking media button', () => {
        render(<ComposeOptionButtons {...defaultProps} />);

        fireEvent.click(screen.getByText('画像/動画/音声'));

        expect(mockOnOpenFilePicker).toHaveBeenCalled();
    });

    it('should disable media button when at max media', () => {
        render(<ComposeOptionButtons {...defaultProps} mediaCount={4} />);

        const mediaButton = screen.getByRole('button', { name: /メディアを追加/ });
        expect(mediaButton).toBeDisabled();
    });

    it('should disable media button when uploading', () => {
        render(<ComposeOptionButtons {...defaultProps} isUploading={true} />);

        const mediaButton = screen.getByRole('button', { name: /メディアを追加/ });
        expect(mediaButton).toBeDisabled();
    });

    it('should disable media button when poll is active', () => {
        render(<ComposeOptionButtons {...defaultProps} showPoll={true} />);

        const mediaButton = screen.getByRole('button', { name: /メディアを追加/ });
        expect(mediaButton).toBeDisabled();
    });

    it('should show media count when has media', () => {
        render(<ComposeOptionButtons {...defaultProps} hasMedia={true} mediaCount={2} />);

        expect(screen.getByText('(2/4)')).toBeInTheDocument();
    });

    it('should call onTogglePoll when clicking poll button', () => {
        render(<ComposeOptionButtons {...defaultProps} />);

        fireEvent.click(screen.getByText('投票'));

        expect(mockOnTogglePoll).toHaveBeenCalled();
    });

    it('should disable poll button when has media', () => {
        render(<ComposeOptionButtons {...defaultProps} hasMedia={true} />);

        const pollButton = screen.getByRole('button', { name: /投票/ });
        expect(pollButton).toBeDisabled();
    });

    it('should disable poll button in edit mode', () => {
        render(<ComposeOptionButtons {...defaultProps} isEditMode={true} />);

        const pollButton = screen.getByRole('button', { name: /投票/ });
        expect(pollButton).toBeDisabled();
    });

    it('should highlight poll button when active', () => {
        render(<ComposeOptionButtons {...defaultProps} showPoll={true} />);

        const pollButton = screen.getByRole('button', { name: /投票/ });
        expect(pollButton).toHaveClass('bg-purple-500/20');
    });
});
