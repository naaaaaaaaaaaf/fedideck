import { useRef } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useModalAccessibility } from './useModalAccessibility';

// Test component that uses the hook
function TestModal({
    isOpen,
    onClose,
    canClose = true,
}: {
    isOpen: boolean;
    onClose: () => void;
    canClose?: boolean;
}) {
    const modalRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);

    const { handleKeyDown } = useModalAccessibility({
        isOpen,
        onClose,
        closeButtonRef,
        modalRef,
        canClose,
    });

    if (!isOpen) return null;

    return (
        <div onKeyDown={handleKeyDown} role="dialog" aria-modal="true" data-testid="modal-wrapper">
            <div ref={modalRef} data-testid="modal-content">
                <button ref={closeButtonRef} data-testid="close-button">
                    閉じる
                </button>
                <input data-testid="input-field" type="text" />
                <button data-testid="action-button">アクション</button>
            </div>
        </div>
    );
}

// Test component without close button (closeButtonRef is null)
function TestModalNoCloseButton({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const modalRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);

    const { handleKeyDown } = useModalAccessibility({
        isOpen,
        onClose,
        closeButtonRef,
        modalRef,
        canClose: false,
    });

    if (!isOpen) return null;

    return (
        <div onKeyDown={handleKeyDown} role="dialog" aria-modal="true" data-testid="modal-wrapper">
            <div ref={modalRef} data-testid="modal-content">
                {/* No close button rendered - closeButtonRef will be null */}
                <input data-testid="first-input" type="text" />
                <button data-testid="submit-button">送信</button>
            </div>
        </div>
    );
}

// Test component with an extra data attribute for pointer event targeting.
function TestModalWithPointer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const modalRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);

    const { handleKeyDown } = useModalAccessibility({
        isOpen,
        onClose,
        closeButtonRef,
        modalRef,
    });

    if (!isOpen) return null;

    return (
        <div onKeyDown={handleKeyDown} role="dialog" aria-modal="true" data-testid="modal-wrapper">
            <div ref={modalRef} data-testid="modal-content">
                <button ref={closeButtonRef} data-testid="close-button">
                    閉じる
                </button>
                <div data-testid="drag-target">ドラッグ対象</div>
                <p data-testid="selectable-text">これは選択可能なテキストです</p>
                <button data-testid="action-button">アクション</button>
            </div>
        </div>
    );
}

