import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatusReplyIndicator } from './StatusReplyIndicator';
import type { mastodon } from 'masto';

const createMockMention = (
    overrides: Partial<mastodon.v1.StatusMention> = {}
): mastodon.v1.StatusMention => ({
    id: '1',
    username: 'testuser',
    url: 'https://example.com/@testuser',
    acct: 'testuser@example.com',
    ...overrides,
});

describe('StatusReplyIndicator', () => {
    const defaultProps = {
        inReplyToId: 'status-123',
        inReplyToAccountId: 'account-456',
        mentions: [] as mastodon.v1.StatusMention[],
    };

    it('renders nothing when inReplyToId is null', () => {
        const { container } = render(<StatusReplyIndicator {...defaultProps} inReplyToId={null} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders reply indicator', () => {
        render(<StatusReplyIndicator {...defaultProps} />);

        expect(screen.getByText('返信')).toBeInTheDocument();
    });

    it('shows reply target when mention is found', () => {
        const mentions = [
            createMockMention({
                id: 'account-456',
                username: 'replytarget',
                acct: 'replytarget@example.com',
            }),
        ];

        render(<StatusReplyIndicator {...defaultProps} mentions={mentions} />);

        expect(screen.getByText('@replytarget@example.com への返信')).toBeInTheDocument();
    });

    it('shows generic text when mention is not found', () => {
        const mentions = [
            createMockMention({
                id: 'other-account',
                username: 'otheruser',
                acct: 'otheruser@example.com',
            }),
        ];

        render(<StatusReplyIndicator {...defaultProps} mentions={mentions} />);

        expect(screen.getByText('返信')).toBeInTheDocument();
    });

    it('renders reply icon', () => {
        render(<StatusReplyIndicator {...defaultProps} />);

        const icon = document.querySelector('svg');
        expect(icon).toHaveClass('text-blue-400');
    });

    it('is not clickable when onClick is not provided', () => {
        render(<StatusReplyIndicator {...defaultProps} />);

        const indicator = screen.getByText('返信').parentElement;
        expect(indicator).not.toHaveAttribute('role', 'button');
    });

    it('is clickable when onClick is provided', () => {
        const onClick = vi.fn();
        render(<StatusReplyIndicator {...defaultProps} onClick={onClick} />);

        const indicator = screen.getByRole('button', { name: 'スレッドを表示' });
        expect(indicator).toBeInTheDocument();
    });

    it('calls onClick when clicked', () => {
        const onClick = vi.fn();
        render(<StatusReplyIndicator {...defaultProps} onClick={onClick} />);

        fireEvent.click(screen.getByRole('button', { name: 'スレッドを表示' }));
        expect(onClick).toHaveBeenCalled();
    });

    it('handles keyboard interaction', () => {
        const onClick = vi.fn();
        render(<StatusReplyIndicator {...defaultProps} onClick={onClick} />);

        const indicator = screen.getByRole('button', { name: 'スレッドを表示' });
        fireEvent.keyDown(indicator, { key: 'Enter' });
        expect(onClick).toHaveBeenCalled();
    });

    it('handles space key interaction', () => {
        const onClick = vi.fn();
        render(<StatusReplyIndicator {...defaultProps} onClick={onClick} />);

        const indicator = screen.getByRole('button', { name: 'スレッドを表示' });
        fireEvent.keyDown(indicator, { key: ' ' });
        expect(onClick).toHaveBeenCalled();
    });

    it('stops propagation on click', () => {
        const onClick = vi.fn();
        const parentClick = vi.fn();

        render(
            <div onClick={parentClick}>
                <StatusReplyIndicator {...defaultProps} onClick={onClick} />
            </div>
        );

        fireEvent.click(screen.getByRole('button', { name: 'スレッドを表示' }));
        expect(onClick).toHaveBeenCalled();
        expect(parentClick).not.toHaveBeenCalled();
    });

    it('applies custom className', () => {
        render(<StatusReplyIndicator {...defaultProps} className="custom-class" />);

        const indicator = screen.getByText('返信').parentElement;
        expect(indicator).toHaveClass('custom-class');
    });

    it('applies hover styles when clickable', () => {
        const onClick = vi.fn();
        render(<StatusReplyIndicator {...defaultProps} onClick={onClick} />);

        const indicator = screen.getByRole('button', { name: 'スレッドを表示' });
        expect(indicator).toHaveClass('cursor-pointer', 'hover:text-slate-300');
    });

    it('truncates long reply text', () => {
        const mentions = [
            createMockMention({
                id: 'account-456',
                username: 'verylongusername',
                acct: 'verylongusername@verylonginstance.example.com',
            }),
        ];

        render(<StatusReplyIndicator {...defaultProps} mentions={mentions} />);

        const textSpan = screen.getByText(/への返信/);
        expect(textSpan).toHaveClass('truncate');
    });
});
