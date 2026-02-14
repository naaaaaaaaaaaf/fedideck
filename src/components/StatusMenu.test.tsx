import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StatusMenu } from './StatusMenu';

describe('StatusMenu', () => {
    const mockOnDelete = vi.fn();
    const defaultProps = {
        statusUrl: 'https://mastodon.social/@test/123',
        canDelete: false,
        onDelete: mockOnDelete,
    };

    let originalClipboard: typeof navigator.clipboard | undefined;

    beforeEach(() => {
        mockOnDelete.mockClear();
        // Save original clipboard
        originalClipboard = navigator.clipboard;
    });

    afterEach(() => {
        // Restore original clipboard
        Object.defineProperty(navigator, 'clipboard', {
            value: originalClipboard,
            writable: true,
            configurable: true,
        });
    });

    it('renders menu trigger button', () => {
        render(<StatusMenu {...defaultProps} />);

        expect(screen.getByRole('button', { name: 'メニュー' })).toBeInTheDocument();
    });

    it('opens menu when trigger is clicked', () => {
        render(<StatusMenu {...defaultProps} />);

        const trigger = screen.getByRole('button', { name: 'メニュー' });
        fireEvent.click(trigger);

        expect(screen.getByRole('menu')).toBeInTheDocument();
        expect(screen.getByText('リンクをコピー')).toBeInTheDocument();
    });

    it('does not pre-focus first item when opened by mouse', () => {
        render(<StatusMenu {...defaultProps} />);

        const trigger = screen.getByRole('button', { name: 'メニュー' });
        fireEvent.click(trigger);

        const copyItem = screen.getByRole('menuitem', { name: 'リンクをコピー' });
        expect(copyItem).not.toHaveClass('bg-slate-700');
    });

    it('pre-focuses first item when opened by keyboard', () => {
        render(<StatusMenu {...defaultProps} />);

        const trigger = screen.getByRole('button', { name: 'メニュー' });
        trigger.focus();
        fireEvent.keyDown(trigger, { key: 'Enter' });

        const copyItem = screen.getByRole('menuitem', { name: 'リンクをコピー' });
        expect(copyItem).toHaveClass('bg-slate-700');
    });

    it('does not show delete option when canDelete is false', () => {
        render(<StatusMenu {...defaultProps} canDelete={false} />);

        const trigger = screen.getByRole('button', { name: 'メニュー' });
        fireEvent.click(trigger);

        expect(screen.queryByText('削除')).not.toBeInTheDocument();
    });

    it('shows delete option when canDelete is true', () => {
        render(<StatusMenu {...defaultProps} canDelete={true} />);

        const trigger = screen.getByRole('button', { name: 'メニュー' });
        fireEvent.click(trigger);

        expect(screen.getByText('削除')).toBeInTheDocument();
    });

    it('closes menu when clicking outside', async () => {
        render(<StatusMenu {...defaultProps} />);

        const trigger = screen.getByRole('button', { name: 'メニュー' });
        fireEvent.click(trigger);

        expect(screen.getByRole('menu')).toBeInTheDocument();

        // Click outside
        fireEvent.mouseDown(document.body);

        await waitFor(() => {
            expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        });
    });

    it('closes menu on Escape key', async () => {
        render(<StatusMenu {...defaultProps} />);

        const trigger = screen.getByRole('button', { name: 'メニュー' });
        fireEvent.click(trigger);

        const menu = screen.getByRole('menu');
        expect(menu).toBeInTheDocument();

        fireEvent.keyDown(menu, { key: 'Escape' });

        await waitFor(() => {
            expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        });
    });

    it('navigates menu items with arrow keys', () => {
        render(<StatusMenu {...defaultProps} canDelete={true} />);

        const trigger = screen.getByRole('button', { name: 'メニュー' });
        fireEvent.click(trigger);

        const menu = screen.getByRole('menu');
        const menuItems = screen.getAllByRole('menuitem');

        // Navigate down to first item
        fireEvent.keyDown(menu, { key: 'ArrowDown' });
        expect(menuItems[0]).toHaveFocus();
        expect(menuItems[0]).toHaveAttribute('tabIndex', '0');
        expect(menuItems[1]).toHaveAttribute('tabIndex', '-1');
        expect(menuItems[0]).toHaveClass('bg-slate-700');

        // Navigate down to second item
        fireEvent.keyDown(menu, { key: 'ArrowDown' });
        expect(menuItems[1]).toHaveFocus();
        expect(menuItems[1]).toHaveAttribute('tabIndex', '0');
        expect(menuItems[0]).toHaveAttribute('tabIndex', '-1');
        expect(menuItems[1]).toHaveClass('bg-slate-700');

        // Should wrap around to first item
        fireEvent.keyDown(menu, { key: 'ArrowDown' });
        expect(menuItems[0]).toHaveFocus();
        expect(menuItems[0]).toHaveAttribute('tabIndex', '0');
        expect(menuItems[1]).toHaveAttribute('tabIndex', '-1');
        expect(menuItems[0]).toHaveClass('bg-slate-700');
    });

    it('navigates menu items with arrow up key', () => {
        render(<StatusMenu {...defaultProps} canDelete={true} />);

        const trigger = screen.getByRole('button', { name: 'メニュー' });
        fireEvent.click(trigger);

        const menu = screen.getByRole('menu');
        const menuItems = screen.getAllByRole('menuitem');

        // Navigate up (should wrap to last item)
        fireEvent.keyDown(menu, { key: 'ArrowUp' });
        expect(menuItems[1]).toHaveFocus();
        expect(menuItems[1]).toHaveAttribute('tabIndex', '0');
        expect(menuItems[0]).toHaveAttribute('tabIndex', '-1');
        expect(menuItems[1]).toHaveClass('bg-slate-700');
    });

    it('calls onDelete when delete is clicked', () => {
        render(<StatusMenu {...defaultProps} canDelete={true} />);

        const trigger = screen.getByRole('button', { name: 'メニュー' });
        fireEvent.click(trigger);

        const deleteButton = screen.getByText('削除');
        fireEvent.click(deleteButton);

        expect(mockOnDelete).toHaveBeenCalledTimes(1);
    });

    it('copies link to clipboard when copy is clicked', async () => {
        const mockWriteText = vi.fn().mockResolvedValue(undefined);
        Object.assign(navigator, {
            clipboard: { writeText: mockWriteText },
        });

        render(<StatusMenu {...defaultProps} />);

        const trigger = screen.getByRole('button', { name: 'メニュー' });
        fireEvent.click(trigger);

        const copyButton = screen.getByText('リンクをコピー');
        fireEvent.click(copyButton);

        expect(mockWriteText).toHaveBeenCalledWith('https://mastodon.social/@test/123');
    });

    it('shows success message after copying', async () => {
        const mockWriteText = vi.fn().mockResolvedValue(undefined);
        Object.assign(navigator, {
            clipboard: { writeText: mockWriteText },
        });

        render(<StatusMenu {...defaultProps} />);

        const trigger = screen.getByRole('button', { name: 'メニュー' });
        fireEvent.click(trigger);

        const copyButton = screen.getByText('リンクをコピー');
        fireEvent.click(copyButton);

        await waitFor(() => {
            expect(screen.getByText('コピーしました')).toBeInTheDocument();
        });
    });

    it('has correct aria attributes', () => {
        render(<StatusMenu {...defaultProps} />);

        const trigger = screen.getByRole('button', { name: 'メニュー' });
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        expect(trigger).toHaveAttribute('aria-haspopup', 'menu');

        fireEvent.click(trigger);

        expect(trigger).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByRole('menu')).toHaveAttribute('aria-orientation', 'vertical');
    });

    it('disables trigger when disabled prop is true', () => {
        render(<StatusMenu {...defaultProps} disabled={true} />);

        const trigger = screen.getByRole('button', { name: 'メニュー' });
        expect(trigger).toBeDisabled();
    });

    it('does not open menu when disabled', () => {
        render(<StatusMenu {...defaultProps} disabled={true} />);

        const trigger = screen.getByRole('button', { name: 'メニュー' });
        fireEvent.click(trigger);

        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
});
