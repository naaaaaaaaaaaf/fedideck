import { useEffect, useState } from 'react';
import type { mastodon } from 'masto';
import './index.css';
import { Sidebar } from './components/Sidebar';
import { ColumnContainer } from './deck/ColumnContainer';
import { LoginModal } from './components/LoginModal';
import { AddColumnModal } from './components/AddColumnModal';
import { ComposeModal, type ReplyToStatus } from './components/ComposeModal';
import { useAccountsStore } from './store/accounts';
import { useColumnsStore } from './store/columns';
import { useStreamsStore, getStreamKey } from './store/streams';
import { initStreamManager } from './streaming/streamManager';

function App() {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isAddColumnModalOpen, setIsAddColumnModalOpen] = useState(false);
  const [isComposeModalOpen, setIsComposeModalOpen] = useState(false);
  const [replyToStatus, setReplyToStatus] = useState<ReplyToStatus | undefined>(undefined);

  const loadFromStorage = useAccountsStore(state => state.loadFromStorage);
  const accounts = useAccountsStore(state => state.accounts);
  const columns = useColumnsStore(state => state.columns);
  const addColumn = useColumnsStore(state => state.addColumn);
  const { prependStatus, removeStatus, updateStatus, prependNotification } = useStreamsStore();

  // Load accounts from storage on mount
  useEffect(() => {
    loadFromStorage();
  }, []);

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

  // Add default columns for new accounts
  useEffect(() => {
    if (accounts.length > 0 && columns.length === 0) {
      const firstAccount = accounts[0];
      addColumn({ accountId: firstAccount.id, stream: { type: 'home' } });
      addColumn({ accountId: firstAccount.id, stream: { type: 'notifications' } });
    }
  }, [accounts.length]);

  // Open login modal if no accounts
  useEffect(() => {
    if (accounts.length === 0) {
      setIsLoginModalOpen(true);
    }
  }, [accounts.length]);

  const handleReply = (status: mastodon.v1.Status) => {
    const account = status.account;
    setReplyToStatus({
      id: status.id,
      acct: account.acct,
      displayName: account.displayName || account.username,
      content: status.content,
      avatar: account.avatar,
    });
    setIsComposeModalOpen(true);
  };

  const handleComposeClose = () => {
    setIsComposeModalOpen(false);
    setReplyToStatus(undefined);
  };

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
        />
      </main>

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />
      <AddColumnModal
        isOpen={isAddColumnModalOpen}
        onClose={() => setIsAddColumnModalOpen(false)}
      />
      <ComposeModal
        isOpen={isComposeModalOpen}
        onClose={handleComposeClose}
        replyToStatus={replyToStatus}
      />
    </div>
  );
}

export default App;
