import type { mastodon } from 'masto';
import { LuRefreshCw } from 'react-icons/lu';

interface PollUIProps {
    poll: mastodon.v1.Poll;
    selectedOptions: ReadonlySet<number>;
    pollLoading: boolean;
    pollRefreshing: boolean;
    canVote: boolean;
    canRefresh: boolean;
    pollCountdown: string | null;
    onOptionToggle: (index: number) => void;
    onVote: () => void | Promise<void>;
    onRefresh: () => void | Promise<void>;
    /** Visual variant - 'card' for timeline cards, 'detail' for modal view */
    variant: 'card' | 'detail';
}

// Variant-specific class configurations
const variantClasses = {
    card: {
        fieldset: 'mt-3 p-3 bg-slate-800/50 rounded-lg',
        label: 'flex items-center gap-2 mb-2 last:mb-0 cursor-pointer hover:bg-slate-700/30 p-2 rounded',
        optionText: 'text-sm',
        voteButton: 'mt-2 px-4 py-1.5 text-sm rounded-lg',
        resultItem: 'mb-2 last:mb-0',
        progressBar: 'h-2 bg-slate-700 rounded overflow-hidden',
        progressFill: 'h-full transition-all',
        footer: 'text-xs text-slate-400 mt-2 flex items-center justify-between',
        refreshIcon: 'w-3 h-3',
    },
    detail: {
        fieldset: 'mb-4 p-4 bg-slate-800/50 rounded-xl',
        label: 'flex items-center gap-3 mb-3 last:mb-0 cursor-pointer hover:bg-slate-700/30 p-2 rounded-lg',
        optionText: 'text-slate-200',
        voteButton: 'mt-3 px-4 py-2 text-sm rounded-lg',
        resultItem: 'mb-3 last:mb-0',
        progressBar: 'h-2.5 bg-slate-700 rounded-full overflow-hidden',
        progressFill: 'h-full transition-all rounded-full',
        footer: 'text-sm text-slate-400 mt-3 pt-3 border-t border-slate-700 flex items-center justify-between',
        refreshIcon: 'w-3.5 h-3.5',
    },
} as const;

export function PollUI({
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
    variant,
}: PollUIProps) {
    const classes = variantClasses[variant];

    return (
        <fieldset className={classes.fieldset}>
            <legend className="sr-only">投票</legend>
            {canVote ? (
                // Voting UI
                <>
                    {poll.options.map((option, i) => (
                        <label key={`${poll.id}-${i}`} className={classes.label}>
                            <input
                                type={poll.multiple ? 'checkbox' : 'radio'}
                                name={`poll-${poll.id}`}
                                checked={selectedOptions.has(i)}
                                onChange={() => onOptionToggle(i)}
                                disabled={pollLoading}
                                className="w-4 h-4 accent-indigo-500"
                            />
                            <span className={classes.optionText}>{option.title}</span>
                        </label>
                    ))}
                    <button
                        type="button"
                        onClick={onVote}
                        disabled={selectedOptions.size === 0 || pollLoading}
                        aria-busy={pollLoading}
                        className={`${classes.voteButton} transition-colors ${
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
                        const votesCount = poll.votesCount ?? 0;
                        const percentage =
                            votesCount > 0
                                ? Math.round(((option.votesCount ?? 0) / votesCount) * 100)
                                : 0;
                        const isOwnVote = poll.ownVotes?.includes(i) ?? false;
                        return (
                            <div key={`${poll.id}-${i}`} className={classes.resultItem}>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className={variant === 'detail' ? 'text-slate-200' : ''}>
                                        {isOwnVote && (
                                            <span className="text-indigo-400 mr-1">✓</span>
                                        )}
                                        {option.title}
                                    </span>
                                    <span className="text-slate-400">{percentage}%</span>
                                </div>
                                <div className={classes.progressBar}>
                                    <div
                                        className={`${classes.progressFill} ${
                                            isOwnVote ? 'bg-indigo-400' : 'bg-indigo-500'
                                        }`}
                                        style={{ width: `${percentage}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                    <div className={classes.footer}>
                        <span>
                            {poll.votesCount ?? 0}票
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
                                    className={`${classes.refreshIcon} ${pollRefreshing ? 'animate-spin' : ''}`}
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
}
