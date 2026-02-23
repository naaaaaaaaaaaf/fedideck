import { useState, useEffect, useRef } from 'react';
import type { mastodon } from 'masto';
import { getClient, getStatusSource, type AccountSession } from '../api/mastoClient';
import type { EditTarget } from '../components/ComposeModal';

/**
 * Media file representation for prefill
 */
export interface PrefilledMediaFile {
    localId: string;
    preview: string;
    uploadedId: string;
    altText: string;
    isExisting: true;
    kind: 'image' | 'video' | 'audio' | 'gifv' | 'unknown';
}

/**
 * Data to prefill when editing a status
 */
export interface EditPrefillData {
    text: string;
    spoilerText: string;
    visibility: string;
    sensitive: boolean;
    mediaFiles: PrefilledMediaFile[];
}

interface UseEditPrefillOptions {
    editTarget: EditTarget | undefined;
    accountSession: AccountSession | null | undefined;
    isOpen: boolean;
    onPrefill: (data: EditPrefillData) => void;
    onError: (error: string) => void;
}

interface UseEditPrefillReturn {
    isLoading: boolean;
}

/**
 * Hook for fetching and prefilling edit mode data
 * Uses race condition handling pattern similar to usePollState
 */
export function useEditPrefill({
    editTarget,
    accountSession,
    isOpen,
    onPrefill,
    onError,
}: UseEditPrefillOptions): UseEditPrefillReturn {
    const [isLoading, setIsLoading] = useState(false);

    // Race condition control: track request sequence
    const requestSeqRef = useRef(0);
    const activeContextRef = useRef<{
        statusId: string | null;
        accountId: string | null;
    }>({
        statusId: null,
        accountId: null,
    });

    useEffect(() => {
        if (!editTarget || !isOpen || !accountSession) {
            setIsLoading(false);
            return;
        }

        const statusId = editTarget.status.id;
        const accountId = accountSession.id;

        // Update active context
        const contextChanged =
            activeContextRef.current.statusId !== statusId ||
            activeContextRef.current.accountId !== accountId;

        activeContextRef.current = { statusId, accountId };

        // Increment request generation for race condition prevention
        const requestSeq = ++requestSeqRef.current;

        setIsLoading(true);

        const prefillEdit = async () => {
            try {
                const client = getClient(accountSession);
                const source = await getStatusSource(client, statusId);

                // Race condition guard: ignore stale responses
                if (
                    requestSeq !== requestSeqRef.current ||
                    activeContextRef.current.statusId !== statusId ||
                    activeContextRef.current.accountId !== accountId
                ) {
                    return;
                }

                const status = editTarget.status;

                // Convert existing media attachments to PrefilledMediaFile format
                const mediaFiles: PrefilledMediaFile[] =
                    status.mediaAttachments && status.mediaAttachments.length > 0
                        ? status.mediaAttachments.map((media) => ({
                              localId: `media-${media.id}`,
                              preview: media.url ?? media.previewUrl ?? '',
                              uploadedId: media.id,
                              altText: media.description ?? '',
                              isExisting: true as const,
                              kind: media.type,
                          }))
                        : [];

                onPrefill({
                    text: source.text,
                    spoilerText: source.spoilerText,
                    visibility: status.visibility,
                    sensitive: status.sensitive ?? false,
                    mediaFiles,
                });
            } catch (err) {
                // Ignore errors from stale requests
                if (
                    requestSeq !== requestSeqRef.current ||
                    activeContextRef.current.statusId !== statusId ||
                    activeContextRef.current.accountId !== accountId
                ) {
                    return;
                }

                console.error('Failed to fetch status source for edit:', err);
                onError('編集用データの取得に失敗しました');
            } finally {
                // Only update loading state if this is still the current request
                if (
                    requestSeq === requestSeqRef.current &&
                    activeContextRef.current.statusId === statusId &&
                    activeContextRef.current.accountId === accountId
                ) {
                    setIsLoading(false);
                }
            }
        };

        prefillEdit();

        // Cleanup: invalidate pending requests
        return () => {
            requestSeqRef.current++;
        };
    }, [editTarget, isOpen, accountSession, onPrefill, onError]);

    return {
        isLoading,
    };
}
