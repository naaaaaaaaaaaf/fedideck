import { describe, it, expect } from 'vitest';
import {
    getVisibilityMeta,
    getVisibilityOptions,
    VISIBILITY_META,
    VISIBILITY_ORDER,
} from './statusVisibility';
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
            expect(getVisibilityMeta('unknown').label).toBe('不明');
            expect(getVisibilityMeta(null).label).toBe('不明');
            expect(getVisibilityMeta(undefined).label).toBe('不明');
        });

        it('プロトタイプ継承プロパティの場合はフォールバックを返す', () => {
            expect(getVisibilityMeta('toString').label).toBe('不明');
            expect(getVisibilityMeta('constructor').label).toBe('不明');
            expect(getVisibilityMeta('hasOwnProperty').label).toBe('不明');
        });
    });

    describe('getVisibilityOptions', () => {
        it('正しい順序で選択肢配列を返す', () => {
            const options = getVisibilityOptions();
            expect(options).toHaveLength(4);
            expect(options.map((o) => o.value)).toEqual(VISIBILITY_ORDER);
        });

        it('各選択肢が正しいメタ情報を持つ', () => {
            const options = getVisibilityOptions();
            const expectedLabels = ['公開', '未収載', 'フォロワーのみ', 'ダイレクト'];
            const expectedDescriptions = [
                '全員に表示',
                '公開タイムラインに表示しない',
                'フォロワーにのみ表示',
                'メンションしたユーザーにのみ表示',
            ];

            options.forEach((option, index) => {
                expect(option.value).toBe(VISIBILITY_ORDER[index]);
                expect(option.label).toBe(expectedLabels[index]);
                expect(option.description).toBe(expectedDescriptions[index]);
                expect(option.icon).toBeDefined();
            });
        });

        it('アイコンはReact要素としてレンダリングされる', () => {
            const options = getVisibilityOptions();
            options.forEach((option) => {
                expect(option.icon).not.toBeNull();
                expect(typeof option.icon).toBe('object');
            });
        });
    });
});
