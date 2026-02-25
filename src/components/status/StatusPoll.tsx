import React from 'react';
import type { mastodon } from 'masto';
import { LuRefreshCw } from 'react-icons/lu';
import { getPollVotesDenominator } from '../../utils/poll';

interface StatusPollProps {
    /** The poll data */
    poll: mastodon.v1.Poll;
    /** Currently selected option indices */
    selectedOptions: ReadonlySet<number>;
    /** Whether a vote is in progress */
    pollLoading: boolean;
    /** Whether a refresh is in progress */
    pollRefreshing: boolean;
    /** Whether the user can vote */
    canVote: boolean;
    /** Whether the poll can be refreshed */
    canRefresh: boolean;
    /** Formatted countdown string */
    pollCountdown: string | null;
    /** Callback when an option is toggled */
    onOptionToggle: (index: number) => void;
    /** Callback when vote button is clicked */
    onVote: () => void;
    /** Callback when refresh button is clicked */
    onRefresh: () => void;
    /** Size variant for styling */
    variant?: 'card' | 'detail';
    /** Additional CSS classes */
    className?: string;
}

/**
 * Displays a poll with voting UI or results UI.
 * Supports multiple choice and single choice polls.
 */
export const StatusPoll = React.memo(function StatusPoll({
    poll,
    selectedOptions,
    pollLoading,
    pollRefreshing,
    canVote,
    canRefresh,
    pollCountdown,
    onOptionToggle,
    onVote,
    onRefresh,
    variant = 'card',
    className = '',
}: StatusPollProps) {
    if (!poll.options || poll.options.length === 0) {
        return null;
    }

    const isDetail = variant === 'detail';

    // Variant-specific styles
    const fieldsetClass = isDetail
        ? 'mb-4 p-4 bg-slate-800/50 rounded-xl'
        : 'mt-3 p-3 bg-slate-800/50 rounded-lg';
    const labelGap = isDetail ? 'gap-3' : 'gap-2';
    const labelMargin = isDetail ? 'mb-3' : 'mb-2';
    const labelPadding = isDetail ? 'p-2 rounded-lg' : 'p-2 rounded';
    const optionTextClass = isDetail ? 'text-slate-200' : 'text-sm';
    const buttonMargin = isDetail ? 'mt-3' : 'mt-2';
    const buttonPadding = isDetail ? 'py-2' : 'py-1.5';
    const resultMargin = isDetail ? 'mb-3' : 'mb-2';
    const progressHeight = isDetail ? 'h-2.5' : 'h-2';
    const progressRounded = isDetail ? 'rounded-full' : 'rounded';

    return (
        <fieldset className={`${fieldsetClass} ${className}`}>
            <legend className="sr-only">投票</legend>
            {canVote ? (
                // Voting UI
                <>
                    {poll.options.map((option, i) => (
                        <label
                            key={`${poll.id}-${i}`}
                            className={`flex items-center ${labelGap} ${labelMargin} last:mb-0 cursor-pointer hover:bg-slate-700/30 ${labelPadding}`}
                        >
                            <input
                                type={poll.multiple ? 'checkbox' : 'radio'}
                                name={`poll-${poll.id}`}
                                checked={selectedOptions.has(i)}
                                onChange={() => onOptionToggle(i)}
                                disabled={pollLoading}
                                className="w-4 h-4 accent-indigo-500"
                            />
                            <span className={optionTextClass}>{option.title}</span>
                        </label>
                    ))}
                    <button
                        type="button"
                        onClick={onVote}
                        disabled={selectedOptions.size === 0 || pollLoading}
                        aria-busy={pollLoading}
                        className={`${buttonMargin} px-4 ${buttonPadding} text-sm rounded-lg transition-colors ${
                            selectedOptions.size === 0 || pollLoading
                                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                        }`}
                    >
                        {pollLoading ? '投票中...' : '投票'}
                    </button>
                </>
            ) : (
                // Results UI
                <>
                    {poll.options.map((option, i) => {
                        const votesCount = getPollVotesDenominator(poll);
                        const percentage =
                            votesCount > 0
                                ? Math.round(((option.votesCount ?? 0) / votesCount) * 100)
                                : 0;
                        const isOwnVote = poll.ownVotes?.includes(i) ?? false;
                        return (
                            <div key={`${poll.id}-${i}`} className={`${resultMargin} last:mb-0`}>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className={isDetail ? 'text-slate-200' : ''}>
                                        {isOwnVote && (
                                            <span className="text-indigo-400 mr-1">✓</span>
                                        )}
                                        {option.title}
                                    </span>
                                    <span className="text-slate-400">{percentage}%</span>
                                </div>
                                <div
                                    className={`${progressHeight} bg-slate-700 ${progressRounded} overflow-hidden`}
                                >
                                    <div
                                        className={`h-full transition-all ${
                                            isOwnVote ? 'bg-indigo-400' : 'bg-indigo-500'
                                        }`}
                                        style={{ width: `${percentage}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                    <div className="text-xs text-slate-400 mt-2 flex items-center justify-between">
                        <span>
                            {getPollVotesDenominator(poll)}票
                            {poll.expired
                                ? ' · 終了'
                                : pollCountdown && <span> · {pollCountdown}</span>}
                        </span>
                        {!poll.expired && (
                            <button
                                type="button"
                                onClick={onRefresh}
                                disabled={!canRefresh || pollRefreshing}
                                className="text-indigo-400 hover:text-indigo-300 disabled:opacity-50 inline-flex items-center gap-1"
                                aria-label="投票結果を更新"
                            >
                                <LuRefreshCw
                                    className={`w-3 h-3 ${pollRefreshing ? 'animate-spin' : ''}`}
                                    aria-hidden="true"
                                />
                                {pollRefreshing ? '更新中...' : '更新'}
                            </button>
                        )}
                    </div>
                </>
            )}
        </fieldset>
    );
});
