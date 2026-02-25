import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBody } from './StatusBody';
import type { mastodon } from 'masto';

const createMockEmoji = (
    overrides: Partial<mastodon.v1.CustomEmoji> = {}
): mastodon.v1.CustomEmoji => ({
    shortcode: 'test',
    url: 'https://example.com/emoji.png',
    staticUrl: 'https://example.com/emoji-static.png',
    visibleInPicker: true,
    ...overrides,
});

describe('StatusBody', () => {
    const defaultProps = {
        content: '<p>Hello world</p>',
        emojis: [] as mastodon.v1.CustomEmoji[],
    };

    it('renders content', () => {
        render(<StatusBody {...defaultProps} />);

        expect(screen.getByText('Hello world')).toBeInTheDocument();
    });

    it('renders content without content warning', () => {
        render(<StatusBody {...defaultProps} />);

        // Should not have details element
        expect(screen.queryByRole('group')).not.toBeInTheDocument();
    });

    it('renders content warning when spoilerText is provided', () => {
        render(<StatusBody {...defaultProps} spoilerText="Warning: spoiler" />);

        expect(screen.getByText('Warning: spoiler')).toBeInTheDocument();
    });

    it('renders content warning icon', () => {
        render(<StatusBody {...defaultProps} spoilerText="Warning" />);

        const icon = document.querySelector('svg');
        expect(icon).toBeInTheDocument();
    });

    it('hides main content when spoilerText is provided', () => {
        render(<StatusBody {...defaultProps} spoilerText="Warning" />);

        // Content is inside details element, not visible initially in card variant
        const details = screen.getByRole('group');
        expect(details).toBeInTheDocument();
    });

    it('applies card variant styles by default', () => {
        render(<StatusBody {...defaultProps} />);

        const content = screen.getByText('Hello world').closest('div');
        expect(content).toHaveClass('mt-2');
    });

    it('applies detail variant styles', () => {
        render(<StatusBody {...defaultProps} variant="detail" />);

        const content = screen.getByText('Hello world').closest('div');
        expect(content).toHaveClass('text-lg', 'leading-relaxed');
    });

    it('opens details by default in detail variant', () => {
        render(<StatusBody {...defaultProps} spoilerText="Warning" variant="detail" />);

        const details = screen.getByRole('group');
        expect(details).toHaveAttribute('open');
    });

    it('does not open details by default in card variant', () => {
        render(<StatusBody {...defaultProps} spoilerText="Warning" variant="card" />);

        const details = screen.getByRole('group');
        expect(details).not.toHaveAttribute('open');
    });

    it('applies custom className', () => {
        render(<StatusBody {...defaultProps} className="custom-class" />);

        const container = screen.getByText('Hello world').closest('div')?.parentElement;
        expect(container).toHaveClass('custom-class');
    });

    it('replaces emojis in content', () => {
        const emojis = [
            createMockEmoji({ shortcode: 'wave', url: 'https://example.com/wave.png' }),
        ];
        const content = '<p>Hello :wave:</p>';

        render(<StatusBody content={content} emojis={emojis} />);

        const img = document.querySelector('img');
        expect(img).toHaveAttribute('alt', ':wave:');
        expect(img).toHaveAttribute('src', 'https://example.com/wave.png');
    });

    it('renders complex HTML content', () => {
        const content =
            '<p>Text with <a href="https://example.com">link</a> and <strong>bold</strong></p>';

        render(<StatusBody {...defaultProps} content={content} />);

        expect(screen.getByRole('link', { name: 'link' })).toBeInTheDocument();
        expect(screen.getByText('bold')).toBeInTheDocument();
    });

    it('renders empty content gracefully', () => {
        render(<StatusBody content="" emojis={[]} />);

        // Should render without errors
        const container = document.querySelector('.status-content');
        expect(container).toBeInTheDocument();
    });
});
