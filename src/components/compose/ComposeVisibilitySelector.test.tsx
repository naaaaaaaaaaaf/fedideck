import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ComposeVisibilitySelector } from './ComposeVisibilitySelector';
import type { Visibility } from '../../hooks/usePostSubmit';

// Mock the visibility options
vi.mock('../../utils/statusVisibility', () => ({
    getVisibilityOptions: () => [
        { value: 'public', label: '公開', description: '誰でも見られます', icon: '🌐' },
        {
            value: 'unlisted',
            label: '未収載',
            description: 'フォロワーとリンクから',
            icon: '🔓',
        },
        { value: 'private', label: 'フォロワー限定', description: 'フォロワーのみ', icon: '🔒' },
        { value: 'direct', label: 'ダイレクト', description: 'メンションした人のみ', icon: '✉️' },
    ],
}));

describe('ComposeVisibilitySelector', () => {
    const mockOnChange = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render all visibility options', () => {
        render(
            <ComposeVisibilitySelector
                visibility="public"
                isEditMode={false}
                onChange={mockOnChange}
            />
        );

        expect(screen.getByText('公開')).toBeInTheDocument();
        expect(screen.getByText('未収載')).toBeInTheDocument();
        expect(screen.getByText('フォロワー限定')).toBeInTheDocument();
        expect(screen.getByText('ダイレクト')).toBeInTheDocument();
    });

    it('should highlight selected visibility', () => {
        render(
            <ComposeVisibilitySelector
                visibility="private"
                isEditMode={false}
                onChange={mockOnChange}
            />
        );

        const selectedLabel = screen.getByText('フォロワー限定').closest('label');
        expect(selectedLabel).toHaveClass('bg-indigo-500/20');
    });

    it('should call onChange when clicking option', () => {
        render(
            <ComposeVisibilitySelector
                visibility="public"
                isEditMode={false}
                onChange={mockOnChange}
            />
        );

        fireEvent.click(screen.getByText('未収載'));

        expect(mockOnChange).toHaveBeenCalledWith('unlisted');
    });

    it('should not call onChange in edit mode', () => {
        render(
            <ComposeVisibilitySelector
                visibility="public"
                isEditMode={true}
                onChange={mockOnChange}
            />
        );

        fireEvent.click(screen.getByText('未収載'));

        expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('should show edit mode hint', () => {
        render(
            <ComposeVisibilitySelector
                visibility="public"
                isEditMode={true}
                onChange={mockOnChange}
            />
        );

        expect(screen.getByText('(編集中は変更できません)')).toBeInTheDocument();
    });

    it('should disable radio inputs in edit mode', () => {
        render(
            <ComposeVisibilitySelector
                visibility="public"
                isEditMode={true}
                onChange={mockOnChange}
            />
        );

        const radios = screen.getAllByRole('radio');
        radios.forEach((radio) => {
            expect(radio).toBeDisabled();
        });
    });
});
