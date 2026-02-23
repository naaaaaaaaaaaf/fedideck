import { LuCornerUpLeft } from 'react-icons/lu';

interface ReplyToStatus {
    id: string;
    acct: string;
    displayName: string;
    content: string;
    avatar: string;
}

interface ComposeReplyIndicatorProps {
    replyToStatus: ReplyToStatus;
}

/**
 * Reply indicator component showing the target status
 */
export function ComposeReplyIndicator({ replyToStatus }: ComposeReplyIndicatorProps) {
    return (
        <div className="mb-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
            <div className="flex items-center gap-2 mb-2 text-sm text-slate-400">
                <LuCornerUpLeft className="w-4 h-4" aria-hidden="true" />
                <span>返信先:</span>
            </div>
            <div className="flex items-start gap-2">
                <img src={replyToStatus.avatar} alt="" className="w-8 h-8 rounded-lg shrink-0" />
                <div className="min-w-0">
                    <div className="text-sm text-slate-200 font-medium truncate">
                        {replyToStatus.displayName}
                    </div>
                    <div className="text-xs text-slate-400 truncate">@{replyToStatus.acct}</div>
                    <div
                        className="text-sm text-slate-300 mt-1 line-clamp-2 status-content"
                        dangerouslySetInnerHTML={{ __html: replyToStatus.content }}
                    />
                </div>
            </div>
        </div>
    );
}
