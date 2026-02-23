import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ComposeTextarea } from './ComposeTextarea';

describe('ComposeTextarea', () => {
    const mockOnChange = vi.fn();
    const mockOnSubmit = vi.fn();
    const mockOnPaste = vi.fn();
    const mockOnCompositionStart = vi.fn();
    const mockOnCompositionEnd = vi.fn();

    const defaultProps = {
        value: '',
        onChange: mockOnChange,
        placeholder: '今なにしてる？',
        disabled: false,
        maxCharacters: 500,
        textareaRef: { current: null },
        onSubmit: mockOnSubmit,
        onPaste: mockOnPaste,
        onCompositionStart: mockOnCompositionStart,
        onCompositionEnd: mockOnCompositionEnd,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render textarea with placeholder', () => {
        render(<ComposeTextarea {...defaultProps} />);

        const textarea = screen.getByLabelText('投稿内容');
        expect(textarea).toBeInTheDocument();
        expect(textarea).toHaveAttribute('placeholder', '今なにしてる？');
    });

    it('should display current value', () => {
        render(<ComposeTextarea {...defaultProps} value="Hello world" />);

        const textarea = screen.getByLabelText('投稿内容');
        expect(textarea).toHaveValue('Hello world');
    });

    it('should call onChange when typing', () => {
        render(<ComposeTextarea {...defaultProps} />);

        const textarea = screen.getByLabelText('投稿内容');
        fireEvent.change(textarea, { target: { value: 'New content' } });

        expect(mockOnChange).toHaveBeenCalledWith('New content');
    });

    it('should display character count', () => {
        render(<ComposeTextarea {...defaultProps} value="Test" maxCharacters={500} />);

        expect(screen.getByText('496')).toBeInTheDocument();
    });

    it('should show red count when over limit', () => {
        const longContent = 'a'.repeat(510);
        render(<ComposeTextarea {...defaultProps} value={longContent} maxCharacters={500} />);

        const countElement = screen.getByText('-10');
        expect(countElement).toHaveClass('text-red-400');
    });

    it('should show amber count when near limit', () => {
        const mediumContent = 'a'.repeat(460);
        render(<ComposeTextarea {...defaultProps} value={mediumContent} maxCharacters={500} />);

        const countElement = screen.getByText('40');
        expect(countElement).toHaveClass('text-amber-400');
    });

    it('should submit on Ctrl+Enter', () => {
        render(<ComposeTextarea {...defaultProps} />);

        const textarea = screen.getByLabelText('投稿内容');
        fireEvent.keyDown(textarea, {
            key: 'Enter',
            ctrlKey: true,
        });

        expect(mockOnSubmit).toHaveBeenCalled();
    });

    it('should submit on Cmd+Enter (Mac)', () => {
        render(<ComposeTextarea {...defaultProps} />);

        const textarea = screen.getByLabelText('投稿内容');
        fireEvent.keyDown(textarea, {
            key: 'Enter',
            metaKey: true,
        });

        expect(mockOnSubmit).toHaveBeenCalled();
    });

    it('should not submit on regular Enter', () => {
        render(<ComposeTextarea {...defaultProps} />);

        const textarea = screen.getByLabelText('投稿内容');
        fireEvent.keyDown(textarea, { key: 'Enter' });

        expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('should not submit on key repeat', () => {
        render(<ComposeTextarea {...defaultProps} />);

        const textarea = screen.getByLabelText('投稿内容');
        fireEvent.keyDown(textarea, {
            key: 'Enter',
            ctrlKey: true,
            repeat: true,
        });

        expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('should call onPaste when pasting', () => {
        render(<ComposeTextarea {...defaultProps} />);

        const textarea = screen.getByLabelText('投稿内容');
        fireEvent.paste(textarea);

        expect(mockOnPaste).toHaveBeenCalled();
    });

    it('should call composition handlers', () => {
        render(<ComposeTextarea {...defaultProps} />);

        const textarea = screen.getByLabelText('投稿内容');
        fireEvent.compositionStart(textarea);
        fireEvent.compositionEnd(textarea);

        expect(mockOnCompositionStart).toHaveBeenCalled();
        expect(mockOnCompositionEnd).toHaveBeenCalled();
    });

    it('should be disabled when disabled prop is true', () => {
        render(<ComposeTextarea {...defaultProps} disabled={true} />);

        const textarea = screen.getByLabelText('投稿内容');
        expect(textarea).toBeDisabled();
    });
});
