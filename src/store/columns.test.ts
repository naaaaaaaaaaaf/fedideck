import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useColumnsStore } from './columns';

describe('useColumnsStore', () => {
    beforeEach(() => {
        localStorage.clear();
        useColumnsStore.persist.clearStorage();
        useColumnsStore.setState({ columns: [] }, true);
    });

    it('adds and removes columns', () => {
        vi.spyOn(Date, 'now').mockReturnValue(1000);
        const id = useColumnsStore.getState().addColumn({
            accountId: 'account-1',
            stream: { type: 'home' },
            width: 320,
        });

        expect(useColumnsStore.getState().columns).toHaveLength(1);
        expect(useColumnsStore.getState().columns[0].id).toBe(id);

        useColumnsStore.getState().removeColumn(id);
        expect(useColumnsStore.getState().columns).toHaveLength(0);

        vi.restoreAllMocks();
    });

    it('moves columns to new positions', () => {
        vi.spyOn(Date, 'now').mockReturnValue(2000);
        const firstId = useColumnsStore.getState().addColumn({
            accountId: 'account-1',
            stream: { type: 'home' },
        });
        const secondId = useColumnsStore.getState().addColumn({
            accountId: 'account-1',
            stream: { type: 'notifications' },
        });

        useColumnsStore.getState().moveColumn(firstId, 1);

        const ids = useColumnsStore.getState().columns.map(column => column.id);
        expect(ids).toEqual([secondId, firstId]);

        vi.restoreAllMocks();
    });

    it('updates columns and filters by account', () => {
        vi.spyOn(Date, 'now').mockReturnValue(3000);
        const firstId = useColumnsStore.getState().addColumn({
            accountId: 'account-1',
            stream: { type: 'home' },
        });
        useColumnsStore.getState().addColumn({
            accountId: 'account-2',
            stream: { type: 'public' },
        });

        useColumnsStore.getState().updateColumn(firstId, { width: 480 });

        const firstColumn = useColumnsStore.getState().columns.find(column => column.id === firstId);
        expect(firstColumn?.width).toBe(480);

        const accountColumns = useColumnsStore.getState().getColumnsForAccount('account-1');
        expect(accountColumns).toHaveLength(1);
        expect(accountColumns[0].id).toBe(firstId);

        vi.restoreAllMocks();
    });
});
