import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StreamConfig } from '../streaming/streamTypes';

export interface Column {
    id: string;
    accountId: string;
    stream: StreamConfig;
    width?: number;
}

interface ColumnsState {
    columns: Column[];

    // Actions
    addColumn: (column: Omit<Column, 'id'>) => string;
    removeColumn: (columnId: string) => void;
    moveColumn: (columnId: string, newIndex: number) => void;
    updateColumn: (columnId: string, updates: Partial<Column>) => void;
    getColumnsForAccount: (accountId: string) => Column[];
}

let columnIdCounter = 0;

function generateColumnId(): string {
    return `column-${Date.now()}-${++columnIdCounter}`;
}

export const useColumnsStore = create<ColumnsState>()(
    persist(
        (set, get) => ({
            columns: [],

            addColumn: (column) => {
                const id = generateColumnId();
                set((state) => ({
                    columns: [...state.columns, { ...column, id }],
                }));
                return id;
            },

            removeColumn: (columnId) => {
                set((state) => ({
                    columns: state.columns.filter((c) => c.id !== columnId),
                }));
            },

            moveColumn: (columnId, newIndex) => {
                set((state) => {
                    const columns = [...state.columns];
                    const currentIndex = columns.findIndex((c) => c.id === columnId);
                    if (currentIndex === -1 || currentIndex === newIndex) return state;

                    const [column] = columns.splice(currentIndex, 1);
                    columns.splice(newIndex, 0, column);

                    return { columns };
                });
            },

            updateColumn: (columnId, updates) => {
                set((state) => ({
                    columns: state.columns.map((c) =>
                        c.id === columnId ? { ...c, ...updates } : c
                    ),
                }));
            },

            getColumnsForAccount: (accountId) => {
                return get().columns.filter((c) => c.accountId === accountId);
            },
        }),
        {
            name: 'fedideck:columns-store',
        }
    )
);
