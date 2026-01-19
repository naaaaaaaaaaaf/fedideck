import { useEffect, useState } from 'react';
import './index.css';
import { Sidebar } from './components/Sidebar';
import { ColumnContainer } from './deck/ColumnContainer';
import { LoginModal } from './components/LoginModal';
import { AddColumnModal } from './components/AddColumnModal';
import { useAccountsStore } from './store/accounts';
import { useColumnsStore } from './store/columns';
import { initStreamManager } from './streaming/streamManager';

function App() {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isAddColumnModalOpen, setIsAddColumnModalOpen] = useState(false);

  const loadFromStorage = useAccountsStore(state => state.loadFromStorage);
  const accounts = useAccountsStore(state => state.accounts);
  const columns = useColumnsStore(state => state.columns);
  const addColumn = useColumnsStore(state => state.addColumn);

  // Load accounts from storage on mount
  useEffect(() => {
    loadFromStorage();
  }, []);

  // Initialize stream manager with event handlers (for future use)
  useEffect(() => {
    initStreamManager({
      onUpdate: () => { /* Streaming not yet implemented */ },
      onDelete: () => { /* Streaming not yet implemented */ },
      onNotification: () => { /* Streaming not yet implemented */ },
      onStatusUpdate: () => { /* Streaming not yet implemented */ },
      onReconnect: (accountId) => {
        console.log('Reconnecting stream for:', accountId);
      },
      onError: (accountId, error) => {
        console.error('Stream error for', accountId, ':', error);
      },
    });
  }, []);

  // Add default columns for new accounts
  useEffect(() => {
    if (accounts.length > 0 && columns.length === 0) {
      const firstAccount = accounts[0];
      // Add home and notifications columns by default
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

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Sidebar */}
      <Sidebar onAddAccount={() => setIsLoginModalOpen(true)} />

      {/* Main content */}
      <main className="flex-1 flex overflow-hidden">
        <ColumnContainer onAddColumn={() => setIsAddColumnModalOpen(true)} />
      </main>

      {/* Modals */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />
      <AddColumnModal
        isOpen={isAddColumnModalOpen}
        onClose={() => setIsAddColumnModalOpen(false)}
      />
    </div>
  );
}

export default App;
