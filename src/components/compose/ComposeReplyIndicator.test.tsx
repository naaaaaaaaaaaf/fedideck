import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComposeReplyIndicator } from './ComposeReplyIndicator';

describe('ComposeReplyIndicator', () => {
    const mockReplyToStatus = {
        id: 'reply-123',
        acct: 'someone@example.com',
        displayName: 'Someone',
        content: '<p>Original post content</p>',
        avatar: 'https://example.com/avatar.png',
    };

    it('should render reply indicator', () => {
        render(<ComposeReplyIndicator replyToStatus={mockReplyToStatus} />);

        expect(screen.getByText('返信先:')).toBeInTheDocument();
    });

    it('should display display name', () => {
        render(<ComposeReplyIndicator replyToStatus={mockReplyToStatus} />);

        expect(screen.getByText('Someone')).toBeInTheDocument();
    });

    it('should display acct', () => {
        render(<ComposeReplyIndicator replyToStatus={mockReplyToStatus} />);

        expect(screen.getByText('@someone@example.com')).toBeInTheDocument();
    });

    it('should display avatar', () => {
        render(<ComposeReplyIndicator replyToStatus={mockReplyToStatus} />);

        const avatar = document.querySelector('img');
        expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.png');
    });

    it('should render HTML content', () => {
        render(<ComposeReplyIndicator replyToStatus={mockReplyToStatus} />);

        const contentDiv = document.querySelector('.status-content');
        expect(contentDiv?.innerHTML).toBe('<p>Original post content</p>');
    });
});
