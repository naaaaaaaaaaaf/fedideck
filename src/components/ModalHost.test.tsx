/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ModalHost } from './ModalHost';
import { useModalsStore } from '../store/modals';

// Mock all child modal components to just render a data-testid div
vi.mock('./StatusDetailModal', () => ({
    StatusDetailModal: ({ isOpen, isActive, zIndex, onStatusDelete }: any) =>
        isOpen ? (
            <div
                data-testid="status-detail-modal"
                data-active={String(isActive)}
                data-zindex={zIndex}
            >
                <button
                    data-testid="delete-btn"
                    onClick={() => onStatusDelete?.({ id: 's1' }, 'acct-1')}
                />
            </div>
        ) : (
            <div
                data-testid="status-detail-modal"
                data-active={String(isActive)}
                data-zindex={zIndex}
                style={{ visibility: 'hidden' }}
            />
        ),
}));

vi.mock('./ProfileModal', () => ({
    ProfileModal: ({ isOpen, isActive, zIndex, onStatusDelete }: any) =>
        isOpen ? (
            <div
                data-testid="profile-modal"
                data-open={String(isOpen)}
                data-active={String(isActive)}
                data-zindex={zIndex}
            >
                <button
                    data-testid="profile-delete-btn"
                    onClick={() => onStatusDelete?.({ id: 's1' }, 'acct-1')}
                />
            </div>
        ) : (
            <div
                data-testid="profile-modal"
                data-open={String(isOpen)}
                data-active={String(isActive)}
                data-zindex={zIndex}
                style={{ visibility: 'hidden' }}
            />
        ),
}));

vi.mock('./ComposeModal', () => ({
    ComposeModal: ({ isOpen, isActive, zIndex }: any) =>
        isOpen ? (
            <div data-testid="compose-modal" data-active={String(isActive)} data-zindex={zIndex} />
        ) : null,
}));

vi.mock('./ConfirmModal', () => ({
    ConfirmModal: ({ isOpen, isActive, zIndex }: any) =>
        isOpen ? (
            <div data-testid="confirm-modal" data-active={String(isActive)} data-zindex={zIndex} />
        ) : null,
}));

vi.mock('./ImageViewer', () => ({
    ImageViewer: ({ isActive, zIndex }: any) => (
        <div data-testid="image-viewer" data-active={String(isActive)} data-zindex={zIndex} />
    ),
}));

vi.mock('./VideoViewer', () => ({
    VideoViewer: ({ isActive, zIndex }: any) => (
        <div data-testid="video-viewer" data-active={String(isActive)} data-zindex={zIndex} />
    ),
}));

vi.mock('./AudioPlayer', () => ({
    AudioPlayer: ({ isActive, zIndex }: any) => (
        <div data-testid="audio-player" data-active={String(isActive)} data-zindex={zIndex} />
    ),
}));

vi.mock('./LoginModal', () => ({
    LoginModal: ({ isOpen, isActive, zIndex }: any) =>
        isOpen ? (
            <div data-testid="login-modal" data-active={String(isActive)} data-zindex={zIndex} />
        ) : null,
}));

vi.mock('./AddColumnModal', () => ({
    AddColumnModal: ({ isOpen, isActive, zIndex }: any) =>
        isOpen ? (
            <div
                data-testid="add-column-modal"
                data-active={String(isActive)}
                data-zindex={zIndex}
            />
        ) : null,
}));

// Mock API and store dependencies
vi.mock('../api/mastoClient', () => ({
    getClient: vi.fn(),
    deleteStatus: vi.fn(),
}));

const mockAccounts = [{ id: 'acct-1' }];

vi.mock('../store/accounts', () => ({
    useAccountsStore: (selector: any) =>
        selector({ accounts: mockAccounts, loadFromStorage: vi.fn() }),
}));

vi.mock('../store/streams', () => ({
    useStreamsStore: (selector: any) => selector({ removeStatusForAccountStreams: vi.fn() }),
}));

// Minimal mock mastodon status
function mockStatus(id: string) {
    return { id } as any;
}

function mockAccount(id: string) {
    return { id } as any;
}

const defaultProps = {
    onReply: vi.fn(),
    onQuote: vi.fn(),
    onStatusClick: vi.fn(),
    onImageClick: vi.fn(),
    onVideoClick: vi.fn(),
    onAudioClick: vi.fn(),
    onAccountClick: vi.fn(),
    onStatusDeleteRequest: vi.fn(),
    onStatusEditRequest: vi.fn(),
    onStatusUpdateGlobal: vi.fn(),
    onPollUpdateGlobal: vi.fn(),
    onStatusEdited: vi.fn(),
    nsfwRevealedStatusIdSet: new Set<string>(),
    addNsfwRevealedStatusId: vi.fn(),
    shouldShowLoginModal: false,
};

