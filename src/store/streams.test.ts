import { beforeEach, describe, expect, it } from 'vitest';
import type { mastodon } from 'masto';
import { getStreamKey, useStreamsStore } from './streams';

const makeStatus = (id: string) => ({ id }) as mastodon.v1.Status;
const makeNotification = (id: string) => ({ id }) as mastodon.v1.Notification;

describe('useStreamsStore', () => {
    beforeEach(() => {
        useStreamsStore.setState({ data: {} });
    });

    it('initializes stream data when missing', () => {
        useStreamsStore.getState().initStream('account:home');

        const stream = useStreamsStore.getState().data['account:home'];
        expect(stream).toBeDefined();
        expect(stream.statuses).toEqual([]);
        expect(stream.notifications).toEqual([]);
    });

    it('updates loading and error flags', () => {
        useStreamsStore.getState().setLoading('account:home', true);
        let stream = useStreamsStore.getState().data['account:home'];
        expect(stream.isLoading).toBe(true);

        useStreamsStore.getState().setError('account:home', 'boom');
        stream = useStreamsStore.getState().data['account:home'];
        expect(stream.error).toBe('boom');
        expect(stream.isLoading).toBe(false);
    });

    it('sets statuses and clears errors', () => {
        const statuses = [makeStatus('1')];
        useStreamsStore.getState().setError('account:home', 'boom');
        useStreamsStore.getState().setStatuses('account:home', statuses, false);

        const stream = useStreamsStore.getState().data['account:home'];
        expect(stream.statuses).toEqual(statuses);
        expect(stream.hasMore).toBe(false);
        expect(stream.error).toBeNull();
    });

    it('prepends status without duplicates', () => {
        useStreamsStore.getState().setStatuses('account:home', [makeStatus('1')]);
        useStreamsStore.getState().prependStatus('account:home', makeStatus('1'));
        useStreamsStore.getState().prependStatus('account:home', makeStatus('2'));

        const stream = useStreamsStore.getState().data['account:home'];
        expect(stream.statuses.map((status) => status.id)).toEqual(['2', '1']);
    });

    it('appends statuses without duplicates', () => {
        useStreamsStore.getState().setStatuses('account:home', [makeStatus('1')]);
        useStreamsStore
            .getState()
            .appendStatuses('account:home', [makeStatus('1'), makeStatus('2')]);

        const stream = useStreamsStore.getState().data['account:home'];
        expect(stream.statuses.map((status) => status.id)).toEqual(['1', '2']);
        expect(stream.hasMore).toBe(true);
    });

    it('removes and updates statuses safely', () => {
        useStreamsStore.getState().setStatuses('account:home', [makeStatus('1'), makeStatus('2')]);
        useStreamsStore.getState().removeStatus('account:home', '1');
        useStreamsStore.getState().updateStatus('account:home', makeStatus('2'));

        const stream = useStreamsStore.getState().data['account:home'];
        expect(stream.statuses.map((status) => status.id)).toEqual(['2']);
    });

    it('manages notifications with dedupe', () => {
        useStreamsStore
            .getState()
            .setNotifications('account:notifications', [makeNotification('a')]);
        useStreamsStore
            .getState()
            .prependNotification('account:notifications', makeNotification('a'));
        useStreamsStore
            .getState()
            .prependNotification('account:notifications', makeNotification('b'));
        useStreamsStore
            .getState()
            .appendNotifications('account:notifications', [
                makeNotification('a'),
                makeNotification('c'),
            ]);

        const stream = useStreamsStore.getState().data['account:notifications'];
        expect(stream.notifications.map((notification) => notification.id)).toEqual([
            'b',
            'a',
            'c',
        ]);
    });

    it('clears streams by key', () => {
        useStreamsStore.getState().setStatuses('account:home', [makeStatus('1')]);
        useStreamsStore.getState().clearStream('account:home');

        expect(useStreamsStore.getState().data['account:home']).toBeUndefined();
    });

    describe('updateStatusGlobal', () => {
        it('updates status across multiple streams', () => {
            const originalStatus = { id: '1', favourited: false } as mastodon.v1.Status;
            const updatedStatus = { id: '1', favourited: true } as mastodon.v1.Status;

            useStreamsStore
                .getState()
                .setStatuses('account:home', [originalStatus, makeStatus('2')]);
            useStreamsStore
                .getState()
                .setStatuses('account:public', [makeStatus('3'), originalStatus]);

            useStreamsStore.getState().updateStatusGlobal(updatedStatus);

            const homeStream = useStreamsStore.getState().data['account:home'];
            const publicStream = useStreamsStore.getState().data['account:public'];

            expect(homeStream.statuses[0].favourited).toBe(true);
            expect(publicStream.statuses[1].favourited).toBe(true);
        });

        it('does not modify streams without matching status', () => {
            const status1 = makeStatus('1');
            const status2 = makeStatus('2');
            const updatedStatus = { id: '3', favourited: true } as mastodon.v1.Status;

            useStreamsStore.getState().setStatuses('account:home', [status1]);
            useStreamsStore.getState().setStatuses('account:public', [status2]);

            const originalState = useStreamsStore.getState();
            useStreamsStore.getState().updateStatusGlobal(updatedStatus);
            const newState = useStreamsStore.getState();

            // State reference should be unchanged when no matches
            expect(newState.data).toBe(originalState.data);
        });

        it('updates status inside reblog', () => {
            const originalInnerStatus = { id: 'inner-1', favourited: false } as mastodon.v1.Status;
            const reblogStatus = {
                id: 'reblog-1',
                reblog: originalInnerStatus,
            } as mastodon.v1.Status;
            const updatedInnerStatus = { id: 'inner-1', favourited: true } as mastodon.v1.Status;

            useStreamsStore.getState().setStatuses('account:home', [reblogStatus]);

            useStreamsStore.getState().updateStatusGlobal(updatedInnerStatus);

            const stream = useStreamsStore.getState().data['account:home'];
            expect(stream.statuses[0].id).toBe('reblog-1');
            expect(stream.statuses[0].reblog?.favourited).toBe(true);
        });

        it('updates both direct status and reblog containing same status', () => {
            const originalStatus = { id: '1', favourited: false } as mastodon.v1.Status;
            const reblogStatus = {
                id: 'reblog-1',
                reblog: { ...originalStatus },
            } as mastodon.v1.Status;
            const updatedStatus = { id: '1', favourited: true } as mastodon.v1.Status;

            useStreamsStore.getState().setStatuses('account:home', [originalStatus]);
            useStreamsStore.getState().setStatuses('account:public', [reblogStatus]);

            useStreamsStore.getState().updateStatusGlobal(updatedStatus);

            const homeStream = useStreamsStore.getState().data['account:home'];
            const publicStream = useStreamsStore.getState().data['account:public'];

            expect(homeStream.statuses[0].favourited).toBe(true);
            expect(publicStream.statuses[0].reblog?.favourited).toBe(true);
        });

        it('only updates streams that contain the status', () => {
            const status1 = { id: '1', favourited: false } as mastodon.v1.Status;
            const status2 = makeStatus('2');
            const updatedStatus = { id: '1', favourited: true } as mastodon.v1.Status;

            useStreamsStore.getState().setStatuses('account:home', [status1]);
            useStreamsStore.getState().setStatuses('account:public', [status2]);

            const publicStreamBefore = useStreamsStore.getState().data['account:public'];
            useStreamsStore.getState().updateStatusGlobal(updatedStatus);
            const publicStreamAfter = useStreamsStore.getState().data['account:public'];

            // Public stream should be unchanged (same reference)
            expect(publicStreamAfter).toBe(publicStreamBefore);
        });
    });

    describe('removeStatusForAccountStreams', () => {
        it('removes status from all streams of an account', () => {
            const status1 = makeStatus('1');
            const status2 = makeStatus('2');

            useStreamsStore.getState().setStatuses('acc1:home', [status1, status2]);
            useStreamsStore.getState().setStatuses('acc1:public', [status1, status2]);

            useStreamsStore.getState().removeStatusForAccountStreams('acc1', '1');

            const homeStream = useStreamsStore.getState().data['acc1:home'];
            const publicStream = useStreamsStore.getState().data['acc1:public'];

            expect(homeStream.statuses.map((s) => s.id)).toEqual(['2']);
            expect(publicStream.statuses.map((s) => s.id)).toEqual(['2']);
        });

        it('does not affect streams of other accounts', () => {
            const status1 = makeStatus('1');

            useStreamsStore.getState().setStatuses('acc1:home', [status1]);
            useStreamsStore.getState().setStatuses('acc2:home', [status1]);

            useStreamsStore.getState().removeStatusForAccountStreams('acc1', '1');

            const acc1Stream = useStreamsStore.getState().data['acc1:home'];
            const acc2Stream = useStreamsStore.getState().data['acc2:home'];

            expect(acc1Stream.statuses).toEqual([]);
            expect(acc2Stream.statuses.map((s) => s.id)).toEqual(['1']);
        });

        it('removes reblog wrapper when inner status is deleted', () => {
            const innerStatus = makeStatus('inner-1');
            const reblogStatus = {
                id: 'reblog-1',
                reblog: innerStatus,
            } as mastodon.v1.Status;
            const otherStatus = makeStatus('other');

            useStreamsStore.getState().setStatuses('acc1:home', [reblogStatus, otherStatus]);

            useStreamsStore.getState().removeStatusForAccountStreams('acc1', 'inner-1');

            const stream = useStreamsStore.getState().data['acc1:home'];
            // Reblog wrapper should be removed entirely
            expect(stream.statuses.map((s) => s.id)).toEqual(['other']);
        });

        it('is no-op when status does not exist', () => {
            const status1 = makeStatus('1');

            useStreamsStore.getState().setStatuses('acc1:home', [status1]);

            const originalState = useStreamsStore.getState();
            useStreamsStore.getState().removeStatusForAccountStreams('acc1', 'nonexistent');
            const newState = useStreamsStore.getState();

            // State should be unchanged (same reference)
            expect(newState.data).toBe(originalState.data);
        });
    });
});

describe('getStreamKey', () => {
    it('returns list and hashtag keys when params are provided', () => {
        expect(getStreamKey('account', 'list', { listId: '123' })).toBe('account:list:123');
        expect(getStreamKey('account', 'hashtag', { hashtag: 'fediverse' })).toBe(
            'account:hashtag:fediverse'
        );
    });

    it('falls back to stream type when no params are provided', () => {
        expect(getStreamKey('account', 'home')).toBe('account:home');
    });
});
