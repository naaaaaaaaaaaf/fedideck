import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatusPoll } from './StatusPoll';
import type { mastodon } from 'masto';

const createMockPoll = (overrides: Partial<mastodon.v1.Poll> = {}): mastodon.v1.Poll =>
    ({
        id: 'poll-1',
        expiresAt: new Date(Date.now() + 86400000).toISOString(), // 24 hours from now
        expired: false,
        multiple: false,
        votesCount: 100,
        votersCount: 80,
        options: [
            { title: 'Option A', votesCount: 60 },
            { title: 'Option B', votesCount: 40 },
        ],
        ...overrides,
    }) as mastodon.v1.Poll;

describe('StatusPoll', () => {
    const defaultProps = {
        poll: createMockPoll(),
        selectedOptions: new Set<number>(),
        pollLoading: false,
        pollRefreshing: false,
        canVote: true,
        canRefresh: true,
        pollCountdown: '残り1日',
        onOptionToggle: vi.fn(),
        onVote: vi.fn(),
        onRefresh: vi.fn(),
    };

    it('renders voting UI when canVote is true', () => {
        render(<StatusPoll {...defaultProps} />);

        // Legend is sr-only, so check for the fieldset and options instead
        expect(screen.getByRole('group')).toBeInTheDocument();
        expect(screen.getByText('Option A')).toBeInTheDocument();
        expect(screen.getByText('Option B')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '投票' })).toBeInTheDocument();
    });

    it('renders results UI when canVote is false', () => {
        render(<StatusPoll {...defaultProps} canVote={false} />);

        expect(screen.getByText('60%')).toBeInTheDocument();
        expect(screen.getByText('40%')).toBeInTheDocument();
        expect(screen.getByText('100票')).toBeInTheDocument();
    });

    it('renders radio inputs for single choice poll', () => {
        render(<StatusPoll {...defaultProps} poll={createMockPoll({ multiple: false })} />);

        const radios = screen.getAllByRole('radio');
        expect(radios.length).toBe(2);
    });

    it('renders checkbox inputs for multiple choice poll', () => {
        render(<StatusPoll {...defaultProps} poll={createMockPoll({ multiple: true })} />);

        const checkboxes = screen.getAllByRole('checkbox');
        expect(checkboxes.length).toBe(2);
    });

    it('calls onOptionToggle when option is clicked', () => {
        const onOptionToggle = vi.fn();
        render(<StatusPoll {...defaultProps} onOptionToggle={onOptionToggle} />);

        const firstOption = screen.getByLabelText('Option A');
        fireEvent.click(firstOption);

        expect(onOptionToggle).toHaveBeenCalledWith(0);
    });

    it('calls onVote when vote button is clicked', () => {
        const onVote = vi.fn();
        const selectedOptions = new Set([0]);
        render(<StatusPoll {...defaultProps} selectedOptions={selectedOptions} onVote={onVote} />);

        const voteButton = screen.getByRole('button', { name: '投票' });
        fireEvent.click(voteButton);

        expect(onVote).toHaveBeenCalled();
    });

    it('disables vote button when no options selected', () => {
        render(<StatusPoll {...defaultProps} selectedOptions={new Set()} />);

        const voteButton = screen.getByRole('button', { name: '投票' });
        expect(voteButton).toBeDisabled();
    });

    it('disables vote button during loading', () => {
        const selectedOptions = new Set([0]);
        render(
            <StatusPoll {...defaultProps} selectedOptions={selectedOptions} pollLoading={true} />
        );

        const voteButton = screen.getByRole('button', { name: '投票中...' });
        expect(voteButton).toBeDisabled();
    });

    it('shows countdown in results UI', () => {
        render(<StatusPoll {...defaultProps} canVote={false} pollCountdown="残り1日" />);

        expect(screen.getByText(/残り1日/)).toBeInTheDocument();
    });

    it('shows expired status when poll is expired', () => {
        render(
            <StatusPoll
                {...defaultProps}
                canVote={false}
                poll={createMockPoll({ expired: true })}
                pollCountdown={null}
            />
        );

        expect(screen.getByText(/終了/)).toBeInTheDocument();
    });

    it('calls onRefresh when refresh button is clicked', () => {
        const onRefresh = vi.fn();
        render(<StatusPoll {...defaultProps} canVote={false} onRefresh={onRefresh} />);

        const refreshButton = screen.getByRole('button', { name: '投票結果を更新' });
        fireEvent.click(refreshButton);

        expect(onRefresh).toHaveBeenCalled();
    });

    it('hides refresh button when poll is expired', () => {
        render(
            <StatusPoll
                {...defaultProps}
                canVote={false}
                poll={createMockPoll({ expired: true })}
            />
        );

        expect(screen.queryByRole('button', { name: '投票結果を更新' })).not.toBeInTheDocument();
    });

    it('disables refresh button during refreshing', () => {
        render(<StatusPoll {...defaultProps} canVote={false} pollRefreshing={true} />);

        // Find the refresh button by aria-label since the text changes
        const refreshButton = screen.getByRole('button', { name: '投票結果を更新' });
        expect(refreshButton).toBeDisabled();
        expect(refreshButton).toHaveTextContent('更新中...');
    });

    it('applies card variant styles by default', () => {
        render(<StatusPoll {...defaultProps} />);

        const fieldset = screen.getByRole('group');
        expect(fieldset).toHaveClass('mt-3', 'p-3', 'rounded-lg');
    });

    it('applies detail variant styles', () => {
        render(<StatusPoll {...defaultProps} variant="detail" />);

        const fieldset = screen.getByRole('group');
        expect(fieldset).toHaveClass('mb-4', 'p-4', 'rounded-xl');
    });

    it('applies custom className', () => {
        render(<StatusPoll {...defaultProps} className="custom-class" />);

        const fieldset = screen.getByRole('group');
        expect(fieldset).toHaveClass('custom-class');
    });

    it('shows own vote indicator in results', () => {
        render(
            <StatusPoll
                {...defaultProps}
                canVote={false}
                poll={createMockPoll({ ownVotes: [0] })}
            />
        );

        const checkmark = screen.getByText('✓');
        expect(checkmark).toBeInTheDocument();
    });

    it('renders nothing when poll has no options', () => {
        const { container } = render(
            <StatusPoll {...defaultProps} poll={createMockPoll({ options: [] })} />
        );

        expect(container.firstChild).toBeNull();
    });

    it('uses larger progress bar in detail variant', () => {
        render(<StatusPoll {...defaultProps} canVote={false} variant="detail" />);

        const progressBar = document.querySelector('.h-2\\.5');
        expect(progressBar).toBeInTheDocument();
    });

    it('uses smaller progress bar in card variant', () => {
        render(<StatusPoll {...defaultProps} canVote={false} variant="card" />);

        const progressBar = document.querySelector('.h-2:not(.h-2\\.5)');
        expect(progressBar).toBeInTheDocument();
    });
});
