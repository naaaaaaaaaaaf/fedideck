import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComposeQuoteIndicator } from './ComposeQuoteIndicator';

describe('ComposeQuoteIndicator', () => {
    const mockQuoteToStatus = {
        id: 'quote-456',
        acct: 'quoted@example.com',
        displayName: 'Quoted User',
        content: '<p>Quoted post content</p>',
        avatar: 'https://example.com/quoted-avatar.png',
    };

    it('should render quote indicator', () => {
        render(<ComposeQuoteIndicator quoteToStatus={mockQuoteToStatus} />);

        expect(screen.getByText('引用先:')).toBeInTheDocument();
    });

    it('should display display name', () => {
        render(<ComposeQuoteIndicator quoteToStatus={mockQuoteToStatus} />);

        expect(screen.getByText('Quoted User')).toBeInTheDocument();
    });

    it('should display acct', () => {
        render(<ComposeQuoteIndicator quoteToStatus={mockQuoteToStatus} />);

        expect(screen.getByText('@quoted@example.com')).toBeInTheDocument();
    });

    it('should display avatar', () => {
        render(<ComposeQuoteIndicator quoteToStatus={mockQuoteToStatus} />);

        const avatar = document.querySelector('img');
        expect(avatar).toHaveAttribute('src', 'https://example.com/quoted-avatar.png');
    });

    it('should render HTML content', () => {
        render(<ComposeQuoteIndicator quoteToStatus={mockQuoteToStatus} />);

        const contentDiv = document.querySelector('.status-content');
        expect(contentDiv?.innerHTML).toBe('<p>Quoted post content</p>');
    });
});
