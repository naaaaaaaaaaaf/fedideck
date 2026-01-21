import { beforeEach, describe, expect, it } from 'vitest';
import type { mastodon } from 'masto';
import { getStreamKey, useStreamsStore } from './streams';

const makeStatus = (id: string) => ({ id } as mastodon.v1.Status);
const makeNotification = (id: string) => ({ id } as mastodon.v1.Notification);

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
        expect(stream.statuses.map(status => status.id)).toEqual(['2', '1']);
    });

    it('appends statuses without duplicates', () => {
        useStreamsStore.getState().setStatuses('account:home', [makeStatus('1')]);
        useStreamsStore.getState().appendStatuses('account:home', [makeStatus('1'), makeStatus('2')]);

        const stream = useStreamsStore.getState().data['account:home'];
        expect(stream.statuses.map(status => status.id)).toEqual(['1', '2']);
        expect(stream.hasMore).toBe(true);
    });

    it('removes and updates statuses safely', () => {
        useStreamsStore.getState().setStatuses('account:home', [makeStatus('1'), makeStatus('2')]);
        useStreamsStore.getState().removeStatus('account:home', '1');
        useStreamsStore.getState().updateStatus('account:home', makeStatus('2'));

        const stream = useStreamsStore.getState().data['account:home'];
        expect(stream.statuses.map(status => status.id)).toEqual(['2']);
    });

    it('manages notifications with dedupe', () => {
        useStreamsStore.getState().setNotifications('account:notifications', [makeNotification('a')]);
        useStreamsStore.getState().prependNotification('account:notifications', makeNotification('a'));
        useStreamsStore.getState().prependNotification('account:notifications', makeNotification('b'));
        useStreamsStore.getState().appendNotifications('account:notifications', [makeNotification('a'), makeNotification('c')]);

        const stream = useStreamsStore.getState().data['account:notifications'];
        expect(stream.notifications.map(notification => notification.id)).toEqual(['b', 'a', 'c']);
    });

    it('clears streams by key', () => {
        useStreamsStore.getState().setStatuses('account:home', [makeStatus('1')]);
        useStreamsStore.getState().clearStream('account:home');

        expect(useStreamsStore.getState().data['account:home']).toBeUndefined();
    });
});

describe('getStreamKey', () => {
    it('returns list and hashtag keys when params are provided', () => {
        expect(getStreamKey('account', 'list', { listId: '123' })).toBe('account:list:123');
        expect(getStreamKey('account', 'hashtag', { hashtag: 'fediverse' })).toBe('account:hashtag:fediverse');
    });

    it('falls back to stream type when no params are provided', () => {
        expect(getStreamKey('account', 'home')).toBe('account:home');
    });
});
