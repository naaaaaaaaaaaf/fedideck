import type { mastodon } from 'masto';

const hasVoteCount = (value: number | null | undefined): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0;

export function getPollOptionVotesSum(options: mastodon.v1.PollOption[] = []): number {
    return options.reduce(
        (sum, option) => sum + (hasVoteCount(option.votesCount) ? option.votesCount : 0),
        0
    );
}

export function getPollVotesDenominator(poll: mastodon.v1.Poll): number {
    const pollVotesCount = hasVoteCount(poll.votesCount) ? poll.votesCount : 0;
    if (pollVotesCount > 0) {
        return pollVotesCount;
    }

    const optionVotesSum = getPollOptionVotesSum(poll.options ?? []);
    return optionVotesSum > 0 ? optionVotesSum : 0;
}

export function mergePollWithFallback(
    previousPoll: mastodon.v1.Poll | null | undefined,
    nextPoll: mastodon.v1.Poll
): mastodon.v1.Poll {
    const nextOptions = nextPoll.options ?? [];
    const nextVotesCount = hasVoteCount(nextPoll.votesCount) ? nextPoll.votesCount : 0;

    if (!previousPoll || previousPoll.id !== nextPoll.id) {
        const optionVotesSum = getPollOptionVotesSum(nextOptions);
        const normalizedVotesCount = nextVotesCount > 0 ? nextVotesCount : optionVotesSum;
        return { ...nextPoll, options: nextOptions, votesCount: normalizedVotesCount };
    }

    const previousOptions = previousPoll.options ?? [];
    const previousVotesCount = hasVoteCount(previousPoll.votesCount) ? previousPoll.votesCount : 0;
    // Some servers omit unpublished totals. Treat all-zero snapshots as partial
    // when we already had visible votes to avoid regressing to 0% UI.
    const looksLikeUnpublishedTotals =
        nextVotesCount === 0 &&
        previousVotesCount > 0 &&
        nextOptions.every((option) => !hasVoteCount(option.votesCount) || option.votesCount === 0);

    const mergedOptions = nextOptions.map((option, index) => {
        const previousOption = previousOptions[index];
        if (!previousOption) return option;

        if (!hasVoteCount(option.votesCount) && hasVoteCount(previousOption.votesCount)) {
            return { ...option, votesCount: previousOption.votesCount };
        }
        if (
            looksLikeUnpublishedTotals &&
            option.votesCount === 0 &&
            hasVoteCount(previousOption.votesCount) &&
            previousOption.votesCount > 0
        ) {
            return { ...option, votesCount: previousOption.votesCount };
        }
        return option;
    });

    const mergedOptionVotesSum = getPollOptionVotesSum(mergedOptions);
    const mergedVotesCount =
        nextVotesCount > 0
            ? nextVotesCount
            : mergedOptionVotesSum > 0
              ? mergedOptionVotesSum
              : previousVotesCount;

    return {
        ...previousPoll,
        ...nextPoll,
        voted: nextPoll.voted ?? previousPoll.voted,
        ownVotes: nextPoll.ownVotes ?? previousPoll.ownVotes,
        votersCount: nextPoll.votersCount ?? previousPoll.votersCount,
        options: mergedOptions,
        votesCount: mergedVotesCount,
    };
}
