import { LuGlobe, LuLockOpen, LuLock, LuMail } from 'react-icons/lu';
import type { IconType } from 'react-icons';

export type Visibility = 'public' | 'unlisted' | 'private' | 'direct';

export interface VisibilityMeta {
    label: string;
    icon: IconType;
}

export const VISIBILITY_META: Record<Visibility, VisibilityMeta> = {
    public: { label: '公開', icon: LuGlobe },
    unlisted: { label: '未収載', icon: LuLockOpen },
    private: { label: 'フォロワーのみ', icon: LuLock },
    direct: { label: 'ダイレクト', icon: LuMail },
};

const FALLBACK_META: VisibilityMeta = { label: '公開範囲不明', icon: LuGlobe };

export function getVisibilityMeta(value: unknown): VisibilityMeta {
    if (typeof value === 'string' && value in VISIBILITY_META) {
        return VISIBILITY_META[value as Visibility];
    }
    return FALLBACK_META;
}
