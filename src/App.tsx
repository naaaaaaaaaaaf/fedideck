import { useEffect, useState, useRef, useCallback } from 'react';
import type { mastodon } from 'masto';
import './index.css';
import { Sidebar } from './components/Sidebar';
import { ColumnContainer } from './deck/ColumnContainer';
import { LoginModal } from './components/LoginModal';
import { AddColumnModal } from './components/AddColumnModal';
import { ComposeModal, type ReplyToStatus } from './components/ComposeModal';
import { StatusDetailModal } from './components/StatusDetailModal';
import { ProfileModal } from './components/ProfileModal';
import { ImageViewer, type ImageViewerImage } from './components/ImageViewer';
import { useAccountsStore } from './store/accounts';
import type { AccountSession } from './api/mastoClient';
import { useColumnsStore } from './store/columns';
import { useStreamsStore, getStreamKey } from './store/streams';
import { initStreamManager } from './streaming/streamManager';

function App() {
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [isAddColumnModalOpen, setIsAddColumnModalOpen] = useState(false);
    const [isComposeModalOpen, setIsComposeModalOpen] = useState(false);
    const [replyToStatus, setReplyToStatus] = useState<ReplyToStatus | undefined>(undefined);
    const [replyAccountId, setReplyAccountId] = useState<string | undefined>(undefined);
    const [isStatusDetailOpen, setIsStatusDetailOpen] = useState(false);
    const [detailStatus, setDetailStatus] = useState<mastodon.v1.Status | null>(null);
    const [detailAccountSession, setDetailAccountSession] = useState<AccountSession | undefined>();

    // NSFW revealed status IDs (for syncing between StatusCard and StatusDetailModal)
    const [nsfwRevealedStatusIds, setNsfwRevealedStatusIds] = useState<Set<string>>(new Set());

    // Profile modal state
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [profileAccount, setProfileAccount] = useState<mastodon.v1.Account | null>(null);
    const [profileAccountSession, setProfileAccountSession] = useState<
        AccountSession | undefined
    >();

    // ImageViewer state
    const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
    const [viewerImages, setViewerImages] = useState<ImageViewerImage[]>([]);
    const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
    const [imageViewerKey, setImageViewerKey] = useState(0);

    const loadFromStorage = useAccountsStore((state) => state.loadFromStorage);
    const accounts = useAccountsStore((state) => state.accounts);
    const columns = useColumnsStore((state) => state.columns);
    const addColumn = useColumnsStore((state) => state.addColumn);
    const { prependStatus, removeStatus, updateStatus, updateStatusGlobal, prependNotification } =
        useStreamsStore();

    // Ref to track if default columns have been added
    const hasAddedDefaultColumns = useRef(false);

    // Load accounts from storage on mount
    useEffect(() => {
        loadFromStorage();
    }, [loadFromStorage]);

    // Initialize stream manager with real callbacks
    useEffect(() => {
        initStreamManager({
            onUpdate: (accountId, status) => {
                // Update home timeline for this account
                const homeKey = getStreamKey(accountId, 'home');
                prependStatus(homeKey, status);
            },
            onDelete: (accountId, statusId) => {
                // Remove from all streams for this account
                const homeKey = getStreamKey(accountId, 'home');
                removeStatus(homeKey, statusId);
            },
            onNotification: (accountId, notification) => {
                const notifKey = getStreamKey(accountId, 'notifications');
                prependNotification(notifKey, notification);
            },
            onStatusUpdate: (accountId, status) => {
                const homeKey = getStreamKey(accountId, 'home');
                updateStatus(homeKey, status);
            },
            onConnect: (accountId) => {
                console.log(`✅ Streaming connected for ${accountId}`);
            },
            onDisconnect: (accountId) => {
                console.log(`❌ Streaming disconnected for ${accountId}`);
            },
            onError: (accountId, error) => {
                console.error(`Streaming error for ${accountId}:`, error);
            },
        });
    }, [prependStatus, removeStatus, updateStatus, prependNotification]);

    // Mark as initialized if columns already exist (from storage or manual addition)
    useEffect(() => {
        if (columns.length > 0) {
            hasAddedDefaultColumns.current = true;
        }
    }, [columns.length]);

    // Add default columns for new accounts (only if never initialized)
    useEffect(() => {
        if (!hasAddedDefaultColumns.current && accounts.length > 0 && columns.length === 0) {
            hasAddedDefaultColumns.current = true;
            const firstAccount = accounts[0];
            addColumn({ accountId: firstAccount.id, stream: { type: 'home' } });
            addColumn({ accountId: firstAccount.id, stream: { type: 'notifications' } });
        }
    }, [accounts, columns.length, addColumn]);

    // Derive login modal open state - show when no accounts exist or user explicitly opens it
    const shouldShowLoginModal = isLoginModalOpen || accounts.length === 0;

    const handleReply = (status: mastodon.v1.Status, accountId: string) => {
        const account = status.account;
        setReplyToStatus({
            id: status.id,
            acct: account.acct,
            displayName: account.displayName || account.username,
            content: status.content,
            avatar: account.avatar,
        });
        setReplyAccountId(accountId);
        setIsComposeModalOpen(true);
    };

    const handleStatusClick = (status: mastodon.v1.Status, accountId: string) => {
        const accountSession = accounts.find((a) => a.id === accountId);
        setDetailStatus(status);
        setDetailAccountSession(accountSession);
        setIsStatusDetailOpen(true);
    };

    const handleAccountClick = (
        account: mastodon.v1.Account,
        accountSessionId: string | undefined
    ) => {
        const accountSession = accounts.find((a) => a.id === accountSessionId);
        setProfileAccount(account);
        setProfileAccountSession(accountSession);
        setIsProfileModalOpen(true);
    };

    const handleStatusDetailReply = (status: mastodon.v1.Status) => {
        if (detailAccountSession) {
            handleReply(status, detailAccountSession.id);
        }
    };

    const handleDetailModalClose = () => {
        setIsStatusDetailOpen(false);
        setDetailStatus(null);
        setDetailAccountSession(undefined);
    };

    const handleProfileModalClose = () => {
        setIsProfileModalOpen(false);
        setProfileAccount(null);
        setProfileAccountSession(undefined);
    };

    const handleComposeClose = () => {
        setIsComposeModalOpen(false);
        setReplyToStatus(undefined);
        setReplyAccountId(undefined);
    };

    const handleImageClick = useCallback((images: ImageViewerImage[], index: number) => {
        setViewerImages(images);
        setViewerInitialIndex(index);
        setImageViewerKey((k) => k + 1); // Force remount to reset index
        setIsImageViewerOpen(true);
    }, []);

    const handleImageViewerClose = useCallback(() => {
        setIsImageViewerOpen(false);
    }, []);

    return (
        <div className="h-screen flex overflow-hidden">
            <Sidebar
                onAddAccount={() => setIsLoginModalOpen(true)}
                onCompose={() => setIsComposeModalOpen(true)}
            />

            <main className="flex-1 flex overflow-hidden">
                <ColumnContainer
                    onAddColumn={() => setIsAddColumnModalOpen(true)}
                    onReply={handleReply}
                    onStatusClick={handleStatusClick}
                    onImageClick={handleImageClick}
                    onAccountClick={handleAccountClick}
                    onNsfwReveal={(statusId) => {
                        setNsfwRevealedStatusIds((prev) => new Set(prev).add(statusId));
                    }}
                    nsfwRevealedStatusIds={nsfwRevealedStatusIds}
                />
            </main>

            <LoginModal
                isOpen={shouldShowLoginModal}
                onClose={() => setIsLoginModalOpen(false)}
                canClose={accounts.length > 0}
            />
            <AddColumnModal
                key={isAddColumnModalOpen ? 'open' : 'closed'}
                isOpen={isAddColumnModalOpen}
                onClose={() => setIsAddColumnModalOpen(false)}
            />
            <ComposeModal
                isOpen={isComposeModalOpen}
                onClose={handleComposeClose}
                replyToStatus={replyToStatus}
                accountId={replyAccountId}
            />
            <StatusDetailModal
                isOpen={isStatusDetailOpen}
                onClose={handleDetailModalClose}
                status={detailStatus}
                accountSession={detailAccountSession}
                onReply={handleStatusDetailReply}
                onStatusUpdate={updateStatusGlobal}
                onImageClick={handleImageClick}
                nsfwRevealedStatusIds={nsfwRevealedStatusIds}
                onNsfwReveal={(statusId) => {
                    setNsfwRevealedStatusIds((prev) => new Set(prev).add(statusId));
                }}
            />
            <ProfileModal
                isOpen={isProfileModalOpen}
                onClose={handleProfileModalClose}
                account={profileAccount}
                accountSession={profileAccountSession}
            />
            <ImageViewer
                key={imageViewerKey}
                isOpen={isImageViewerOpen}
                onClose={handleImageViewerClose}
                images={viewerImages}
                initialIndex={viewerInitialIndex}
            />
        </div>
    );
}

export default App;
