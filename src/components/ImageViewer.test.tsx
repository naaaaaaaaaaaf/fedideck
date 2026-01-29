import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImageViewer, type ImageViewerImage } from './ImageViewer';

const createMockImages = (count: number): ImageViewerImage[] => {
    return Array.from({ length: count }, (_, i) => ({
        url: `https://example.com/image${i + 1}.png`,
        previewUrl: `https://example.com/preview${i + 1}.png`,
        description: `Image ${i + 1} description`,
    }));
};

describe('ImageViewer', () => {
    describe('rendering', () => {
        it('should not render when isOpen is false', () => {
            const images = createMockImages(1);
            render(
                <ImageViewer
                    isOpen={false}
                    onClose={() => {}}
                    images={images}
                />
            );

            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        it('should not render when images array is empty', () => {
            render(
                <ImageViewer
                    isOpen={true}
                    onClose={() => {}}
                    images={[]}
                />
            );

            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        it('should render when isOpen is true and images are provided', () => {
            const images = createMockImages(1);
            render(
                <ImageViewer
                    isOpen={true}
                    onClose={() => {}}
                    images={images}
                />
            );

            expect(screen.getByRole('dialog')).toBeInTheDocument();
            const img = screen.getByRole('img');
            expect(img).toHaveAttribute('src', 'https://example.com/image1.png');
            expect(img).toHaveAttribute('alt', 'Image 1 description');
        });

        it('should display image description when provided', () => {
            const images = createMockImages(1);
            render(
                <ImageViewer
                    isOpen={true}
                    onClose={() => {}}
                    images={images}
                />
            );

            expect(screen.getByText('Image 1 description')).toBeInTheDocument();
        });

        it('should not display description text when not provided', () => {
            const images: ImageViewerImage[] = [{ url: 'https://example.com/image.png' }];
            const { container } = render(
                <ImageViewer
                    isOpen={true}
                    onClose={() => {}}
                    images={images}
                />
            );

            // The alt attribute should be empty string (img with empty alt has presentation role)
            const img = container.querySelector('img');
            expect(img).toHaveAttribute('alt', '');
            expect(img).toHaveAttribute('src', 'https://example.com/image.png');

            // No description text should be displayed (no description div)
            expect(screen.queryByText('Image 1 description')).not.toBeInTheDocument();
        });

        it('should not show navigation buttons for single image', () => {
            const images = createMockImages(1);
            render(
                <ImageViewer
                    isOpen={true}
                    onClose={() => {}}
                    images={images}
                />
            );

            expect(screen.queryByRole('button', { name: '前の画像' })).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: '次の画像' })).not.toBeInTheDocument();
        });

        it('should not show counter for single image', () => {
            const images = createMockImages(1);
            render(
                <ImageViewer
                    isOpen={true}
                    onClose={() => {}}
                    images={images}
                />
            );

            expect(screen.queryByText(/1 \/ 1/)).not.toBeInTheDocument();
        });

        it('should show navigation buttons for multiple images', () => {
            const images = createMockImages(3);
            render(
                <ImageViewer
                    isOpen={true}
                    onClose={() => {}}
                    images={images}
                />
            );

            expect(screen.getByRole('button', { name: '前の画像' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: '次の画像' })).toBeInTheDocument();
        });

        it('should show image counter for multiple images', () => {
            const images = createMockImages(4);
            render(
                <ImageViewer
                    isOpen={true}
                    onClose={() => {}}
                    images={images}
                />
            );

            expect(screen.getByText('1 / 4')).toBeInTheDocument();
        });

        it('should start at initialIndex', () => {
            const images = createMockImages(4);
            render(
                <ImageViewer
                    isOpen={true}
                    onClose={() => {}}
                    images={images}
                    initialIndex={2}
                />
            );

            expect(screen.getByText('3 / 4')).toBeInTheDocument();
            const img = screen.getByRole('img');
            expect(img).toHaveAttribute('src', 'https://example.com/image3.png');
        });
    });

    describe('navigation', () => {
        it('should navigate to next image when next button is clicked', async () => {
            const user = userEvent.setup();
            const images = createMockImages(3);
            render(
                <ImageViewer
                    isOpen={true}
                    onClose={() => {}}
                    images={images}
                />
            );

            // Initial state: first image
            expect(screen.getByText('1 / 3')).toBeInTheDocument();

            // Click next
            await user.click(screen.getByRole('button', { name: '次の画像' }));

            // Should be on second image
            expect(screen.getByText('2 / 3')).toBeInTheDocument();
            expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/image2.png');
        });

        it('should navigate to previous image when previous button is clicked', async () => {
            const user = userEvent.setup();
            const images = createMockImages(3);
            render(
                <ImageViewer
                    isOpen={true}
                    onClose={() => {}}
                    images={images}
                    initialIndex={1}
                />
            );

            // Initial state: second image
            expect(screen.getByText('2 / 3')).toBeInTheDocument();

            // Click previous
            await user.click(screen.getByRole('button', { name: '前の画像' }));

            // Should be on first image
            expect(screen.getByText('1 / 3')).toBeInTheDocument();
            expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/image1.png');
        });

        it('should wrap around to last image when previous is clicked on first image', async () => {
            const user = userEvent.setup();
            const images = createMockImages(3);
            render(
                <ImageViewer
                    isOpen={true}
                    onClose={() => {}}
                    images={images}
                />
            );

            // Initial state: first image
            expect(screen.getByText('1 / 3')).toBeInTheDocument();

            // Click previous
            await user.click(screen.getByRole('button', { name: '前の画像' }));

            // Should wrap to last image
            expect(screen.getByText('3 / 3')).toBeInTheDocument();
        });

        it('should wrap around to first image when next is clicked on last image', async () => {
            const user = userEvent.setup();
            const images = createMockImages(3);
            render(
                <ImageViewer
                    isOpen={true}
                    onClose={() => {}}
                    images={images}
                    initialIndex={2}
                />
            );

            // Initial state: last image
            expect(screen.getByText('3 / 3')).toBeInTheDocument();

            // Click next
            await user.click(screen.getByRole('button', { name: '次の画像' }));

            // Should wrap to first image
            expect(screen.getByText('1 / 3')).toBeInTheDocument();
        });

        it('should navigate with left arrow key', async () => {
            const user = userEvent.setup();
            const images = createMockImages(3);
            render(
                <ImageViewer
                    isOpen={true}
                    onClose={() => {}}
                    images={images}
                    initialIndex={1}
                />
            );

            expect(screen.getByText('2 / 3')).toBeInTheDocument();

            await user.keyboard('{ArrowLeft}');

            expect(screen.getByText('1 / 3')).toBeInTheDocument();
        });

        it('should navigate with right arrow key', async () => {
            const user = userEvent.setup();
            const images = createMockImages(3);
            render(
                <ImageViewer
                    isOpen={true}
                    onClose={() => {}}
                    images={images}
                />
            );

            expect(screen.getByText('1 / 3')).toBeInTheDocument();

            await user.keyboard('{ArrowRight}');

            expect(screen.getByText('2 / 3')).toBeInTheDocument();
        });

        it('should not navigate with arrow keys for single image', async () => {
            const user = userEvent.setup();
            const images = createMockImages(1);
            const onClose = vi.fn();
            render(
                <ImageViewer
                    isOpen={true}
                    onClose={onClose}
                    images={images}
                />
            );

            // Verify single image
            expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/image1.png');

            // Press arrow keys - should not change anything or close
            await user.keyboard('{ArrowLeft}');
            await user.keyboard('{ArrowRight}');

            // Image should still be the same
            expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/image1.png');
            // Modal should still be open
            expect(onClose).not.toHaveBeenCalled();
        });
    });

    describe('closing', () => {
        it('should call onClose when close button is clicked', async () => {
            const user = userEvent.setup();
            const onClose = vi.fn();
            const images = createMockImages(1);

            render(
                <ImageViewer
                    isOpen={true}
                    onClose={onClose}
                    images={images}
                />
            );

            await user.click(screen.getByRole('button', { name: '閉じる' }));

            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('should call onClose when backdrop is clicked', async () => {
            const user = userEvent.setup();
            const onClose = vi.fn();
            const images = createMockImages(1);

            render(
                <ImageViewer
                    isOpen={true}
                    onClose={onClose}
                    images={images}
                />
            );

            // Click on backdrop
            const backdrop = document.querySelector('.bg-black\\/90');
            expect(backdrop).toBeDefined();
            await user.click(backdrop!);

            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('should call onClose when Escape key is pressed', async () => {
            const user = userEvent.setup();
            const onClose = vi.fn();
            const images = createMockImages(1);

            render(
                <ImageViewer
                    isOpen={true}
                    onClose={onClose}
                    images={images}
                />
            );

            await user.keyboard('{Escape}');

            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('should not close when clicking on the image itself', async () => {
            const user = userEvent.setup();
            const onClose = vi.fn();
            const images = createMockImages(1);

            render(
                <ImageViewer
                    isOpen={true}
                    onClose={onClose}
                    images={images}
                />
            );

            await user.click(screen.getByRole('img'));

            expect(onClose).not.toHaveBeenCalled();
        });
    });

    describe('accessibility', () => {
        it('should have proper ARIA attributes', () => {
            const images = createMockImages(1);
            render(
                <ImageViewer
                    isOpen={true}
                    onClose={() => {}}
                    images={images}
                />
            );

            const dialog = screen.getByRole('dialog');
            expect(dialog).toHaveAttribute('aria-modal', 'true');
            expect(dialog).toHaveAttribute('aria-label', '画像ビューアー');
        });

        it('should focus close button when modal opens', () => {
            const images = createMockImages(1);
            render(
                <ImageViewer
                    isOpen={true}
                    onClose={() => {}}
                    images={images}
                />
            );

            const closeButton = screen.getByRole('button', { name: '閉じる' });
            expect(closeButton).toHaveFocus();
        });

        it('should trap focus within modal when Tab is pressed', async () => {
            const user = userEvent.setup();
            const images = createMockImages(3);
            render(
                <ImageViewer
                    isOpen={true}
                    onClose={() => {}}
                    images={images}
                />
            );

            // Focus should be on close button
            const closeButton = screen.getByRole('button', { name: '閉じる' });
            expect(closeButton).toHaveFocus();

            // Tab through all focusable elements
            await user.tab();
            await user.tab();
            await user.tab();

            // Focus should still be within the modal
            expect(document.activeElement?.closest('[role="dialog"]')).toBeTruthy();
        });

        it('should restore focus to previously focused element when closed', async () => {
            const images = createMockImages(1);
            const TestComponent = () => {
                const [isOpen, setIsOpen] = useState(false);
                return (
                    <>
                        <button data-testid="trigger" onClick={() => setIsOpen(true)}>
                            Open Viewer
                        </button>
                        <ImageViewer
                            isOpen={isOpen}
                            onClose={() => setIsOpen(false)}
                            images={images}
                        />
                    </>
                );
            };

            render(<TestComponent />);

            // Focus the trigger button and open modal
            const trigger = screen.getByTestId('trigger');
            trigger.focus();
            expect(trigger).toHaveFocus();

            await userEvent.click(trigger);

            // Modal should be open and close button focused
            const closeButton = screen.getByRole('button', { name: '閉じる' });
            expect(closeButton).toHaveFocus();

            // Close the modal
            await userEvent.click(closeButton);

            // Focus should be restored to trigger button
            expect(trigger).toHaveFocus();
        });
    });

    describe('index reset on reopen', () => {
        it('should reset to initialIndex when modal reopens', async () => {
            const images = createMockImages(4);
            const TestComponent = () => {
                const [isOpen, setIsOpen] = useState(true);
                return (
                    <>
                        <button data-testid="toggle" onClick={() => setIsOpen(prev => !prev)}>
                            Toggle
                        </button>
                        <ImageViewer
                            isOpen={isOpen}
                            onClose={() => setIsOpen(false)}
                            images={images}
                            initialIndex={0}
                        />
                    </>
                );
            };

            render(<TestComponent />);

            // Start at first image
            expect(screen.getByText('1 / 4')).toBeInTheDocument();

            // Navigate to third image
            await userEvent.click(screen.getByRole('button', { name: '次の画像' }));
            await userEvent.click(screen.getByRole('button', { name: '次の画像' }));
            expect(screen.getByText('3 / 4')).toBeInTheDocument();

            // Close modal
            await userEvent.click(screen.getByRole('button', { name: '閉じる' }));
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

            // Reopen modal
            await userEvent.click(screen.getByTestId('toggle'));

            // Should be back to first image (initialIndex)
            expect(screen.getByText('1 / 4')).toBeInTheDocument();
        });
    });
});
