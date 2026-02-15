import { describe, it, expect } from 'vitest';
import { getVisibilityMeta, VISIBILITY_META } from './statusVisibility';
import { LuGlobe, LuLockOpen, LuLock, LuMail } from 'react-icons/lu';

describe('statusVisibility', () => {
    describe('VISIBILITY_META', () => {
        it('全てのvisibilityタイプが定義されている', () => {
            expect(VISIBILITY_META.public).toBeDefined();
            expect(VISIBILITY_META.unlisted).toBeDefined();
            expect(VISIBILITY_META.private).toBeDefined();
            expect(VISIBILITY_META.direct).toBeDefined();
        });
    });

    describe('getVisibilityMeta', () => {
        it.each([
            ['public', '公開', LuGlobe],
            ['unlisted', '未収載', LuLockOpen],
            ['private', 'フォロワーのみ', LuLock],
            ['direct', 'ダイレクト', LuMail],
        ] as const)(
            '%s の場合、正しいメタ情報を返す',
            (visibility, expectedLabel, ExpectedIcon) => {
                const meta = getVisibilityMeta(visibility);
                expect(meta.label).toBe(expectedLabel);
                expect(meta.icon).toBe(ExpectedIcon);
            }
        );

        it('不正な値の場合はフォールバックを返す', () => {
            expect(getVisibilityMeta('unknown').label).toBe('公開範囲不明');
            expect(getVisibilityMeta(null).label).toBe('公開範囲不明');
            expect(getVisibilityMeta(undefined).label).toBe('公開範囲不明');
        });

        it('プロトタイプ継承プロパティの場合はフォールバックを返す', () => {
            expect(getVisibilityMeta('toString').label).toBe('公開範囲不明');
            expect(getVisibilityMeta('constructor').label).toBe('公開範囲不明');
            expect(getVisibilityMeta('hasOwnProperty').label).toBe('公開範囲不明');
        });
    });
});