describe('ModalHost', () => {
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
        });
        vi.clearAllMocks();
    });

    it('renders stack entries in order', () => {
        useModalsStore.getState().pushStatusDetail(mockStatus('s1'), 'acct-1');
        useModalsStore.getState().pushProfile(mockAccount('a1'), 'acct-1');

        render(<ModalHost {...defaultProps} />);

        const statusModals = screen.queryAllByTestId('status-detail-modal');
        const profileModals = screen.queryAllByTestId('profile-modal');

        // Both should be rendered
        expect(statusModals).toHaveLength(1);
        expect(profileModals).toHaveLength(1);

        // Profile (top) should be isOpen=true
        expect(profileModals[0]).toHaveAttribute('data-open', 'true');
    });

    it('passes isActive=true only to topmost stack entry', () => {
        useModalsStore.getState().pushStatusDetail(mockStatus('s1'), 'acct-1');
        useModalsStore.getState().pushStatusDetail(mockStatus('s2'), 'acct-1');

        render(<ModalHost {...defaultProps} />);

        const modals = screen.queryAllByTestId('status-detail-modal');
        expect(modals).toHaveLength(2);

        // Bottom entry (s1) — isOpen=false, isActive=false
        expect(modals[0]).toHaveAttribute('data-active', 'false');
        // Top entry (s2) — isOpen=true, isActive=true (no blocking overlay)
        expect(modals[1]).toHaveAttribute('data-active', 'true');
    });

    it('activeOverlay priority: addColumn > confirm > compose', () => {
        // Open compose, confirm, and addColumn simultaneously in store
        useModalsStore.getState().openCompose({ mode: 'new' });
        useModalsStore.getState().openConfirm({
            status: mockStatus('s1'),
            accountId: 'acct-1',
        });
        useModalsStore.getState().openAddColumn();

        render(<ModalHost {...defaultProps} />);

        // AddColumn is highest priority — should be active
        const addColumnModal = screen.getByTestId('add-column-modal');
        expect(addColumnModal).toHaveAttribute('data-active', 'true');

        // Compose and confirm are overridden by utility
        const composeModal = screen.queryByTestId('compose-modal');
        expect(composeModal).toBeNull(); // store cleared by openAddColumn
    });

    it('compose is active when no higher-priority overlay is open', () => {
        useModalsStore.getState().openCompose({ mode: 'new' });

        render(<ModalHost {...defaultProps} />);

        const composeModal = screen.getByTestId('compose-modal');
        expect(composeModal).toHaveAttribute('data-active', 'true');
    });

    it('confirm is active over compose', () => {
        useModalsStore.getState().openCompose({ mode: 'new' });
        // openConfirm clears compose in the store (mutual exclusion)
        useModalsStore.getState().openConfirm({
            status: mockStatus('s1'),
            accountId: 'acct-1',
        });

        render(<ModalHost {...defaultProps} />);

        const confirmModal = screen.getByTestId('confirm-modal');
        expect(confirmModal).toHaveAttribute('data-active', 'true');
        expect(screen.queryByTestId('compose-modal')).toBeNull();
    });

    it('renders login modal when shouldShowLoginModal is true', () => {
        render(<ModalHost {...defaultProps} shouldShowLoginModal={true} />);

        const loginModal = screen.getByTestId('login-modal');
        expect(loginModal).toHaveAttribute('data-active', 'true');
    });

    it('passes entry.id as originStackEntryId when onStatusDelete is called from stack entry', () => {
        useModalsStore.getState().pushStatusDetail(mockStatus('s1'), 'acct-1');

        render(<ModalHost {...defaultProps} />);

        const deleteBtn = screen.getByTestId('delete-btn');
        deleteBtn.click();

        // onStatusDeleteRequest should be called with (status, accountId, entry.id)
        expect(defaultProps.onStatusDeleteRequest).toHaveBeenCalledTimes(1);
        const callArgs = defaultProps.onStatusDeleteRequest.mock.calls[0];
        expect(callArgs[0]).toEqual({ id: 's1' }); // status
        expect(callArgs[1]).toBe('acct-1'); // accountId
        expect(callArgs[2]).toMatch(/^stack-\d+$/); // originStackEntryId
    });

    it('does not pass originStackEntryId when delete is requested from profile modal', () => {
        useModalsStore.getState().pushProfile(mockAccount('a1'), 'acct-1');

        render(<ModalHost {...defaultProps} />);

        const deleteBtn = screen.getByTestId('profile-delete-btn');
        deleteBtn.click();

        expect(defaultProps.onStatusDeleteRequest).toHaveBeenCalledTimes(1);
        const callArgs = defaultProps.onStatusDeleteRequest.mock.calls[0];
        expect(callArgs[0]).toEqual({ id: 's1' }); // status
        expect(callArgs[1]).toBe('acct-1'); // accountId
        expect(callArgs[2]).toBeUndefined(); // no originStackEntryId
    });
});
