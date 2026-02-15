import { LuGlobe, LuLockOpen, LuLock, LuMail } from 'react-icons/lu';
import type { IconType } from 'react-icons';

/**
 * Mastodon status visibility types
 */
export type Visibility = 'public' | 'unlisted' | 'private' | 'direct';

/**
 * Metadata for a visibility level, including display label and icon
 */
export interface VisibilityMeta {
    label: string;
    icon: IconType;
}

/**
 * Mapping of visibility types to their display metadata (Japanese labels and Lucide icons)
 */
export const VISIBILITY_META: Record<Visibility, VisibilityMeta> = {
    public: { label: '公開', icon: LuGlobe },
    unlisted: { label: '未収載', icon: LuLockOpen },
    private: { label: 'フォロワーのみ', icon: LuLock },
    direct: { label: 'ダイレクト', icon: LuMail },
};

const FALLBACK_META: VisibilityMeta = { label: '公開範囲不明', icon: LuGlobe };

/**
 * Returns the visibility metadata for a given visibility value.
 * Falls back to a default "unknown" meta for unrecognized values from federated instances.
 */
export function getVisibilityMeta(value: unknown): VisibilityMeta {
    if (typeof value === 'string' && value in VISIBILITY_META) {
        return VISIBILITY_META[value as Visibility];
    }
    return FALLBACK_META;
}
