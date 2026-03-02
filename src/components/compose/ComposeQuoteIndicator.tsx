import { LuQuote } from 'react-icons/lu';

export interface QuoteToStatus {
    id: string;
    acct: string;
    displayName: string;
    content: string;
    avatar: string;
}

interface ComposeQuoteIndicatorProps {
    quoteToStatus: QuoteToStatus;
}

/**
 * Quote indicator component showing the target status
 */
export function ComposeQuoteIndicator({ quoteToStatus }: ComposeQuoteIndicatorProps) {
    return (
        <div className="mb-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
            <div className="flex items-center gap-2 mb-2 text-sm text-purple-400">
                <LuQuote className="w-4 h-4" aria-hidden="true" />
                <span>引用先:</span>
            </div>
            <div className="flex items-start gap-2">
                <img src={quoteToStatus.avatar} alt="" className="w-8 h-8 rounded-lg shrink-0" />
                <div className="min-w-0">
                    <div className="text-sm text-slate-200 font-medium truncate">
                        {quoteToStatus.displayName}
                    </div>
                    <div className="text-xs text-slate-400 truncate">@{quoteToStatus.acct}</div>
                    <div
                        className="text-sm text-slate-300 mt-1 line-clamp-2 status-content"
                        dangerouslySetInnerHTML={{ __html: quoteToStatus.content }}
                    />
                </div>
            </div>
        </div>
    );
}
