import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ComposeAccountSelector } from './ComposeAccountSelector';

describe('ComposeAccountSelector', () => {
    const mockOnSelectAccount = vi.fn();
    const mockOnToggleSelector = vi.fn();
    const mockOnSetFocusedIndex = vi.fn();

    const mockAccount1 = {
        id: 'account-1',
        instanceUrl: 'https://example.com',
        accessToken: 'token1',
        account: {
            id: '1',
            username: 'user1',
            displayName: 'User One',
            url: 'https://example.com/@user1',
            avatar: 'https://example.com/avatar1.png',
            acct: 'user1@example.com',
        },
    } as any;

    const mockAccount2 = {
        id: 'account-2',
        instanceUrl: 'https://other.com',
        accessToken: 'token2',
        account: {
            id: '2',
            username: 'user2',
            displayName: 'User Two',
            url: 'https://other.com/@user2',
            avatar: 'https://other.com/avatar2.png',
            acct: 'user2@other.com',
        },
    } as any;

    const defaultProps = {
        accounts: [mockAccount1, mockAccount2],
        composingAccount: mockAccount1,
        isLocked: false,
        showSelector: false,
        focusedIndex: 0,
        selectedAccountId: 'account-1',
        listboxRef: { current: null },
        onSelectAccount: mockOnSelectAccount,
        onToggleSelector: mockOnToggleSelector,
        onSetFocusedIndex: mockOnSetFocusedIndex,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render composing account', () => {
        render(<ComposeAccountSelector {...defaultProps} />);

        expect(screen.getByText('User One')).toBeInTheDocument();
        expect(screen.getByText('@user1@example.com')).toBeInTheDocument();
    });

    it('should return null when no composing account', () => {
        const { container } = render(
            <ComposeAccountSelector {...defaultProps} composingAccount={undefined} />
        );

        expect(container.firstChild).toBeNull();
    });

    it('should toggle selector on click', () => {
        render(<ComposeAccountSelector {...defaultProps} />);

        fireEvent.click(screen.getByRole('button', { name: /投稿アカウント/ }));

        expect(mockOnToggleSelector).toHaveBeenCalledWith(true);
    });

    it('should not toggle selector when locked', () => {
        render(<ComposeAccountSelector {...defaultProps} isLocked={true} />);

        fireEvent.click(screen.getByRole('button', { name: /投稿アカウント/ }));

        expect(mockOnToggleSelector).not.toHaveBeenCalled();
    });

    it('should show dropdown when showSelector is true', () => {
        render(<ComposeAccountSelector {...defaultProps} showSelector={true} />);

        expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('should not show dropdown when only one account', () => {
        render(
            <ComposeAccountSelector
                {...defaultProps}
                accounts={[mockAccount1]}
                showSelector={true}
            />
        );

        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('should not show dropdown when locked', () => {
        render(<ComposeAccountSelector {...defaultProps} isLocked={true} showSelector={true} />);

        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('should select account on click', () => {
        render(<ComposeAccountSelector {...defaultProps} showSelector={true} />);

        fireEvent.click(screen.getByText('User Two'));

        expect(mockOnSelectAccount).toHaveBeenCalledWith('account-2');
        expect(mockOnToggleSelector).toHaveBeenCalledWith(false);
    });

    it('should highlight selected account', () => {
        render(<ComposeAccountSelector {...defaultProps} showSelector={true} />);

        const selectedOption = screen.getByRole('option', { selected: true });
        expect(selectedOption).toHaveTextContent('User One');
    });

    it('should show chevron when multiple accounts and not locked', () => {
        render(<ComposeAccountSelector {...defaultProps} />);

        // Chevron is rendered as an SVG inside the button
        const button = screen.getByRole('button', { name: /投稿アカウント/ });
        const svg = button.querySelector('svg');
        expect(svg).toBeInTheDocument();
    });

    it('should not show chevron when locked', () => {
        render(<ComposeAccountSelector {...defaultProps} isLocked={true} />);

        // No chevron when locked - check that there's only the avatar image
        const button = screen.getByRole('button', { name: /投稿アカウント/ });
        const svg = button.querySelector('svg');
        expect(svg).not.toBeInTheDocument();
    });

    it('should rotate chevron when selector is open', () => {
        render(<ComposeAccountSelector {...defaultProps} showSelector={true} />);

        const button = screen.getByRole('button', { name: /投稿アカウント/ });
        const svg = button.querySelector('svg');
        expect(svg).toHaveClass('rotate-180');
    });

    it('should handle keyboard navigation - ArrowDown', () => {
        render(<ComposeAccountSelector {...defaultProps} showSelector={true} />);

        const listbox = screen.getByRole('listbox');
        fireEvent.keyDown(listbox, { key: 'ArrowDown' });

        expect(mockOnSetFocusedIndex).toHaveBeenCalled();
    });

    it('should handle keyboard navigation - ArrowUp', () => {
        render(<ComposeAccountSelector {...defaultProps} showSelector={true} />);

        const listbox = screen.getByRole('listbox');
        fireEvent.keyDown(listbox, { key: 'ArrowUp' });

        expect(mockOnSetFocusedIndex).toHaveBeenCalled();
    });

    it('should select account on Enter', () => {
        render(<ComposeAccountSelector {...defaultProps} showSelector={true} focusedIndex={1} />);

        const listbox = screen.getByRole('listbox');
        fireEvent.keyDown(listbox, { key: 'Enter' });

        expect(mockOnSelectAccount).toHaveBeenCalledWith('account-2');
    });

    it('should close on Escape', () => {
        render(<ComposeAccountSelector {...defaultProps} showSelector={true} />);

        const listbox = screen.getByRole('listbox');
        fireEvent.keyDown(listbox, { key: 'Escape' });

        expect(mockOnToggleSelector).toHaveBeenCalledWith(false);
    });

    it('should close on Tab', () => {
        render(<ComposeAccountSelector {...defaultProps} showSelector={true} />);

        const listbox = screen.getByRole('listbox');
        fireEvent.keyDown(listbox, { key: 'Tab' });

        expect(mockOnToggleSelector).toHaveBeenCalledWith(false);
    });
});
