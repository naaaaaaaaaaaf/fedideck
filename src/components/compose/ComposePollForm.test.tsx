import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ComposePollForm, type PollOptionDraft } from './ComposePollForm';

describe('ComposePollForm', () => {
    const mockOnAddOption = vi.fn();
    const mockOnRemoveOption = vi.fn();
    const mockOnUpdateOption = vi.fn();
    const mockOnChangeExpiresIn = vi.fn();
    const mockOnChangeMultiple = vi.fn();

    const defaultPollOptions: PollOptionDraft[] = [
        { id: '1', text: 'Option 1' },
        { id: '2', text: 'Option 2' },
    ];

    const defaultProps = {
        pollOptions: defaultPollOptions,
        pollExpiresIn: 86400,
        pollMultiple: false,
        maxOptions: 4,
        minOptions: 2,
        onAddOption: mockOnAddOption,
        onRemoveOption: mockOnRemoveOption,
        onUpdateOption: mockOnUpdateOption,
        onChangeExpiresIn: mockOnChangeExpiresIn,
        onChangeMultiple: mockOnChangeMultiple,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render poll options', () => {
        render(<ComposePollForm {...defaultProps} />);

        expect(screen.getByDisplayValue('Option 1')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Option 2')).toBeInTheDocument();
    });

    it('should call onUpdateOption when typing', () => {
        render(<ComposePollForm {...defaultProps} />);

        const input = screen.getByDisplayValue('Option 1');
        fireEvent.change(input, { target: { value: 'Updated Option 1' } });

        expect(mockOnUpdateOption).toHaveBeenCalledWith('1', 'Updated Option 1');
    });

    it('should not show remove button when at minimum options', () => {
        render(<ComposePollForm {...defaultProps} />);

        // With 2 options and minOptions=2, no remove buttons should be shown
        const removeButtons = screen.queryAllByRole('button', { name: /削除/ });
        expect(removeButtons).toHaveLength(0);
    });

    it('should show remove button when above minimum options', () => {
        const pollOptions = [...defaultPollOptions, { id: '3', text: 'Option 3' }];

        render(<ComposePollForm {...defaultProps} pollOptions={pollOptions} />);

        const removeButtons = screen.getAllByRole('button', { name: /削除/ });
        expect(removeButtons).toHaveLength(3);
    });

    it('should call onRemoveOption when clicking remove', () => {
        const pollOptions = [...defaultPollOptions, { id: '3', text: 'Option 3' }];

        render(<ComposePollForm {...defaultProps} pollOptions={pollOptions} />);

        const removeButtons = screen.getAllByRole('button', { name: /削除/ });
        fireEvent.click(removeButtons[0]);

        expect(mockOnRemoveOption).toHaveBeenCalledWith('1');
    });

    it('should show add button when below max options', () => {
        render(<ComposePollForm {...defaultProps} />);

        expect(screen.getByText(/選択肢を追加/)).toBeInTheDocument();
    });

    it('should not show add button when at max options', () => {
        const pollOptions = [
            { id: '1', text: 'Option 1' },
            { id: '2', text: 'Option 2' },
            { id: '3', text: 'Option 3' },
            { id: '4', text: 'Option 4' },
        ];

        render(<ComposePollForm {...defaultProps} pollOptions={pollOptions} />);

        expect(screen.queryByText(/選択肢を追加/)).not.toBeInTheDocument();
    });

    it('should call onAddOption when clicking add', () => {
        render(<ComposePollForm {...defaultProps} />);

        fireEvent.click(screen.getByText(/選択肢を追加/));

        expect(mockOnAddOption).toHaveBeenCalled();
    });

    it('should display duration selector', () => {
        render(<ComposePollForm {...defaultProps} />);

        const select = screen.getByLabelText('有効期限:');
        expect(select).toBeInTheDocument();
    });

    it('should call onChangeExpiresIn when changing duration', () => {
        render(<ComposePollForm {...defaultProps} />);

        const select = screen.getByLabelText('有効期限:');
        fireEvent.change(select, { target: { value: '3600' } });

        expect(mockOnChangeExpiresIn).toHaveBeenCalledWith(3600);
    });

    it('should display multiple selection checkbox', () => {
        render(<ComposePollForm {...defaultProps} />);

        expect(screen.getByLabelText('複数選択可')).toBeInTheDocument();
    });

    it('should call onChangeMultiple when toggling checkbox', () => {
        render(<ComposePollForm {...defaultProps} />);

        const checkbox = screen.getByLabelText('複数選択可');
        fireEvent.click(checkbox);

        expect(mockOnChangeMultiple).toHaveBeenCalledWith(true);
    });

    it('should show checkbox as checked when pollMultiple is true', () => {
        render(<ComposePollForm {...defaultProps} pollMultiple={true} />);

        const checkbox = screen.getByLabelText('複数選択可') as HTMLInputElement;
        expect(checkbox.checked).toBe(true);
    });
});
