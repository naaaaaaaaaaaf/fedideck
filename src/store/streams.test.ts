import { beforeEach, describe, expect, it } from 'vitest';
import type { mastodon } from 'masto';
import {
    getStreamKey,
    useStreamsStore,
    MAX_STATUSES_PER_STREAM,
    MAX_NOTIFICATIONS_PER_STREAM,
} from './streams';

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

        it('updates status inside quote.quotedStatus', () => {
            const quotedStatus = { id: 'quoted-1', favourited: false } as mastodon.v1.Status;
            const quoteStatus = {
                id: 'quote-1',
                quote: {
                    state: 'accepted',
                    quotedStatus: quotedStatus,
                },
            } as mastodon.v1.Status;
            const updatedQuotedStatus = { id: 'quoted-1', favourited: true } as mastodon.v1.Status;

            useStreamsStore.getState().setStatuses('account:home', [quoteStatus]);

            useStreamsStore.getState().updateStatusGlobal(updatedQuotedStatus);

            const stream = useStreamsStore.getState().data['account:home'];
            const quote = stream.statuses[0].quote as mastodon.v1.Quote;
            expect(quote.quotedStatus?.favourited).toBe(true);
        });

        it('does not update quote.quotedStatus when state is not accepted', () => {
            const quotedStatus = { id: 'quoted-1', favourited: false } as mastodon.v1.Status;
            const quoteStatus = {
                id: 'quote-1',
                quote: {
                    state: 'pending',
                    quotedStatus: quotedStatus,
                },
            } as mastodon.v1.Status;
            const updatedQuotedStatus = { id: 'quoted-1', favourited: true } as mastodon.v1.Status;

            useStreamsStore.getState().setStatuses('account:home', [quoteStatus]);

            useStreamsStore.getState().updateStatusGlobal(updatedQuotedStatus);

            const stream = useStreamsStore.getState().data['account:home'];
            const quote = stream.statuses[0].quote as mastodon.v1.Quote;
            // Should not be updated because state is 'pending'
            expect(quote.quotedStatus?.favourited).toBe(false);
        });
    });

    describe('updatePollGlobal', () => {
        const makePoll = (id: string, voted: boolean = false) =>
            ({
                id,
                voted,
                options: [{ title: 'Option 1', votesCount: 1 }],
            }) as mastodon.v1.Poll;

        it('updates only poll field across multiple streams', () => {
            const originalStatus = {
                id: '1',
                poll: makePoll('poll-1', false),
                favourited: false,
            } as mastodon.v1.Status;
            const updatedPoll = makePoll('poll-1', true);

            useStreamsStore.getState().setStatuses('account:home', [originalStatus]);
            useStreamsStore.getState().setStatuses('account:public', [originalStatus]);

            useStreamsStore.getState().updatePollGlobal('1', updatedPoll);

            const homeStream = useStreamsStore.getState().data['account:home'];
            const publicStream = useStreamsStore.getState().data['account:public'];

            expect(homeStream.statuses[0].poll?.voted).toBe(true);
            expect(publicStream.statuses[0].poll?.voted).toBe(true);
            // Other fields should remain unchanged
            expect(homeStream.statuses[0].favourited).toBe(false);
        });

        it('updates poll inside reblog', () => {
            const innerStatus = {
                id: 'inner-1',
                poll: makePoll('poll-1', false),
            } as mastodon.v1.Status;
            const reblogStatus = {
                id: 'reblog-1',
                reblog: innerStatus,
            } as mastodon.v1.Status;
            const updatedPoll = makePoll('poll-1', true);

            useStreamsStore.getState().setStatuses('account:home', [reblogStatus]);

            useStreamsStore.getState().updatePollGlobal('inner-1', updatedPoll);

            const stream = useStreamsStore.getState().data['account:home'];
            expect(stream.statuses[0].reblog?.poll?.voted).toBe(true);
        });

        it('does not modify streams without matching status', () => {
            const status1 = makeStatus('1');
            const updatedPoll = makePoll('poll-1', true);

            useStreamsStore.getState().setStatuses('account:home', [status1]);

            const originalState = useStreamsStore.getState();
            useStreamsStore.getState().updatePollGlobal('999', updatedPoll);
            const newState = useStreamsStore.getState();

            // State reference should be unchanged when no matches
            expect(newState.data).toBe(originalState.data);
        });

        it('preserves other status fields during poll update', () => {
            const originalStatus = {
                id: '1',
                poll: makePoll('poll-1', false),
                favourited: true,
                reblogged: true,
                favouritesCount: 42,
                reblogsCount: 10,
            } as mastodon.v1.Status;
            const updatedPoll = makePoll('poll-1', true);

            useStreamsStore.getState().setStatuses('account:home', [originalStatus]);

            useStreamsStore.getState().updatePollGlobal('1', updatedPoll);

            const stream = useStreamsStore.getState().data['account:home'];
            const status = stream.statuses[0];
            expect(status.poll?.voted).toBe(true);
            expect(status.favourited).toBe(true);
            expect(status.reblogged).toBe(true);
            expect(status.favouritesCount).toBe(42);
            expect(status.reblogsCount).toBe(10);
        });

        it('preserves existing vote counts when incoming poll omits totals', () => {
            const originalStatus = {
                id: '1',
                poll: {
                    id: 'poll-1',
                    expired: false,
                    multiple: false,
                    votesCount: 10,
                    options: [
                        { title: 'Option 1', votesCount: 6, emojis: [] },
                        { title: 'Option 2', votesCount: 4, emojis: [] },
                    ],
                },
            } as unknown as mastodon.v1.Status;
            const partialPoll = {
                id: 'poll-1',
                expired: false,
                multiple: false,
                votesCount: 0,
                options: [
                    { title: 'Option 1', emojis: [] },
                    { title: 'Option 2', emojis: [] },
                ],
            } as mastodon.v1.Poll;

            useStreamsStore.getState().setStatuses('account:home', [originalStatus]);
            useStreamsStore.getState().updatePollGlobal('1', partialPoll);

            const stream = useStreamsStore.getState().data['account:home'];
            expect(stream.statuses[0].poll?.votesCount).toBe(10);
            expect(stream.statuses[0].poll?.options[0].votesCount).toBe(6);
            expect(stream.statuses[0].poll?.options[1].votesCount).toBe(4);
        });

        it('updates poll inside quote.quotedStatus', () => {
            const makePoll = (id: string, voted: boolean = false) =>
                ({
                    id,
                    voted,
                    options: [{ title: 'Option 1', votesCount: 1 }],
                }) as mastodon.v1.Poll;

            const quotedStatus = {
                id: 'quoted-1',
                poll: makePoll('poll-1', false),
            } as mastodon.v1.Status;
            const quoteStatus = {
                id: 'quote-1',
                quote: {
                    state: 'accepted',
                    quotedStatus: quotedStatus,
                },
            } as mastodon.v1.Status;
            const updatedPoll = makePoll('poll-1', true);

            useStreamsStore.getState().setStatuses('account:home', [quoteStatus]);

            useStreamsStore.getState().updatePollGlobal('quoted-1', updatedPoll);

            const stream = useStreamsStore.getState().data['account:home'];
            const quote = stream.statuses[0].quote as mastodon.v1.Quote;
            expect(quote.quotedStatus?.poll?.voted).toBe(true);
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

describe('item limits', () => {
    beforeEach(() => {
        useStreamsStore.setState({ data: {} });
    });

    describe('statuses', () => {
        it('limits statuses to MAX_STATUSES_PER_STREAM on setStatuses', () => {
            const statuses = Array.from({ length: 300 }, (_, i) => makeStatus(String(i)));
            useStreamsStore.getState().setStatuses('account:home', statuses);

            const stream = useStreamsStore.getState().data['account:home'];
            expect(stream.statuses.length).toBe(MAX_STATUSES_PER_STREAM);
            // Should keep the first items (newest)
            expect(stream.statuses[0].id).toBe('0');
            expect(stream.statuses[MAX_STATUSES_PER_STREAM - 1].id).toBe(
                String(MAX_STATUSES_PER_STREAM - 1)
            );
        });

        it('limits statuses to MAX_STATUSES_PER_STREAM on prepend', () => {
            // Start with 200 statuses
            const initialStatuses = Array.from({ length: MAX_STATUSES_PER_STREAM }, (_, i) =>
                makeStatus(String(i))
            );
            useStreamsStore.getState().setStatuses('account:home', initialStatuses);

            // Prepend one more - should still be at max
            useStreamsStore.getState().prependStatus('account:home', makeStatus('new'));

            const stream = useStreamsStore.getState().data['account:home'];
            expect(stream.statuses.length).toBe(MAX_STATUSES_PER_STREAM);
            // Newest item should be at the front
            expect(stream.statuses[0].id).toBe('new');
        });

        it('sets hasMore to false when prepend reaches client cap', () => {
            // Start with 199 statuses (just under cap)
            const initialStatuses = Array.from({ length: 199 }, (_, i) => makeStatus(String(i)));
            useStreamsStore.getState().setStatuses('account:home', initialStatuses);

            // Prepend one more - should reach cap and set hasMore to false
            useStreamsStore.getState().prependStatus('account:home', makeStatus('new'));

            const stream = useStreamsStore.getState().data['account:home'];
            expect(stream.statuses.length).toBe(MAX_STATUSES_PER_STREAM);
            expect(stream.hasMore).toBe(false);
        });

        it('preserves hasMore when prepend does not reach cap', () => {
            // Start with 100 statuses
            const initialStatuses = Array.from({ length: 100 }, (_, i) => makeStatus(String(i)));
            useStreamsStore.getState().setStatuses('account:home', initialStatuses, true);

            // Prepend one more - hasMore should remain true
            useStreamsStore.getState().prependStatus('account:home', makeStatus('new'));

            const stream = useStreamsStore.getState().data['account:home'];
            expect(stream.hasMore).toBe(true);
        });

        it('limits statuses to MAX_STATUSES_PER_STREAM on append', () => {
            // Start with 150 statuses
            const initialStatuses = Array.from({ length: 150 }, (_, i) => makeStatus(String(i)));
            useStreamsStore.getState().setStatuses('account:home', initialStatuses);

            // Append 100 more - total should be clamped to 200
            const moreStatuses = Array.from({ length: 100 }, (_, i) => makeStatus(String(150 + i)));
            useStreamsStore.getState().appendStatuses('account:home', moreStatuses);

            const stream = useStreamsStore.getState().data['account:home'];
            expect(stream.statuses.length).toBe(MAX_STATUSES_PER_STREAM);
        });

        it('respects capped pagination when new items arrive at cap', () => {
            // Start with statuses at the client cap
            const initialStatuses = Array.from({ length: MAX_STATUSES_PER_STREAM }, (_, i) =>
                makeStatus(String(i))
            );
            useStreamsStore.getState().setStatuses('account:home', initialStatuses);

            // Append more (new items from server) while already at cap
            const moreStatuses = Array.from({ length: 50 }, (_, i) => makeStatus(String(200 + i)));
            useStreamsStore.getState().appendStatuses('account:home', moreStatuses);

            const stream = useStreamsStore.getState().data['account:home'];
            // Once the client cap is reached and clamping occurs, hasMore should be false
            // to avoid repeatedly loading with an unchanged lastId and causing loops.
            expect(stream.hasMore).toBe(false);
        });

        it('preserves hasMore true when under cap after append', () => {
            // Start with 100 statuses (under cap)
            const initialStatuses = Array.from({ length: 100 }, (_, i) => makeStatus(String(i)));
            useStreamsStore.getState().setStatuses('account:home', initialStatuses);

            // Append 50 more
            const moreStatuses = Array.from({ length: 50 }, (_, i) => makeStatus(String(100 + i)));
            useStreamsStore.getState().appendStatuses('account:home', moreStatuses);

            const stream = useStreamsStore.getState().data['account:home'];
            // hasMore should be true because we're under cap
            expect(stream.hasMore).toBe(true);
        });

        it('preserves hasMore when all appended items are duplicates', () => {
            // Start with 100 statuses with hasMore=true
            const initialStatuses = Array.from({ length: 100 }, (_, i) => makeStatus(String(i)));
            useStreamsStore.getState().setStatuses('account:home', initialStatuses, true);

            // Append only duplicates - hasMore should be preserved
            useStreamsStore
                .getState()
                .appendStatuses('account:home', [makeStatus('0'), makeStatus('1')]);

            const stream = useStreamsStore.getState().data['account:home'];
            expect(stream.hasMore).toBe(true);
        });
    });

    describe('notifications', () => {
        it('limits notifications to MAX_NOTIFICATIONS_PER_STREAM on setNotifications', () => {
            const notifications = Array.from({ length: 150 }, (_, i) =>
                makeNotification(String(i))
            );
            useStreamsStore.getState().setNotifications('account:notifications', notifications);

            const stream = useStreamsStore.getState().data['account:notifications'];
            expect(stream.notifications.length).toBe(MAX_NOTIFICATIONS_PER_STREAM);
        });

        it('limits notifications to MAX_NOTIFICATIONS_PER_STREAM on prepend', () => {
            const initialNotifications = Array.from(
                { length: MAX_NOTIFICATIONS_PER_STREAM },
                (_, i) => makeNotification(String(i))
            );
            useStreamsStore
                .getState()
                .setNotifications('account:notifications', initialNotifications);

            useStreamsStore
                .getState()
                .prependNotification('account:notifications', makeNotification('new'));

            const stream = useStreamsStore.getState().data['account:notifications'];
            expect(stream.notifications.length).toBe(MAX_NOTIFICATIONS_PER_STREAM);
            expect(stream.notifications[0].id).toBe('new');
        });

        it('sets hasMore to false when prepend reaches client cap', () => {
            // Start with 99 notifications (just under cap)
            const initialNotifications = Array.from({ length: 99 }, (_, i) =>
                makeNotification(String(i))
            );
            useStreamsStore
                .getState()
                .setNotifications('account:notifications', initialNotifications);

            // Prepend one more - should reach cap and set hasMore to false
            useStreamsStore
                .getState()
                .prependNotification('account:notifications', makeNotification('new'));

            const stream = useStreamsStore.getState().data['account:notifications'];
            expect(stream.notifications.length).toBe(MAX_NOTIFICATIONS_PER_STREAM);
            expect(stream.hasMore).toBe(false);
        });

        it('limits notifications to MAX_NOTIFICATIONS_PER_STREAM on append', () => {
            const initialNotifications = Array.from({ length: 80 }, (_, i) =>
                makeNotification(String(i))
            );
            useStreamsStore
                .getState()
                .setNotifications('account:notifications', initialNotifications);

            const moreNotifications = Array.from({ length: 50 }, (_, i) =>
                makeNotification(String(80 + i))
            );
            useStreamsStore
                .getState()
                .appendNotifications('account:notifications', moreNotifications);

            const stream = useStreamsStore.getState().data['account:notifications'];
            expect(stream.notifications.length).toBe(MAX_NOTIFICATIONS_PER_STREAM);
        });

        it('respects capped pagination when new items arrive at cap', () => {
            const initialNotifications = Array.from(
                { length: MAX_NOTIFICATIONS_PER_STREAM },
                (_, i) => makeNotification(String(i))
            );
            useStreamsStore
                .getState()
                .setNotifications('account:notifications', initialNotifications);

            const moreNotifications = Array.from({ length: 20 }, (_, i) =>
                makeNotification(String(100 + i))
            );
            useStreamsStore
                .getState()
                .appendNotifications('account:notifications', moreNotifications);

            const stream = useStreamsStore.getState().data['account:notifications'];
            // Once the client cap is reached and clamping occurs, hasMore should be false
            // to avoid repeatedly loading with an unchanged lastId and causing loops.
            expect(stream.hasMore).toBe(false);
        });

        it('preserves hasMore when all appended notifications are duplicates', () => {
            // Start with 50 notifications with hasMore=true
            const initialNotifications = Array.from({ length: 50 }, (_, i) =>
                makeNotification(String(i))
            );
            useStreamsStore
                .getState()
                .setNotifications('account:notifications', initialNotifications, true);

            // Append only duplicates - hasMore should be preserved
            useStreamsStore
                .getState()
                .appendNotifications('account:notifications', [
                    makeNotification('0'),
                    makeNotification('1'),
                ]);

            const stream = useStreamsStore.getState().data['account:notifications'];
            expect(stream.hasMore).toBe(true);
        });
    });
});
