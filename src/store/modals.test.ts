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
            deletedStatusEvents: [],
            updatedStatusEvents: [],
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

        it('clearStack removes all entries and events', () => {
            useModalsStore.getState().pushStatusDetail(mockStatus('s1'), 'acct-1');
            useModalsStore.getState().pushProfile(mockAccount('a1'), 'acct-1');
            useModalsStore.getState().pushDeletedStatusEvent({
                statusId: 's1',
                accountSessionId: 'acct-1',
            });

            useModalsStore.getState().clearStack();

            expect(useModalsStore.getState().stack).toHaveLength(0);
            expect(useModalsStore.getState().deletedStatusEvents).toHaveLength(0);
        });

        it('goBack clears events when stack becomes empty', () => {
            useModalsStore.getState().pushStatusDetail(mockStatus('s1'), 'acct-1');
            useModalsStore.getState().pushDeletedStatusEvent({
                statusId: 's2',
                accountSessionId: 'acct-1',
            });

            useModalsStore.getState().goBack();

            expect(useModalsStore.getState().stack).toHaveLength(0);
            expect(useModalsStore.getState().deletedStatusEvents).toHaveLength(0);
        });

        it('goBack preserves events when stack is not empty', () => {
            useModalsStore.getState().pushStatusDetail(mockStatus('s1'), 'acct-1');
            useModalsStore.getState().pushStatusDetail(mockStatus('s2'), 'acct-1');
            useModalsStore.getState().pushDeletedStatusEvent({
                statusId: 's3',
                accountSessionId: 'acct-1',
            });

            useModalsStore.getState().goBack();

            expect(useModalsStore.getState().stack).toHaveLength(1);
            expect(useModalsStore.getState().deletedStatusEvents).toHaveLength(1);
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

            useModalsStore
                .getState()
                .updateStackStatus({ statusId: 's1', accountSessionId: 'acct-1' }, updated);

            const { stack } = useModalsStore.getState();
            expect(stack).toHaveLength(1);
            if (stack[0].type === 'statusDetail') {
                expect(stack[0].status.content).toBe('edited');
            }
        });

        it('updateStackStatus does not affect profile entries', () => {
            useModalsStore.getState().pushProfile(mockAccount('a1'), 'acct-1');

            useModalsStore
                .getState()
                .updateStackStatus(
                    { statusId: 's1', accountSessionId: 'acct-1' },
                    mockStatus('s1')
                );

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
            useModalsStore
                .getState()
                .updateStackStatus({ statusId: 's1', accountSessionId: 'acct-1' }, updated);

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
            useModalsStore
                .getState()
                .updateStackPoll({ statusId: 's1', accountSessionId: 'acct-1' }, newPoll);

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
            useModalsStore
                .getState()
                .updateStackPoll({ statusId: 's1', accountSessionId: 'acct-1' }, newPoll);

            const { stack } = useModalsStore.getState();
            if (stack[0].type === 'statusDetail') {
                expect(stack[0].status.reblog?.poll).toBe(newPoll);
            }
        });

        it('updateStackStatus does not leak across accounts', () => {
            useModalsStore.getState().pushStatusDetail(mockStatus('s1'), 'acct-1');
            useModalsStore.getState().pushStatusDetail(mockStatus('s1'), 'acct-2');

            const updated = mockStatus('s1');
            (updated as { content: string }).content = 'edited-acct1';
            useModalsStore
                .getState()
                .updateStackStatus({ statusId: 's1', accountSessionId: 'acct-1' }, updated);

            const { stack } = useModalsStore.getState();
            // acct-1 entry should be updated
            const acct1Entry = stack.find(
                (e) => e.type === 'statusDetail' && e.accountSessionId === 'acct-1'
            );
            if (acct1Entry?.type === 'statusDetail') {
                expect(acct1Entry.status.content).toBe('edited-acct1');
            }
            // acct-2 entry should remain unchanged
            const acct2Entry = stack.find(
                (e) => e.type === 'statusDetail' && e.accountSessionId === 'acct-2'
            );
            if (acct2Entry?.type === 'statusDetail') {
                expect(acct2Entry.status.content).not.toBe('edited-acct1');
            }
        });

        it('updateStackPoll does not leak across accounts', () => {
            const status1 = { ...mockStatus('s1'), poll: { id: 'p1' } } as mastodon.v1.Status;
            const status2 = { ...mockStatus('s1'), poll: { id: 'p1' } } as mastodon.v1.Status;
            useModalsStore.getState().pushStatusDetail(status1, 'acct-1');
            useModalsStore.getState().pushStatusDetail(status2, 'acct-2');

            const newPoll = { id: 'p1', voted: true } as mastodon.v1.Poll;
            useModalsStore
                .getState()
                .updateStackPoll({ statusId: 's1', accountSessionId: 'acct-1' }, newPoll);

            const { stack } = useModalsStore.getState();
            const acct1Entry = stack.find(
                (e) => e.type === 'statusDetail' && e.accountSessionId === 'acct-1'
            );
            if (acct1Entry?.type === 'statusDetail') {
                expect(acct1Entry.status.poll).toBe(newPoll);
            }
            const acct2Entry = stack.find(
                (e) => e.type === 'statusDetail' && e.accountSessionId === 'acct-2'
            );
            if (acct2Entry?.type === 'statusDetail') {
                expect(acct2Entry.status.poll).not.toBe(newPoll);
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

        it('removeStatusFromStack prunes deletedStatusEvents when stack becomes empty', () => {
            useModalsStore.getState().pushStatusDetail(mockStatus('s1'), 'acct-1');
            useModalsStore
                .getState()
                .pushDeletedStatusEvent({ statusId: 's1', accountSessionId: 'acct-1' });
            expect(useModalsStore.getState().deletedStatusEvents).toHaveLength(1);

            useModalsStore
                .getState()
                .removeStatusFromStack({ statusId: 's1', accountSessionId: 'acct-1' });

            expect(useModalsStore.getState().stack).toHaveLength(0);
            expect(useModalsStore.getState().deletedStatusEvents).toHaveLength(0);
        });

        it('removeStatusFromStack preserves events when stack is not empty', () => {
            useModalsStore.getState().pushStatusDetail(mockStatus('s1'), 'acct-1');
            useModalsStore.getState().pushProfile(mockAccount('a1'), 'acct-1');
            useModalsStore
                .getState()
                .pushDeletedStatusEvent({ statusId: 's1', accountSessionId: 'acct-1' });

            useModalsStore
                .getState()
                .removeStatusFromStack({ statusId: 's1', accountSessionId: 'acct-1' });

            expect(useModalsStore.getState().stack).toHaveLength(1);
            expect(useModalsStore.getState().deletedStatusEvents).toHaveLength(1);
        });

        it('removeStackEntryById removes a specific entry by its id', () => {
            useModalsStore.getState().pushStatusDetail(mockStatus('s1'), 'acct-1');
            useModalsStore.getState().pushProfile(mockAccount('a1'), 'acct-1');
            useModalsStore.getState().pushStatusDetail(mockStatus('s2'), 'acct-1');

            const stack = useModalsStore.getState().stack;
            expect(stack).toHaveLength(3);
            const targetId = stack[1].id; // profile entry

            useModalsStore.getState().removeStackEntryById(targetId);

            const updated = useModalsStore.getState().stack;
            expect(updated).toHaveLength(2);
            expect(updated[0].type).toBe('statusDetail');
            expect(updated[1].type).toBe('statusDetail');
        });

        it('removeStackEntryById is a no-op for nonexistent id', () => {
            useModalsStore.getState().pushStatusDetail(mockStatus('s1'), 'acct-1');

            useModalsStore.getState().removeStackEntryById('nonexistent');
            expect(useModalsStore.getState().stack).toHaveLength(1);
        });

        it('removeStackEntryById prunes deletedStatusEvents when stack becomes empty', () => {
            useModalsStore.getState().pushStatusDetail(mockStatus('s1'), 'acct-1');
            useModalsStore
                .getState()
                .pushDeletedStatusEvent({ statusId: 's1', accountSessionId: 'acct-1' });
            expect(useModalsStore.getState().deletedStatusEvents).toHaveLength(1);

            const stack = useModalsStore.getState().stack;
            useModalsStore.getState().removeStackEntryById(stack[0].id);

            expect(useModalsStore.getState().stack).toHaveLength(0);
            expect(useModalsStore.getState().deletedStatusEvents).toHaveLength(0);
        });

        it('removeStackEntryById preserves events when stack is not empty', () => {
            useModalsStore.getState().pushStatusDetail(mockStatus('s1'), 'acct-1');
            useModalsStore.getState().pushProfile(mockAccount('a1'), 'acct-1');
            useModalsStore
                .getState()
                .pushDeletedStatusEvent({ statusId: 's1', accountSessionId: 'acct-1' });

            const stack = useModalsStore.getState().stack;
            useModalsStore.getState().removeStackEntryById(stack[0].id);

            expect(useModalsStore.getState().stack).toHaveLength(1);
            expect(useModalsStore.getState().deletedStatusEvents).toHaveLength(1);
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
        it('opens with error reset and closes', () => {
            const status = mockStatus('s1');
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
            useModalsStore.getState().openImageViewer([{ url: 'http://example.com/img.png' }], 0);

            const data = useModalsStore.getState().imageViewer;
            expect(data).not.toBeNull();
            expect(data!.images).toHaveLength(1);
            expect(data!.initialIndex).toBe(0);
            expect(data!.key).toBeGreaterThan(0);

            const key1 = data!.key;

            useModalsStore.getState().closeImageViewer();
            expect(useModalsStore.getState().imageViewer).toBeNull();

            // Reopen should get a new key
            useModalsStore.getState().openImageViewer([{ url: 'http://example.com/img2.png' }], 0);
            expect(useModalsStore.getState().imageViewer!.key).toBeGreaterThan(key1);
        });

        it('is a no-op when called with an empty array', () => {
            useModalsStore.getState().openImageViewer([], 0);
            expect(useModalsStore.getState().imageViewer).toBeNull();
        });

        it('clamps out-of-range index to valid bounds', () => {
            useModalsStore.getState().openImageViewer([{ url: 'http://example.com/img.png' }], 5);
            const data = useModalsStore.getState().imageViewer;
            expect(data).not.toBeNull();
            expect(data!.initialIndex).toBe(0);
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

        it('is a no-op when called with an empty array', () => {
            useModalsStore.getState().openVideoViewer([], 0);
            expect(useModalsStore.getState().videoViewer).toBeNull();
        });

        it('clamps out-of-range index to valid bounds', () => {
            useModalsStore
                .getState()
                .openVideoViewer([{ url: 'http://example.com/vid.mp4', type: 'video' }], 10);
            const data = useModalsStore.getState().videoViewer;
            expect(data).not.toBeNull();
            expect(data!.initialIndex).toBe(0);
        });
    });

    describe('audioPlayer', () => {
        it('opens and closes', () => {
            useModalsStore.getState().openAudioPlayer([{ url: 'http://example.com/audio.mp3' }], 0);

            expect(useModalsStore.getState().audioPlayer).not.toBeNull();
            useModalsStore.getState().closeAudioPlayer();
            expect(useModalsStore.getState().audioPlayer).toBeNull();
        });

        it('is a no-op when called with an empty array', () => {
            useModalsStore.getState().openAudioPlayer([], 0);
            expect(useModalsStore.getState().audioPlayer).toBeNull();
        });

        it('clamps out-of-range index to valid bounds', () => {
            useModalsStore
                .getState()
                .openAudioPlayer([{ url: 'http://example.com/audio.mp3' }], 99);
            const data = useModalsStore.getState().audioPlayer;
            expect(data).not.toBeNull();
            expect(data!.initialIndex).toBe(0);
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

        it('openLogin clears all overlay slots', () => {
            const status = mockStatus('s1');
            useModalsStore.getState().openCompose({ mode: 'new', accountId: 'acct-1' });
            useModalsStore.getState().openConfirm({ status, accountId: 'acct-1' });
            useModalsStore.getState().openImageViewer([{ url: 'http://example.com/img.png' }], 0);

            useModalsStore.getState().openLogin();

            const state = useModalsStore.getState();
            expect(state.isLoginOpen).toBe(true);
            expect(state.compose).toBeNull();
            expect(state.confirm).toBeNull();
            expect(state.imageViewer).toBeNull();
        });

        it('openAddColumn clears all overlay slots', () => {
            const status = mockStatus('s1');
            useModalsStore.getState().openCompose({ mode: 'new', accountId: 'acct-1' });
            useModalsStore.getState().openConfirm({ status, accountId: 'acct-1' });
            useModalsStore.getState().openImageViewer([{ url: 'http://example.com/img.png' }], 0);

            useModalsStore.getState().openAddColumn();

            const state = useModalsStore.getState();
            expect(state.isAddColumnOpen).toBe(true);
            expect(state.compose).toBeNull();
            expect(state.confirm).toBeNull();
            expect(state.imageViewer).toBeNull();
        });

        it('openCompose clears all overlay slots', () => {
            const status = mockStatus('s1');
            useModalsStore.getState().openConfirm({ status, accountId: 'acct-1' });
            useModalsStore.getState().openImageViewer([{ url: 'http://example.com/img.png' }], 0);
            useModalsStore
                .getState()
                .openVideoViewer([{ url: 'http://example.com/vid.mp4', type: 'video' }], 0);
            useModalsStore.getState().openAudioPlayer([{ url: 'http://example.com/audio.mp3' }], 0);

            useModalsStore.getState().openCompose({ mode: 'new', accountId: 'acct-1' });

            const state = useModalsStore.getState();
            expect(state.compose).not.toBeNull();
            expect(state.confirm).toBeNull();
            expect(state.imageViewer).toBeNull();
            expect(state.videoViewer).toBeNull();
            expect(state.audioPlayer).toBeNull();
            expect(state.confirmLoading).toBe(false);
            expect(state.confirmError).toBeNull();
        });

        it('openImageViewer clears all overlay slots', () => {
            const status = mockStatus('s1');
            useModalsStore.getState().openCompose({ mode: 'new', accountId: 'acct-1' });
            useModalsStore.getState().openConfirm({ status, accountId: 'acct-1' });
            useModalsStore
                .getState()
                .openVideoViewer([{ url: 'http://example.com/vid.mp4', type: 'video' }], 0);
            useModalsStore.getState().openAudioPlayer([{ url: 'http://example.com/audio.mp3' }], 0);

            useModalsStore.getState().openImageViewer([{ url: 'http://example.com/img.png' }], 0);

            const state = useModalsStore.getState();
            expect(state.imageViewer).not.toBeNull();
            expect(state.compose).toBeNull();
            expect(state.confirm).toBeNull();
            expect(state.videoViewer).toBeNull();
            expect(state.audioPlayer).toBeNull();
        });

        it('openVideoViewer clears all overlay slots', () => {
            const status = mockStatus('s1');
            useModalsStore.getState().openCompose({ mode: 'new', accountId: 'acct-1' });
            useModalsStore.getState().openConfirm({ status, accountId: 'acct-1' });
            useModalsStore.getState().openImageViewer([{ url: 'http://example.com/img.png' }], 0);

            useModalsStore
                .getState()
                .openVideoViewer([{ url: 'http://example.com/vid.mp4', type: 'video' }], 0);

            const state = useModalsStore.getState();
            expect(state.videoViewer).not.toBeNull();
            expect(state.compose).toBeNull();
            expect(state.confirm).toBeNull();
            expect(state.imageViewer).toBeNull();
        });

        it('openAudioPlayer clears all overlay slots', () => {
            const status = mockStatus('s1');
            useModalsStore.getState().openCompose({ mode: 'new', accountId: 'acct-1' });
            useModalsStore.getState().openConfirm({ status, accountId: 'acct-1' });
            useModalsStore.getState().openImageViewer([{ url: 'http://example.com/img.png' }], 0);

            useModalsStore.getState().openAudioPlayer([{ url: 'http://example.com/audio.mp3' }], 0);

            const state = useModalsStore.getState();
            expect(state.audioPlayer).not.toBeNull();
            expect(state.compose).toBeNull();
            expect(state.confirm).toBeNull();
            expect(state.imageViewer).toBeNull();
        });
    });

    // ── Confirm sub-state ─────────────────────────────────────────────────

    describe('confirm sub-state', () => {
        it('pushDeletedStatusEvent adds event with unique eventId', () => {
            useModalsStore.getState().pushDeletedStatusEvent({
                statusId: 's1',
                accountSessionId: 'acct-1',
            });
            const events = useModalsStore.getState().deletedStatusEvents;
            expect(events).toHaveLength(1);
            expect(events[0].statusId).toBe('s1');
            expect(events[0].accountSessionId).toBe('acct-1');
            expect(events[0].eventId).toBeTruthy();
        });

        it('pushDeletedStatusEvent accumulates multiple events', () => {
            useModalsStore.getState().pushDeletedStatusEvent({
                statusId: 's1',
                accountSessionId: 'acct-1',
            });
            useModalsStore.getState().pushDeletedStatusEvent({
                statusId: 's2',
                accountSessionId: 'acct-1',
            });
            const events = useModalsStore.getState().deletedStatusEvents;
            expect(events).toHaveLength(2);
            expect(events[0].statusId).toBe('s1');
            expect(events[1].statusId).toBe('s2');
            expect(events[0].eventId).not.toBe(events[1].eventId);
        });

        it('pruneDeletedStatusEvents removes specified events by eventId', () => {
            useModalsStore.getState().pushDeletedStatusEvent({
                statusId: 's1',
                accountSessionId: 'acct-1',
            });
            useModalsStore.getState().pushDeletedStatusEvent({
                statusId: 's2',
                accountSessionId: 'acct-1',
            });
            const [first] = useModalsStore.getState().deletedStatusEvents;
            useModalsStore.getState().pruneDeletedStatusEvents([first.eventId]);
            const remaining = useModalsStore.getState().deletedStatusEvents;
            expect(remaining).toHaveLength(1);
            expect(remaining[0].statusId).toBe('s2');
        });

        it('pruneDeletedStatusEvents leaves non-matching events', () => {
            useModalsStore.getState().pushDeletedStatusEvent({
                statusId: 's1',
                accountSessionId: 'acct-1',
            });
            useModalsStore.getState().pruneDeletedStatusEvents(['nonexistent-id']);
            expect(useModalsStore.getState().deletedStatusEvents).toHaveLength(1);
        });

        it('allows confirmLoading to block closeConfirm', () => {
            const status = mockStatus('s1');
            useModalsStore.getState().openConfirm({ status, accountId: 'acct-1' });
            useModalsStore.getState().setConfirmLoading(true);

            // closeConfirm is a no-op while loading
            useModalsStore.getState().closeConfirm();
            expect(useModalsStore.getState().confirm).not.toBeNull();

            // After resetting loading, closeConfirm works
            useModalsStore.getState().setConfirmLoading(false);
            useModalsStore.getState().closeConfirm();
            expect(useModalsStore.getState().confirm).toBeNull();
        });

        it('resets confirmLoading and confirmError on openConfirm when not loading', () => {
            const status1 = mockStatus('s1');
            useModalsStore.getState().openConfirm({ status: status1, accountId: 'acct-1' });
            useModalsStore.getState().setConfirmError('some error');

            const status2 = mockStatus('s2');
            useModalsStore.getState().openConfirm({ status: status2, accountId: 'acct-2' });
            expect(useModalsStore.getState().confirmLoading).toBe(false);
            expect(useModalsStore.getState().confirmError).toBeNull();
            expect(useModalsStore.getState().confirm!.status.id).toBe('s2');
        });

        it('does not overwrite confirm while confirmLoading is true', () => {
            const status1 = mockStatus('s1');
            useModalsStore.getState().openConfirm({ status: status1, accountId: 'acct-1' });
            useModalsStore.getState().setConfirmLoading(true);
            useModalsStore.getState().setConfirmError('some error');

            const status2 = mockStatus('s2');
            useModalsStore.getState().openConfirm({ status: status2, accountId: 'acct-2' });
            // Confirm should remain unchanged because loading was in progress
            expect(useModalsStore.getState().confirm!.status.id).toBe('s1');
            expect(useModalsStore.getState().confirmLoading).toBe(true);
            expect(useModalsStore.getState().confirmError).toBe('some error');
        });

        it('preserves originStackEntryId through openConfirm', () => {
            const status = mockStatus('s1');
            useModalsStore
                .getState()
                .openConfirm({ status, accountId: 'acct-1', originStackEntryId: 'stack-42' });

            const confirm = useModalsStore.getState().confirm;
            expect(confirm).not.toBeNull();
            expect(confirm!.originStackEntryId).toBe('stack-42');
        });
    });

    // ── Integration Scenarios ────────────────────────────────────────────

    describe('handleStatusDeleted (atomic action)', () => {
        it('pushes event when a ProfileModal consumer exists in stack', () => {
            useModalsStore.getState().pushStatusDetail(mockStatus('s1'), 'acct-1');
            useModalsStore.getState().pushProfile(mockAccount('a1'), 'acct-1');

            useModalsStore.getState().handleStatusDeleted({
                statusId: 's1',
                accountSessionId: 'acct-1',
            });

            // statusDetail removed, profile remains
            const stack = useModalsStore.getState().stack;
            expect(stack).toHaveLength(1);
            expect(stack[0].type).toBe('profile');
            // Event was pushed because ProfileModal consumer exists
            expect(useModalsStore.getState().deletedStatusEvents).toHaveLength(1);
            expect(useModalsStore.getState().deletedStatusEvents[0].statusId).toBe('s1');
        });

        it('does not push event when no ProfileModal consumer exists', () => {
            useModalsStore.getState().pushStatusDetail(mockStatus('s1'), 'acct-1');

            useModalsStore.getState().handleStatusDeleted({
                statusId: 's1',
                accountSessionId: 'acct-1',
            });

            expect(useModalsStore.getState().stack).toHaveLength(0);
            // No event because no ProfileModal to consume it
            expect(useModalsStore.getState().deletedStatusEvents).toHaveLength(0);
        });

        it('prunes existing events when stack becomes empty', () => {
            useModalsStore.getState().pushStatusDetail(mockStatus('s1'), 'acct-1');
            // Pre-populate an event
            useModalsStore
                .getState()
                .pushDeletedStatusEvent({ statusId: 's1', accountSessionId: 'acct-1' });
            expect(useModalsStore.getState().deletedStatusEvents).toHaveLength(1);

            useModalsStore.getState().handleStatusDeleted({
                statusId: 's1',
                accountSessionId: 'acct-1',
            });

            expect(useModalsStore.getState().stack).toHaveLength(0);
            // Pre-existing event pruned + no new event added
            expect(useModalsStore.getState().deletedStatusEvents).toHaveLength(0);
        });

        it('preserves events for different account when other profile remains', () => {
            useModalsStore.getState().pushStatusDetail(mockStatus('s1'), 'acct-1');
            useModalsStore.getState().pushProfile(mockAccount('a1'), 'acct-2');

            useModalsStore.getState().handleStatusDeleted({
                statusId: 's1',
                accountSessionId: 'acct-1',
            });

            const stack = useModalsStore.getState().stack;
            expect(stack).toHaveLength(1);
            // Profile is for acct-2, not acct-1, so no consumer → no event
            expect(useModalsStore.getState().deletedStatusEvents).toHaveLength(0);
        });

        it('with originStackEntryId: removes specific entry and pushes event if consumer exists', () => {
            useModalsStore.getState().pushStatusDetail(mockStatus('s1'), 'acct-1');
            useModalsStore.getState().pushProfile(mockAccount('a1'), 'acct-1');

            const stack = useModalsStore.getState().stack;
            const detailEntryId = stack[0].id;

            useModalsStore
                .getState()
                .handleStatusDeleted({ statusId: 's1', accountSessionId: 'acct-1' }, detailEntryId);

            // Specific entry removed, profile remains
            expect(useModalsStore.getState().stack).toHaveLength(1);
            expect(useModalsStore.getState().stack[0].type).toBe('profile');
            // Event pushed because ProfileModal consumer exists for acct-1
            expect(useModalsStore.getState().deletedStatusEvents).toHaveLength(1);
        });

        it('with originStackEntryId: removes other matching statusDetail entries too', () => {
            useModalsStore.getState().pushStatusDetail(mockStatus('s1'), 'acct-1');
            useModalsStore.getState().pushStatusDetail(mockStatus('s1'), 'acct-1');
            useModalsStore.getState().pushProfile(mockAccount('a1'), 'acct-1');

            const stack = useModalsStore.getState().stack;
            const topDetailEntryId = stack[1].id;

            useModalsStore
                .getState()
                .handleStatusDeleted(
                    { statusId: 's1', accountSessionId: 'acct-1' },
                    topDetailEntryId
                );

            const remainingStack = useModalsStore.getState().stack;
            expect(remainingStack).toHaveLength(1);
            expect(remainingStack[0].type).toBe('profile');
            expect(useModalsStore.getState().deletedStatusEvents).toHaveLength(1);
        });

        it('with originStackEntryId: no event when no matching profile consumer', () => {
            useModalsStore.getState().pushStatusDetail(mockStatus('s1'), 'acct-1');
            useModalsStore.getState().pushProfile(mockAccount('a1'), 'acct-2');

            const stack = useModalsStore.getState().stack;
            const detailEntryId = stack[0].id;

            useModalsStore
                .getState()
                .handleStatusDeleted({ statusId: 's1', accountSessionId: 'acct-1' }, detailEntryId);

            expect(useModalsStore.getState().stack).toHaveLength(1);
            // No consumer for acct-1 (profile is acct-2), so no event
            expect(useModalsStore.getState().deletedStatusEvents).toHaveLength(0);
        });
    });

    describe('integration: delete flow via event queue', () => {
        it('end-to-end: push event + remove stack + prune', () => {
            // Setup: push a statusDetail and a profile into the stack
            useModalsStore.getState().pushStatusDetail(mockStatus('s1'), 'acct-1');
            useModalsStore.getState().pushProfile(mockAccount('a1'), 'acct-1');
            expect(useModalsStore.getState().stack).toHaveLength(2);

            // Simulate deletion: push event and remove status from stack
            useModalsStore.getState().pushDeletedStatusEvent({
                statusId: 's1',
                accountSessionId: 'acct-1',
            });
            useModalsStore.getState().removeStatusFromStack({
                statusId: 's1',
                accountSessionId: 'acct-1',
            });

            // Stack should have only the profile
            expect(useModalsStore.getState().stack).toHaveLength(1);
            expect(useModalsStore.getState().stack[0].type).toBe('profile');

            // Event should still exist (not yet consumed)
            expect(useModalsStore.getState().deletedStatusEvents).toHaveLength(1);

            // Consume the event
            const [event] = useModalsStore.getState().deletedStatusEvents;
            useModalsStore.getState().pruneDeletedStatusEvents([event.eventId]);
            expect(useModalsStore.getState().deletedStatusEvents).toHaveLength(0);
        });
    });

    // ── Updated Status Events ──────────────────────────────────────────────

    describe('updatedStatusEvents', () => {
        it('pushUpdatedStatusEvent adds event when consumer exists in stack', () => {
            useModalsStore.getState().pushStatusDetail(mockStatus('s0'), 'acct-1');
            useModalsStore.getState().pushUpdatedStatusEvent('acct-1', mockStatus('s1'));
            const events = useModalsStore.getState().updatedStatusEvents;
            expect(events).toHaveLength(1);
            expect(events[0].accountSessionId).toBe('acct-1');
            expect(events[0].status.id).toBe('s1');
        });

        it('pushUpdatedStatusEvent skips when no consumer exists', () => {
            useModalsStore.getState().pushUpdatedStatusEvent('acct-1', mockStatus('s1'));
            expect(useModalsStore.getState().updatedStatusEvents).toHaveLength(0);
        });

        it('pruneUpdatedStatusEvents removes by eventId', () => {
            useModalsStore.getState().pushStatusDetail(mockStatus('s0'), 'acct-1');
            useModalsStore.getState().pushUpdatedStatusEvent('acct-1', mockStatus('s1'));
            useModalsStore.getState().pushUpdatedStatusEvent('acct-1', mockStatus('s2'));
            const [first] = useModalsStore.getState().updatedStatusEvents;
            useModalsStore.getState().pruneUpdatedStatusEvents([first.eventId]);
            const remaining = useModalsStore.getState().updatedStatusEvents;
            expect(remaining).toHaveLength(1);
            expect(remaining[0].status.id).toBe('s2');
        });

        it('clearStack clears updatedStatusEvents', () => {
            useModalsStore.getState().pushStatusDetail(mockStatus('s0'), 'acct-1');
            useModalsStore.getState().pushUpdatedStatusEvent('acct-1', mockStatus('s1'));
            useModalsStore.getState().clearStack();
            expect(useModalsStore.getState().updatedStatusEvents).toHaveLength(0);
        });

        it('goBack prunes updatedStatusEvents when stack becomes empty', () => {
            useModalsStore.getState().pushStatusDetail(mockStatus('s1'), 'acct-1');
            useModalsStore.getState().pushUpdatedStatusEvent('acct-1', mockStatus('s1'));
            useModalsStore.getState().goBack();
            expect(useModalsStore.getState().updatedStatusEvents).toHaveLength(0);
        });
    });

    // ── Evict Pruning ──────────────────────────────────────────────────────

    describe('stack evict pruning', () => {
        it('prunes deletedStatusEvents when evicting a ProfileModal consumer', () => {
            // Fill stack to max
            for (let i = 0; i < 6; i++) {
                useModalsStore.getState().pushProfile(mockAccount(`a${i}`), `acct-${i}`);
            }
            // Push an event for acct-0 (the oldest entry about to be evicted)
            useModalsStore
                .getState()
                .pushDeletedStatusEvent({ statusId: 's1', accountSessionId: 'acct-0' });
            expect(useModalsStore.getState().deletedStatusEvents).toHaveLength(1);

            // Push one more to trigger evict
            useModalsStore.getState().pushStatusDetail(mockStatus('new'), 'acct-5');
            // acct-0 profile was evicted, so its event should be pruned
            expect(useModalsStore.getState().deletedStatusEvents).toHaveLength(0);
        });

        it('prunes updatedStatusEvents when evicting a ProfileModal consumer', () => {
            for (let i = 0; i < 6; i++) {
                useModalsStore.getState().pushProfile(mockAccount(`a${i}`), `acct-${i}`);
            }
            useModalsStore.getState().pushUpdatedStatusEvent('acct-0', mockStatus('s1'));
            expect(useModalsStore.getState().updatedStatusEvents).toHaveLength(1);

            useModalsStore.getState().pushStatusDetail(mockStatus('new'), 'acct-5');
            expect(useModalsStore.getState().updatedStatusEvents).toHaveLength(0);
        });

        it('preserves updatedStatusEvents for remaining statusDetail consumers', () => {
            useModalsStore.getState().pushProfile(mockAccount('a0'), 'acct-0');
            useModalsStore.getState().pushStatusDetail(mockStatus('s1'), 'acct-1');
            useModalsStore.getState().pushUpdatedStatusEvent('acct-1', mockStatus('s1'));

            for (let i = 2; i <= 6; i++) {
                useModalsStore.getState().pushProfile(mockAccount(`a${i}`), `acct-${i}`);
            }

            const events = useModalsStore.getState().updatedStatusEvents;
            expect(events).toHaveLength(1);
            expect(events[0].accountSessionId).toBe('acct-1');
        });

        it('preserves events for non-evicted consumers', () => {
            useModalsStore.getState().pushProfile(mockAccount('a0'), 'acct-0');
            useModalsStore.getState().pushProfile(mockAccount('a1'), 'acct-1');
            useModalsStore
                .getState()
                .pushDeletedStatusEvent({ statusId: 's1', accountSessionId: 'acct-1' });

            // Fill to max to evict a0
            for (let i = 2; i <= 6; i++) {
                useModalsStore.getState().pushProfile(mockAccount(`a${i}`), `acct-${i}`);
            }
            // acct-1 event should remain since acct-1 profile is still in stack
            expect(useModalsStore.getState().deletedStatusEvents).toHaveLength(1);
        });
    });
});