describe('useModalAccessibility', () => {
    let onClose: () => void;

    beforeEach(() => {
        onClose = vi.fn();
    });

    describe('ESC key handling', () => {
        it('ESCキーでonCloseが呼ばれる', () => {
            render(<TestModal isOpen={true} onClose={onClose} />);

            const modalWrapper = screen.getByTestId('modal-wrapper');
            fireEvent.keyDown(modalWrapper, { key: 'Escape' });

            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('canClose=falseの場合ESCキーでonCloseが呼ばれない', () => {
            render(<TestModal isOpen={true} onClose={onClose} canClose={false} />);

            const modalWrapper = screen.getByTestId('modal-wrapper');
            fireEvent.keyDown(modalWrapper, { key: 'Escape' });

            expect(onClose).not.toHaveBeenCalled();
        });
    });

    describe('focus management', () => {
        it('モーダルが開いた時に閉じるボタンにフォーカスが移動する', () => {
            render(<TestModal isOpen={true} onClose={onClose} />);

            const closeButton = screen.getByTestId('close-button');
            expect(document.activeElement).toBe(closeButton);
        });

        it('閉じるボタンがない場合は最初のフォーカス可能な要素にフォーカスが移動する', () => {
            render(<TestModalNoCloseButton isOpen={true} onClose={onClose} />);

            // 最初のフォーカス可能な要素（input）にフォーカスが移動する
            const firstInput = screen.getByTestId('first-input');
            expect(document.activeElement).toBe(firstInput);
        });

        it('モーダルが閉じた時にフォーカスが復帰する', () => {
            // 外部ボタンを先にフォーカス
            const { rerender } = render(
                <>
                    <button data-testid="trigger-button">トリガー</button>
                    <TestModal isOpen={false} onClose={onClose} />
                </>
            );

            const triggerButton = screen.getByTestId('trigger-button');
            triggerButton.focus();
            expect(document.activeElement).toBe(triggerButton);

            // モーダルを開く
            rerender(
                <>
                    <button data-testid="trigger-button">トリガー</button>
                    <TestModal isOpen={true} onClose={onClose} />
                </>
            );

            const closeButton = screen.getByTestId('close-button');
            expect(document.activeElement).toBe(closeButton);

            // モーダルを閉じる
            rerender(
                <>
                    <button data-testid="trigger-button">トリガー</button>
                    <TestModal isOpen={false} onClose={onClose} />
                </>
            );

            expect(document.activeElement).toBe(triggerButton);
        });
    });

    describe('focus trap', () => {
        it('最後の要素でTabを押すと最初の要素にフォーカスが移動する', async () => {
            const user = userEvent.setup();
            render(<TestModal isOpen={true} onClose={onClose} />);

            // 最後のボタンにフォーカス
            const actionButton = screen.getByTestId('action-button');
            actionButton.focus();

            // Tabを押す
            await user.tab();

            // 最初の要素（閉じるボタン）にフォーカスが戻る
            const closeButton = screen.getByTestId('close-button');
            expect(document.activeElement).toBe(closeButton);
        });

        it('最初の要素でShift+Tabを押すと最後の要素にフォーカスが移動する', async () => {
            const user = userEvent.setup();
            render(<TestModal isOpen={true} onClose={onClose} />);

            // 最初のボタン（閉じるボタン）にフォーカス
            const closeButton = screen.getByTestId('close-button');
            closeButton.focus();

            // Shift+Tabを押す
            await user.tab({ shift: true });

            // 最後の要素にフォーカスが移動する
            const actionButton = screen.getByTestId('action-button');
            expect(document.activeElement).toBe(actionButton);
        });

        it('閉じるボタンがない場合もフォーカストラップが機能する', async () => {
            const user = userEvent.setup();
            render(<TestModalNoCloseButton isOpen={true} onClose={onClose} />);

            // 最後のボタンにフォーカス
            const submitButton = screen.getByTestId('submit-button');
            submitButton.focus();

            // Tabを押す
            await user.tab();

            // 最初の要素（input）にフォーカスが戻る
            const firstInput = screen.getByTestId('first-input');
            expect(document.activeElement).toBe(firstInput);
        });
    });

    describe('pointer drag behavior', () => {
        it('pointerdown中はfocusoutでフォーカス復帰しない', async () => {
            render(<TestModalWithPointer isOpen={true} onClose={onClose} />);

            const modalContent = screen.getByTestId('modal-content');
            const actionButton = screen.getByTestId('action-button');
            const dragTarget = screen.getByTestId('drag-target');

            actionButton.focus();
            expect(document.activeElement).toBe(actionButton);

            fireEvent.pointerDown(modalContent);
            fireEvent.pointerDown(dragTarget);
            actionButton.blur();
            fireEvent.focusOut(modalContent);

            // During pointerdown, focus should not be forced to close button.
            // Use waitFor to account for setTimeout in focusout handler
            await waitFor(() => {
                const closeButton = screen.getByTestId('close-button');
                expect(document.activeElement).not.toBe(closeButton);
            });

            fireEvent.pointerUp(window);
        });

        it('テキスト選択中はfocusoutでフォーカス復帰しない', async () => {
            render(<TestModalWithPointer isOpen={true} onClose={onClose} />);

            const modalContent = screen.getByTestId('modal-content');
            const actionButton = screen.getByTestId('action-button');
            const selectableText = screen.getByTestId('selectable-text');

            actionButton.focus();
            expect(document.activeElement).toBe(actionButton);

            // Simulate text selection by creating a range
            const range = document.createRange();
            range.selectNodeContents(selectableText);
            const selection = window.getSelection();
            selection?.removeAllRanges();
            selection?.addRange(range);

            // Verify text is actually selected
            expect(selection?.rangeCount).toBeGreaterThan(0);
            expect(selection?.isCollapsed).toBe(false);

            actionButton.blur();
            fireEvent.focusOut(modalContent);

            // During text selection, focus should not be forced to close button
            await waitFor(() => {
                const closeButton = screen.getByTestId('close-button');
                expect(document.activeElement).not.toBe(closeButton);
            });

            // Clean up selection
            selection?.removeAllRanges();
        });
    });

    describe('modal closed state', () => {
        it('isOpen=falseの場合モーダルがレンダリングされない', () => {
            render(<TestModal isOpen={false} onClose={onClose} />);

            expect(screen.queryByTestId('modal-wrapper')).not.toBeInTheDocument();
        });
    });
});
