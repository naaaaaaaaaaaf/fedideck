import { beforeEach, describe, expect, it } from 'vitest';
import { useModalsStore } from './modals';
import type { mastodon } from 'masto';

function mockStatus(id: string): mastodon.v1.Status {
    return { id } as mastodon.v1.Status;
}

function mockAccount(id: string): mastodon.v1.Account {
    return { id } as mastodon.v1.Account;
}

describe('useModalsStore', () => {
    beforeEach(() => {
        useModalsStore.setState({
            stack: [],
            compose: null,
            confirm: null,
            imageViewer: null,
            videoViewer: null,
            audioPlayer: null,
            isLoginOpen: false,
            isAddColumnOpen: false,
            confirmLoading: false,
            confirmError: null,
            deletedStatusRef: undefined,
        });
    });

    // ── Navigation Stack ──────────────────────────────────────────────────

    describe('navigation stack', () => {
        it('pushes statusDetail entries', () => {
            const status = mockStatus('s1');
            useModalsStore.getState().pushStatusDetail(status, 'acct-1');

            const { stack } = useModalsStore.getState();
            expect(stack).toHaveLength(1);
            expect(stack[0].type).toBe('statusDetail');
            if (stack[0].type === 'statusDetail') {
                expect(stack[0].status.id).toBe('s1');
                expect(stack[0].accountSessionId).toBe('acct-1');
            }
        });

        it('pushes profile entries', () => {
            const account = mockAccount('a1');
            useModalsStore.getState().pushProfile(account, 'acct-1');

            const { stack } = useModalsStore.getState();
            expect(stack).toHaveLength(1);
            expect(stack[0].type).toBe('profile');
            if (stack[0].type === 'profile') {
                expect(stack[0].account.id).toBe('a1');
                expect(stack[0].accountSessionId).toBe('acct-1');
            }
        });

        it('replaces top profile when same account id and session', () => {
            useModalsStore.getState().pushProfile(mockAccount('a1'), 'acct-1');
            // Push another profile on top
            useModalsStore.getState().pushProfile(mockAccount('a2'), 'acct-2');
            // Now push a2 again with same session - should replace top
            const a2Updated = mockAccount('a2');
            useModalsStore.getState().pushProfile(a2Updated, 'acct-2');

            const { stack } = useModalsStore.getState();
            expect(stack).toHaveLength(2);
            const top = stack[1];
            expect(top.type).toBe('profile');
            if (top.type === 'profile') {
                expect(top.account).toBe(a2Updated);
                expect(top.accountSessionId).toBe('acct-2');
            }
        });

        it('does not replace if top entry is statusDetail even if same status id', () => {
            const status = mockStatus('s1');

            useModalsStore.getState().pushStatusDetail(status, 'acct-1');
            // pushProfile with different account should just push, not replace
            const account = mockAccount('a1');
            useModalsStore.getState().pushProfile(account, undefined);

            const { stack } = useModalsStore.getState();
            expect(stack).toHaveLength(2);
        });

        it('does not replace top profile when same account id but different session', () => {
            useModalsStore.getState().pushProfile(mockAccount('a1'), 'acct-1');
            // Same account id, different session — should push, not replace
            useModalsStore.getState().pushProfile(mockAccount('a1'), 'acct-2');

            const { stack } = useModalsStore.getState();
            expect(stack).toHaveLength(2);
        });

        it('goBack pops the top entry', () => {
            useModalsStore.getState().pushStatusDetail(mockStatus('s1'), 'acct-1');
            useModalsStore.getState().pushProfile(mockAccount('a1'), 'acct-1');

            useModalsStore.getState().goBack();

            const { stack } = useModalsStore.getState();
            expect(stack).toHaveLength(1);
            expect(stack[0].type).toBe('statusDetail');
        });

        it('goBack on empty stack is a no-op', () => {
            useModalsStore.getState().goBack();
            expect(useModalsStore.getState().stack).toHaveLength(0);
        });

        it('clearStack removes all entries', () => {
            useModalsStore.getState().pushStatusDetail(mockStatus('s1'), 'acct-1');
            useModalsStore.getState().pushProfile(mockAccount('a1'), 'acct-1');

            useModalsStore.getState().clearStack();

            expect(useModalsStore.getState().stack).toHaveLength(0);
        });

        it('caps stack at MAX_STACK_DEPTH (6)', () => {
            for (let i = 0; i < 8; i++) {
                useModalsStore.getState().pushStatusDetail(mockStatus(`s${i}`), 'acct-1');
            }

            const { stack } = useModalsStore.getState();
            expect(stack).toHaveLength(6);
            // oldest entries should be dropped
            expect(stack[0].type).toBe('statusDetail');
            if (stack[0].type === 'statusDetail') {
                expect(stack[0].status.id).toBe('s2');
            }
        });

        it('updateStackStatus updates matching statusDetail', () => {
            useModalsStore.getState().pushStatusDetail(mockStatus('s1'), 'acct-1');
            const updated = mockStatus('s1');
            (updated as { content: string }).content = 'edited';

            useModalsStore.getState().updateStackStatus('s1', updated);

            const { stack } = useModalsStore.getState();
            expect(stack).toHaveLength(1);
            if (stack[0].type === 'statusDetail') {
                expect(stack[0].status.content).toBe('edited');
            }
        });

        it('updateStackStatus does not affect profile entries', () => {
            useModalsStore.getState().pushProfile(mockAccount('a1'), 'acct-1');

            useModalsStore.getState().updateStackStatus('s1', mockStatus('s1'));

            const { stack } = useModalsStore.getState();
            expect(stack).toHaveLength(1);
            expect(stack[0].type).toBe('profile');
        });

        it('updateStackStatus matches reblog wrapper', () => {
            const reblogStatus = mockStatus('s1');
            const wrapper = {
                ...mockStatus('w1'),
                reblog: reblogStatus,
            } as mastodon.v1.Status;
            useModalsStore.getState().pushStatusDetail(wrapper, 'acct-1');

            const updated = mockStatus('s1');
            (updated as { content: string }).content = 'edited-reblog';
            useModalsStore.getState().updateStackStatus('s1', updated);

            const { stack } = useModalsStore.getState();
            if (stack[0].type === 'statusDetail') {
                // Wrapper is preserved, only reblog is updated
                expect(stack[0].status.id).toBe('w1');
                expect(stack[0].status.reblog).toBe(updated);
            }
        });

        it('updateStackPoll updates direct match', () => {
            const status = { ...mockStatus('s1'), poll: { id: 'p1' } } as mastodon.v1.Status;
            useModalsStore.getState().pushStatusDetail(status, 'acct-1');

            const newPoll = { id: 'p1', voted: true } as mastodon.v1.Poll;
            useModalsStore.getState().updateStackPoll('s1', newPoll);

            const { stack } = useModalsStore.getState();
            if (stack[0].type === 'statusDetail') {
                expect(stack[0].status.poll).toBe(newPoll);
            }
        });

        it('updateStackPoll updates reblog match', () => {
            const inner = { ...mockStatus('s1'), poll: { id: 'p1' } } as mastodon.v1.Status;
            const wrapper = {
                ...mockStatus('w1'),
                reblog: inner,
            } as mastodon.v1.Status;
            useModalsStore.getState().pushStatusDetail(wrapper, 'acct-1');

            const newPoll = { id: 'p1', voted: true } as mastodon.v1.Poll;
            useModalsStore.getState().updateStackPoll('s1', newPoll);

            const { stack } = useModalsStore.getState();
            if (stack[0].type === 'statusDetail') {
                expect(stack[0].status.reblog?.poll).toBe(newPoll);
            }
        });

        it('removeStatusFromStack removes matching direct and reblog entries', () => {
            useModalsStore.getState().pushStatusDetail(mockStatus('s1'), 'acct-1');
            useModalsStore.getState().pushProfile(mockAccount('a1'), 'acct-1');
            const reblogWrapper = {
                ...mockStatus('w1'),
                reblog: mockStatus('s2'),
            } as mastodon.v1.Status;
            useModalsStore.getState().pushStatusDetail(reblogWrapper, 'acct-1');

            // Stack: [detail-s1, profile-a1, detail-w1(reblog=s2)]
            expect(useModalsStore.getState().stack).toHaveLength(3);

            // Remove s1 — only first detail should be removed
            useModalsStore
                .getState()
                .removeStatusFromStack({ statusId: 's1', accountSessionId: 'acct-1' });
            const afterFirst = useModalsStore.getState().stack;
            expect(afterFirst).toHaveLength(2);
            expect(afterFirst[0].type).toBe('profile');

            // Remove s2 — reblog wrapper detail should be removed
            useModalsStore
                .getState()
                .removeStatusFromStack({ statusId: 's2', accountSessionId: 'acct-1' });
            expect(useModalsStore.getState().stack).toHaveLength(1);
            expect(useModalsStore.getState().stack[0].type).toBe('profile');
        });

        it('removeStatusFromStack keeps unrelated entries', () => {
            useModalsStore.getState().pushStatusDetail(mockStatus('s1'), 'acct-1');
            useModalsStore.getState().pushStatusDetail(mockStatus('s2'), 'acct-1');

            useModalsStore.getState().removeStatusFromStack({
                statusId: 's-nonexistent',
                accountSessionId: 'acct-1',
            });
            expect(useModalsStore.getState().stack).toHaveLength(2);
        });

        it('removeStatusFromStack only removes entries for matching accountSessionId', () => {
            useModalsStore.getState().pushStatusDetail(mockStatus('s1'), 'acct-1');
            useModalsStore.getState().pushStatusDetail(mockStatus('s1'), 'acct-2');

            useModalsStore.getState().removeStatusFromStack({
                statusId: 's1',
                accountSessionId: 'acct-1',
            });

            const stack = useModalsStore.getState().stack;
            expect(stack).toHaveLength(1);
            expect(stack[0].type).toBe('statusDetail');
            if (stack[0].type === 'statusDetail') {
                expect(stack[0].accountSessionId).toBe('acct-2');
            }
        });
    });

    // ── Overlays ──────────────────────────────────────────────────────────

    describe('compose overlay', () => {
        it('opens and closes', () => {
            useModalsStore.getState().openCompose({ mode: 'new', accountId: 'acct-1' });
            expect(useModalsStore.getState().compose).toEqual({ mode: 'new', accountId: 'acct-1' });

            useModalsStore.getState().closeCompose();
            expect(useModalsStore.getState().compose).toBeNull();
        });
    });

    describe('confirm overlay', () => {
        it('opens with loading/error reset and closes', () => {
            const status = mockStatus('s1');
            useModalsStore.getState().setConfirmLoading(true);
            useModalsStore.getState().setConfirmError('err');

            useModalsStore.getState().openConfirm({ status, accountId: 'acct-1' });

            expect(useModalsStore.getState().confirm).toEqual({
                status,
                accountId: 'acct-1',
            });
            expect(useModalsStore.getState().confirmLoading).toBe(false);
            expect(useModalsStore.getState().confirmError).toBeNull();

            useModalsStore.getState().closeConfirm();
            expect(useModalsStore.getState().confirm).toBeNull();
        });

        it('does not close while loading', () => {
            const status = mockStatus('s1');
            useModalsStore.getState().openConfirm({ status, accountId: 'acct-1' });
            useModalsStore.getState().setConfirmLoading(true);

            useModalsStore.getState().closeConfirm();
            expect(useModalsStore.getState().confirm).not.toBeNull();
        });
    });

    // ── Viewers ───────────────────────────────────────────────────────────

    describe('imageViewer', () => {
        it('opens with auto-incremented key and closes', () => {
            useModalsStore.getState().openImageViewer([{ url: 'http://example.com/img.png' }], 2);

            const data = useModalsStore.getState().imageViewer;
            expect(data).not.toBeNull();
            expect(data!.images).toHaveLength(1);
            expect(data!.initialIndex).toBe(2);
            expect(data!.key).toBeGreaterThan(0);

            const key1 = data!.key;

            useModalsStore.getState().closeImageViewer();
            expect(useModalsStore.getState().imageViewer).toBeNull();

            // Reopen should get a new key
            useModalsStore.getState().openImageViewer([{ url: 'http://example.com/img2.png' }], 0);
            expect(useModalsStore.getState().imageViewer!.key).toBeGreaterThan(key1);
        });
    });

    describe('videoViewer', () => {
        it('opens and closes', () => {
            useModalsStore
                .getState()
                .openVideoViewer([{ url: 'http://example.com/vid.mp4', type: 'video' }], 0);

            expect(useModalsStore.getState().videoViewer).not.toBeNull();
            useModalsStore.getState().closeVideoViewer();
            expect(useModalsStore.getState().videoViewer).toBeNull();
        });
    });

    describe('audioPlayer', () => {
        it('opens and closes', () => {
            useModalsStore.getState().openAudioPlayer([{ url: 'http://example.com/audio.mp3' }], 0);

            expect(useModalsStore.getState().audioPlayer).not.toBeNull();
            useModalsStore.getState().closeAudioPlayer();
            expect(useModalsStore.getState().audioPlayer).toBeNull();
        });
    });

    // ── Utility Modals ────────────────────────────────────────────────────

    describe('utility modals', () => {
        it('opens and closes login modal', () => {
            useModalsStore.getState().openLogin();
            expect(useModalsStore.getState().isLoginOpen).toBe(true);

            useModalsStore.getState().closeLogin();
            expect(useModalsStore.getState().isLoginOpen).toBe(false);
        });

        it('opens and closes addColumn modal', () => {
            useModalsStore.getState().openAddColumn();
            expect(useModalsStore.getState().isAddColumnOpen).toBe(true);

            useModalsStore.getState().closeAddColumn();
            expect(useModalsStore.getState().isAddColumnOpen).toBe(false);
        });
    });

    // ── Confirm sub-state ─────────────────────────────────────────────────

    describe('confirm sub-state', () => {
        it('manages deletedStatusRef', () => {
            useModalsStore
                .getState()
                .setDeletedStatusRef({ statusId: 's1', accountSessionId: 'acct-1' });
            expect(useModalsStore.getState().deletedStatusRef).toEqual({
                statusId: 's1',
                accountSessionId: 'acct-1',
            });

            useModalsStore.getState().setDeletedStatusRef(undefined);
            expect(useModalsStore.getState().deletedStatusRef).toBeUndefined();
        });
    });
});
