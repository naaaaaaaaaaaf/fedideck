import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmModal } from './ConfirmModal';

describe('ConfirmModal', () => {
    const mockOnClose = vi.fn();
    const mockOnConfirm = vi.fn();
    const defaultProps = {
        isOpen: true,
        onClose: mockOnClose,
        onConfirm: mockOnConfirm,
        title: '確認',
        message: '本当に削除しますか？',
    };

    beforeEach(() => {
        mockOnClose.mockClear();
        mockOnConfirm.mockClear();
    });

    it('renders when isOpen is true', () => {
        render(<ConfirmModal {...defaultProps} />);

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: '確認' })).toBeInTheDocument();
        expect(screen.getByText('本当に削除しますか？')).toBeInTheDocument();
    });

    it('does not render when isOpen is false', () => {
        render(<ConfirmModal {...defaultProps} isOpen={false} />);

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('calls onClose when close button is clicked', () => {
        render(<ConfirmModal {...defaultProps} />);

        const closeButton = screen.getByRole('button', { name: '閉じる' });
        fireEvent.click(closeButton);

        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when cancel button is clicked', () => {
        render(<ConfirmModal {...defaultProps} />);

        const cancelButton = screen.getByText('キャンセル');
        fireEvent.click(cancelButton);

        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onConfirm when confirm button is clicked', () => {
        render(<ConfirmModal {...defaultProps} />);

        // Use more specific selector since title and button have same text
        const confirmButton = screen.getByRole('button', { name: '確認' });
        fireEvent.click(confirmButton);

        expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    });

    it('disables buttons when isLoading is true', () => {
        render(<ConfirmModal {...defaultProps} isLoading={true} />);

        const closeButton = screen.getByRole('button', { name: '閉じる' });
        const cancelButton = screen.getByText('キャンセル');
        const confirmButton = screen.getByText('処理中...');

        expect(closeButton).toBeDisabled();
        expect(cancelButton).toBeDisabled();
        expect(confirmButton).toBeDisabled();
    });

    it('shows loading text when isLoading is true', () => {
        render(<ConfirmModal {...defaultProps} isLoading={true} />);

        expect(screen.getByText('処理中...')).toBeInTheDocument();
    });

    it('displays error message when error is provided', () => {
        render(<ConfirmModal {...defaultProps} error="削除に失敗しました" />);

        expect(screen.getByText('削除に失敗しました')).toBeInTheDocument();
    });

    it('renders with danger variant styling', () => {
        render(<ConfirmModal {...defaultProps} variant="danger" confirmLabel="削除" />);

        const confirmButton = screen.getByText('削除');
        expect(confirmButton).toHaveClass('bg-red-600');
    });

    it('renders with default variant styling', () => {
        render(<ConfirmModal {...defaultProps} variant="default" />);

        // Use more specific selector since title and button have same text
        const confirmButton = screen.getByRole('button', { name: '確認' });
        expect(confirmButton).toHaveClass('bg-indigo-600');
    });

    it('renders custom button labels', () => {
        render(<ConfirmModal {...defaultProps} confirmLabel="削除する" cancelLabel="やめる" />);

        expect(screen.getByText('削除する')).toBeInTheDocument();
        expect(screen.getByText('やめる')).toBeInTheDocument();
    });

    it('has correct accessibility attributes', () => {
        render(<ConfirmModal {...defaultProps} />);

        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(dialog).toHaveAttribute('aria-labelledby', 'confirm-modal-title');
        expect(dialog).toHaveAttribute('aria-describedby', 'confirm-modal-message');
    });

    it('closes on Escape key when not loading', () => {
        render(<ConfirmModal {...defaultProps} isLoading={false} />);

        fireEvent.keyDown(screen.getByRole('dialog').parentElement!, { key: 'Escape' });

        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('does not close on Escape key when loading', () => {
        render(<ConfirmModal {...defaultProps} isLoading={true} />);

        fireEvent.keyDown(screen.getByRole('dialog').parentElement!, { key: 'Escape' });

        expect(mockOnClose).not.toHaveBeenCalled();
    });
});
