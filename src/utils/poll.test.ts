import { describe, expect, it } from 'vitest';
import type { mastodon } from 'masto';
import { getPollVotesDenominator, mergePollWithFallback } from './poll';

const createPoll = (overrides: Partial<mastodon.v1.Poll> = {}): mastodon.v1.Poll => ({
    id: 'poll-1',
    expiresAt: null,
    expired: false,
    multiple: false,
    votesCount: 10,
    votersCount: 10,
    voted: true,
    ownVotes: [0],
    options: [
        { title: 'Option A', votesCount: 7, emojis: [] },
        { title: 'Option B', votesCount: 3, emojis: [] },
    ],
    ...overrides,
});

describe('poll utils', () => {
    describe('getPollVotesDenominator', () => {
        it('falls back to option vote sum when total votes is zero', () => {
            const poll = createPoll({
                votesCount: 0,
                options: [
                    { title: 'Option A', votesCount: 4, emojis: [] },
                    { title: 'Option B', votesCount: 2, emojis: [] },
                ],
            });

            expect(getPollVotesDenominator(poll)).toBe(6);
        });
    });

    describe('mergePollWithFallback', () => {
        it('preserves previous vote counts when incoming poll omits totals', () => {
            const previous = createPoll({
                votesCount: 12,
                options: [
                    { title: 'Option A', votesCount: 9, emojis: [] },
                    { title: 'Option B', votesCount: 3, emojis: [] },
                ],
            });
            const incoming = createPoll({
                votesCount: 0,
                options: [
                    { title: 'Option A', emojis: [] },
                    { title: 'Option B', emojis: [] },
                ],
            });

            const merged = mergePollWithFallback(previous, incoming);

            expect(merged.votesCount).toBe(12);
            expect(merged.options[0].votesCount).toBe(9);
            expect(merged.options[1].votesCount).toBe(3);
        });

        it('uses incoming counts when they are present', () => {
            const previous = createPoll();
            const incoming = createPoll({
                votesCount: 15,
                options: [
                    { title: 'Option A', votesCount: 10, emojis: [] },
                    { title: 'Option B', votesCount: 5, emojis: [] },
                ],
            });

            const merged = mergePollWithFallback(previous, incoming);

            expect(merged.votesCount).toBe(15);
            expect(merged.options[0].votesCount).toBe(10);
            expect(merged.options[1].votesCount).toBe(5);
        });
    });
});
