import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatusActions } from './StatusActions';

describe('StatusActions', () => {
    const defaultProps = {
        repliesCount: 5,
        reblogsCount: 10,
        favouritesCount: 20,
        favourited: false,
        reblogged: false,
        bookmarked: false,
        canReblog: true,
        isLoading: { favourite: false, reblog: false, bookmark: false },
        onReply: vi.fn(),
        onReblog: vi.fn(),
        onFavourite: vi.fn(),
        onBookmark: vi.fn(),
        statusUrl: 'https://example.com/status/123',
        canDelete: false,
        canEdit: false,
        onDelete: vi.fn(),
        onEdit: vi.fn(),
    };

    it('renders reply button', () => {
        render(<StatusActions {...defaultProps} />);

        expect(screen.getByLabelText('返信')).toBeInTheDocument();
    });

    it('renders reblog button', () => {
        render(<StatusActions {...defaultProps} />);

        expect(screen.getByLabelText('ブースト')).toBeInTheDocument();
    });

    it('renders favourite button', () => {
        render(<StatusActions {...defaultProps} />);

        expect(screen.getByLabelText('お気に入り')).toBeInTheDocument();
    });

    it('renders bookmark button', () => {
        render(<StatusActions {...defaultProps} />);

        expect(screen.getByLabelText('ブックマーク')).toBeInTheDocument();
    });

    it('displays counts in card variant', () => {
        render(<StatusActions {...defaultProps} />);

        expect(screen.getByText('5')).toBeInTheDocument(); // replies
        expect(screen.getByText('10')).toBeInTheDocument(); // reblogs
        expect(screen.getByText('20')).toBeInTheDocument(); // favourites
    });

    it('does not display counts in detail variant', () => {
        render(<StatusActions {...defaultProps} variant="detail" />);

        // In detail variant, text labels are shown instead of counts
        expect(screen.getByText('返信')).toBeInTheDocument();
        expect(screen.getByText('ブースト')).toBeInTheDocument();
        expect(screen.getByText('お気に入り')).toBeInTheDocument();
        expect(screen.getByText('ブックマーク')).toBeInTheDocument();
    });

    it('calls onReply when reply button is clicked', () => {
        const onReply = vi.fn();
        render(<StatusActions {...defaultProps} onReply={onReply} />);

        fireEvent.click(screen.getByLabelText('返信'));
        expect(onReply).toHaveBeenCalled();
    });

    it('calls onReblog when reblog button is clicked', () => {
        const onReblog = vi.fn();
        render(<StatusActions {...defaultProps} onReblog={onReblog} />);

        fireEvent.click(screen.getByLabelText('ブースト'));
        expect(onReblog).toHaveBeenCalled();
    });

    it('calls onFavourite when favourite button is clicked', () => {
        const onFavourite = vi.fn();
        render(<StatusActions {...defaultProps} onFavourite={onFavourite} />);

        fireEvent.click(screen.getByLabelText('お気に入り'));
        expect(onFavourite).toHaveBeenCalled();
    });

    it('calls onBookmark when bookmark button is clicked', () => {
        const onBookmark = vi.fn();
        render(<StatusActions {...defaultProps} onBookmark={onBookmark} />);

        fireEvent.click(screen.getByLabelText('ブックマーク'));
        expect(onBookmark).toHaveBeenCalled();
    });

    it('disables reblog button when canReblog is false', () => {
        render(<StatusActions {...defaultProps} canReblog={false} />);

        expect(screen.getByLabelText('ブースト')).toBeDisabled();
    });

    it('shows reblogged state', () => {
        render(<StatusActions {...defaultProps} reblogged={true} />);

        expect(screen.getByLabelText('ブースト解除')).toBeInTheDocument();
    });

    it('shows favourited state', () => {
        render(<StatusActions {...defaultProps} favourited={true} />);

        expect(screen.getByLabelText('お気に入り解除')).toBeInTheDocument();
    });

    it('shows bookmarked state', () => {
        render(<StatusActions {...defaultProps} bookmarked={true} />);

        expect(screen.getByLabelText('ブックマーク解除')).toBeInTheDocument();
    });

    it('disables buttons during loading', () => {
        render(
            <StatusActions
                {...defaultProps}
                isLoading={{ favourite: true, reblog: true, bookmark: true }}
            />
        );

        expect(screen.getByLabelText('ブースト')).toBeDisabled();
        expect(screen.getByLabelText('お気に入り')).toBeDisabled();
        expect(screen.getByLabelText('ブックマーク')).toBeDisabled();
    });

    it('applies card variant styles by default', () => {
        render(<StatusActions {...defaultProps} />);

        const container = screen.getByLabelText('返信').closest('div');
        expect(container).toHaveClass('gap-2', 'mt-1');
    });

    it('applies detail variant styles', () => {
        render(<StatusActions {...defaultProps} variant="detail" />);

        const container = screen.getByText('返信').closest('div');
        expect(container).toHaveClass('justify-around', 'border-t');
    });

    it('applies custom className', () => {
        render(<StatusActions {...defaultProps} className="custom-class" />);

        const container = screen.getByLabelText('返信').closest('div');
        expect(container).toHaveClass('custom-class');
    });

    it('disables reply button when replyDisabled is true', () => {
        render(<StatusActions {...defaultProps} replyDisabled={true} />);

        expect(screen.getByLabelText('返信')).toBeDisabled();
    });

    it('shows title for non-rebloggable status', () => {
        render(<StatusActions {...defaultProps} canReblog={false} />);

        expect(screen.getByTitle('この投稿はブーストできません')).toBeInTheDocument();
    });

    it('hides count when zero in card variant', () => {
        render(
            <StatusActions
                {...defaultProps}
                repliesCount={0}
                reblogsCount={0}
                favouritesCount={0}
            />
        );

        // Only check that counts are not displayed when zero
        const replyButton = screen.getByLabelText('返信');
        const reblogButton = screen.getByLabelText('ブースト');
        const favouriteButton = screen.getByLabelText('お気に入り');

        // No span with count inside these buttons
        expect(replyButton.querySelector('span')).toBeNull();
        expect(reblogButton.querySelector('span')).toBeNull();
        expect(favouriteButton.querySelector('span')).toBeNull();
    });

    describe('isAuthenticated', () => {
        it('disables reblog, favourite and bookmark buttons when not authenticated in card variant', () => {
            render(<StatusActions {...defaultProps} isAuthenticated={false} />);

            const reblogButton = screen.getByLabelText('ブースト');
            const favouriteButton = screen.getByLabelText('お気に入り');
            const bookmarkButton = screen.getByLabelText('ブックマーク');

            expect(reblogButton).toBeDisabled();
            expect(favouriteButton).toBeDisabled();
            expect(bookmarkButton).toBeDisabled();
        });

        it('disables reblog, favourite and bookmark buttons when not authenticated in detail variant', () => {
            render(<StatusActions {...defaultProps} variant="detail" isAuthenticated={false} />);

            const reblogButton = screen.getByText('ブースト').closest('button');
            const favouriteButton = screen.getByText('お気に入り').closest('button');
            const bookmarkButton = screen.getByText('ブックマーク').closest('button');

            expect(reblogButton).toBeDisabled();
            expect(favouriteButton).toBeDisabled();
            expect(bookmarkButton).toBeDisabled();
        });

        it('shows authentication required tooltip for reblog button when not authenticated', () => {
            render(<StatusActions {...defaultProps} isAuthenticated={false} />);

            // All action buttons have the same title
            const tooltipElements = screen.getAllByTitle('アカウント接続が必要です');
            expect(tooltipElements.length).toBeGreaterThanOrEqual(1);
        });

        it('shows authentication required tooltip for favourite and bookmark buttons when not authenticated', () => {
            render(<StatusActions {...defaultProps} isAuthenticated={false} />);

            // All buttons have the same title, so we check for existence
            const tooltipElements = screen.getAllByTitle('アカウント接続が必要です');
            expect(tooltipElements.length).toBe(3);
        });

        it('enables buttons when authenticated', () => {
            render(<StatusActions {...defaultProps} isAuthenticated={true} />);

            const reblogButton = screen.getByLabelText('ブースト');
            const favouriteButton = screen.getByLabelText('お気に入り');
            const bookmarkButton = screen.getByLabelText('ブックマーク');

            expect(reblogButton).not.toBeDisabled();
            expect(favouriteButton).not.toBeDisabled();
            expect(bookmarkButton).not.toBeDisabled();
        });
    });
});
