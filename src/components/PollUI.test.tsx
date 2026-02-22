import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PollUI } from './PollUI';
import type { mastodon } from 'masto';

const createMockPoll = (overrides: Partial<mastodon.v1.Poll> = {}): mastodon.v1.Poll => ({
    id: 'poll-1',
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    expired: false,
    multiple: false,
    votesCount: 100,
    votersCount: 80,
    voted: false,
    ownVotes: [],
    options: [
        { title: 'Option A', votesCount: 60, emojis: [] },
        { title: 'Option B', votesCount: 40, emojis: [] },
    ],
    emojis: [],
    ...overrides,
});

describe('PollUI', () => {
    const defaultProps = {
        selectedOptions: new Set<number>(),
        pollLoading: false,
        pollRefreshing: false,
        canVote: true,
        canRefresh: true,
        pollCountdown: '残り1日',
        onOptionToggle: vi.fn(),
        onVote: vi.fn(() => Promise.resolve()),
        onRefresh: vi.fn(() => Promise.resolve()),
    } as const;

    describe('voting UI', () => {
        it('should render radio buttons for single-choice poll', () => {
            const poll = createMockPoll({ multiple: false });
            render(<PollUI {...defaultProps} poll={poll} variant="card" />);

            const radioInputs = document.querySelectorAll('input[type="radio"]');
            expect(radioInputs).toHaveLength(2);
        });

        it('should render checkboxes for multiple-choice poll', () => {
            const poll = createMockPoll({ multiple: true });
            render(<PollUI {...defaultProps} poll={poll} variant="card" />);

            const checkboxInputs = document.querySelectorAll('input[type="checkbox"]');
            expect(checkboxInputs).toHaveLength(2);
        });

        it('should show vote button', () => {
            const poll = createMockPoll();
            render(<PollUI {...defaultProps} poll={poll} variant="card" />);

            expect(screen.getByRole('button', { name: '投票' })).toBeInTheDocument();
        });

        it('should disable vote button when no options selected', () => {
            const poll = createMockPoll();
            render(<PollUI {...defaultProps} poll={poll} variant="card" />);

            expect(screen.getByRole('button', { name: '投票' })).toBeDisabled();
        });

        it('should enable vote button when option is selected', async () => {
            const user = userEvent.setup();
            const poll = createMockPoll();
            const onOptionToggle = vi.fn();

            render(
                <PollUI
                    {...defaultProps}
                    poll={poll}
                    onOptionToggle={onOptionToggle}
                    variant="card"
                />
            );

            await user.click(screen.getByText('Option A'));
            expect(onOptionToggle).toHaveBeenCalledWith(0);
        });

        it('should disable inputs while loading', () => {
            const poll = createMockPoll();
            render(<PollUI {...defaultProps} poll={poll} pollLoading={true} variant="card" />);

            const inputs = document.querySelectorAll('input');
            inputs.forEach((input) => {
                expect(input).toBeDisabled();
            });
        });

        it('should show loading text while voting', () => {
            const poll = createMockPoll();
            render(<PollUI {...defaultProps} poll={poll} pollLoading={true} variant="card" />);

            expect(screen.getByRole('button', { name: /投票中/ })).toBeInTheDocument();
        });
    });

    describe('results UI', () => {
        it('should show results when canVote is false', () => {
            const poll = createMockPoll({ voted: true, ownVotes: [0] });
            render(<PollUI {...defaultProps} poll={poll} canVote={false} variant="card" />);

            expect(screen.getByText('60%')).toBeInTheDocument();
            expect(screen.getByText('40%')).toBeInTheDocument();
        });

        it('should show checkmark for own votes', () => {
            const poll = createMockPoll({ voted: true, ownVotes: [0] });
            render(<PollUI {...defaultProps} poll={poll} canVote={false} variant="card" />);

            const checkmark = screen.getByText('✓');
            expect(checkmark).toBeInTheDocument();
        });

        it('should show vote count', () => {
            const poll = createMockPoll({ votesCount: 150 });
            render(<PollUI {...defaultProps} poll={poll} canVote={false} variant="card" />);

            expect(screen.getByText(/150票/)).toBeInTheDocument();
        });

        it('should show countdown for active poll', () => {
            const poll = createMockPoll({ expired: false });
            render(
                <PollUI
                    {...defaultProps}
                    poll={poll}
                    canVote={false}
                    pollCountdown="残り2時間"
                    variant="card"
                />
            );

            expect(screen.getByText(/残り2時間/)).toBeInTheDocument();
        });

        it('should show ended status for expired poll', () => {
            const poll = createMockPoll({ expired: true });
            render(<PollUI {...defaultProps} poll={poll} canVote={false} variant="card" />);

            expect(screen.getByText(/終了/)).toBeInTheDocument();
        });

        it('should show refresh button for non-expired poll', () => {
            const poll = createMockPoll({ expired: false });
            render(<PollUI {...defaultProps} poll={poll} canVote={false} variant="card" />);

            expect(screen.getByRole('button', { name: '投票結果を更新' })).toBeInTheDocument();
        });

        it('should not show refresh button for expired poll', () => {
            const poll = createMockPoll({ expired: true });
            render(<PollUI {...defaultProps} poll={poll} canVote={false} variant="card" />);

            expect(
                screen.queryByRole('button', { name: '投票結果を更新' })
            ).not.toBeInTheDocument();
        });

        it('should disable refresh button when cannot refresh', () => {
            const poll = createMockPoll({ expired: false });
            render(
                <PollUI
                    {...defaultProps}
                    poll={poll}
                    canVote={false}
                    canRefresh={false}
                    variant="card"
                />
            );

            expect(screen.getByRole('button', { name: '投票結果を更新' })).toBeDisabled();
        });

        it('should show refreshing state', () => {
            const poll = createMockPoll({ expired: false });
            render(
                <PollUI
                    {...defaultProps}
                    poll={poll}
                    canVote={false}
                    pollRefreshing={true}
                    variant="card"
                />
            );

            expect(screen.getByText('更新中...')).toBeInTheDocument();
        });

        it('should call onRefresh when refresh button clicked', async () => {
            const user = userEvent.setup();
            const poll = createMockPoll({ expired: false });
            const onRefresh = vi.fn(() => Promise.resolve());

            render(
                <PollUI
                    {...defaultProps}
                    poll={poll}
                    canVote={false}
                    onRefresh={onRefresh}
                    variant="card"
                />
            );

            await user.click(screen.getByRole('button', { name: '投票結果を更新' }));
            expect(onRefresh).toHaveBeenCalledTimes(1);
        });
    });

    describe('variant styles', () => {
        it('should apply card variant classes', () => {
            const poll = createMockPoll();
            const { container } = render(<PollUI {...defaultProps} poll={poll} variant="card" />);

            const fieldset = container.querySelector('fieldset');
            expect(fieldset).toHaveClass('mt-3');
            expect(fieldset).toHaveClass('rounded-lg');
        });

        it('should apply detail variant classes', () => {
            const poll = createMockPoll();
            const { container } = render(<PollUI {...defaultProps} poll={poll} variant="detail" />);

            const fieldset = container.querySelector('fieldset');
            expect(fieldset).toHaveClass('mb-4');
            expect(fieldset).toHaveClass('rounded-xl');
        });

        it('should show larger refresh icon in detail variant', () => {
            const poll = createMockPoll({ expired: false, voted: true });
            const { container } = render(
                <PollUI {...defaultProps} poll={poll} canVote={false} variant="detail" />
            );

            const refreshIcon = container.querySelector('svg');
            expect(refreshIcon).toHaveClass('w-3.5');
            expect(refreshIcon).toHaveClass('h-3.5');
        });

        it('should show smaller refresh icon in card variant', () => {
            const poll = createMockPoll({ expired: false, voted: true });
            const { container } = render(
                <PollUI {...defaultProps} poll={poll} canVote={false} variant="card" />
            );

            const refreshIcon = container.querySelector('svg');
            expect(refreshIcon).toHaveClass('w-3');
            expect(refreshIcon).toHaveClass('h-3');
        });
    });

    describe('accessibility', () => {
        it('should have screen reader legend', () => {
            const poll = createMockPoll();
            render(<PollUI {...defaultProps} poll={poll} variant="card" />);

            const legend = document.querySelector('legend.sr-only');
            expect(legend).toHaveTextContent('投票');
        });

        it('should have aria-busy on vote button when loading', () => {
            const poll = createMockPoll();
            render(<PollUI {...defaultProps} poll={poll} pollLoading={true} variant="card" />);

            expect(screen.getByRole('button', { name: /投票中/ })).toHaveAttribute(
                'aria-busy',
                'true'
            );
        });
    });
});
