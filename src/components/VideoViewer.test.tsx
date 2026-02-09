import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VideoViewer } from './VideoViewer';

describe('VideoViewer', () => {
    const mockOnClose = vi.fn();
    const mockVideos = [
        {
            url: 'https://example.com/video1.mp4',
            previewUrl: 'https://example.com/thumb1.jpg',
            description: 'Test video 1',
            type: 'video' as const,
        },
        {
            url: 'https://example.com/video2.mp4',
            previewUrl: 'https://example.com/thumb2.jpg',
            description: 'Test video 2',
            type: 'gifv' as const,
        },
    ];

    beforeEach(() => {
        mockOnClose.mockClear();
    });

    afterEach(() => {
        mockOnClose.mockReset();
    });

    describe('rendering', () => {
        it('should not render when isOpen is false', () => {
            const { container } = render(
                <VideoViewer isOpen={false} onClose={mockOnClose} videos={mockVideos} />
            );
            expect(container.firstChild).toBe(null);
        });

        it('should not render when videos array is empty', () => {
            const { container } = render(
                <VideoViewer isOpen={true} onClose={mockOnClose} videos={[]} />
            );
            expect(container.firstChild).toBe(null);
        });

        it('should render video element with correct src and poster', () => {
            render(<VideoViewer isOpen={true} onClose={mockOnClose} videos={mockVideos} />);

            const video = screen.getByRole('dialog').querySelector('video');
            expect(video).toBeInTheDocument();
            expect(video).toHaveAttribute('src', mockVideos[0].url);
            expect(video).toHaveAttribute('poster', mockVideos[0].previewUrl);
        });

        it('should render close button', () => {
            render(<VideoViewer isOpen={true} onClose={mockOnClose} videos={mockVideos} />);

            const closeButton = screen.getByLabelText('閉じる');
            expect(closeButton).toBeInTheDocument();
        });

        it('should render video description when provided', () => {
            render(<VideoViewer isOpen={true} onClose={mockOnClose} videos={mockVideos} />);

            expect(screen.getByText(mockVideos[0].description!)).toBeInTheDocument();
        });

        it('should render with correct aria-label', () => {
            render(<VideoViewer isOpen={true} onClose={mockOnClose} videos={mockVideos} />);

            const dialog = screen.getByRole('dialog');
            expect(dialog).toHaveAttribute('aria-label', '動画ビューアー');
            expect(dialog).toHaveAttribute('aria-modal', 'true');
        });

        it('should render with correct z-index', () => {
            const { container } = render(
                <VideoViewer isOpen={true} onClose={mockOnClose} videos={mockVideos} />
            );

            const dialog = container.firstChild as HTMLElement;
            expect(dialog).toHaveClass('z-[60]');
        });

        it('should use video description as aria-label for video element', () => {
            render(<VideoViewer isOpen={true} onClose={mockOnClose} videos={mockVideos} />);

            const video = screen.getByRole('dialog').querySelector('video');
            expect(video).toHaveAttribute('aria-label', mockVideos[0].description);
        });

        it('should use default aria-label when video has no description', () => {
            const videosWithoutDesc = [
                {
                    url: 'https://example.com/video1.mp4',
                    type: 'video' as const,
                },
            ];

            render(<VideoViewer isOpen={true} onClose={mockOnClose} videos={videosWithoutDesc} />);

            const video = screen.getByRole('dialog').querySelector('video');
            expect(video).toHaveAttribute('aria-label', '動画');
        });

        it('should not render description when video has no description', () => {
            const videosWithoutDesc = [
                {
                    url: 'https://example.com/video1.mp4',
                    type: 'video' as const,
                },
            ];

            render(<VideoViewer isOpen={true} onClose={mockOnClose} videos={videosWithoutDesc} />);

            // Check that no description text is rendered
            const dialogContent = screen.getByTestId('video-viewer-content');
            expect(dialogContent.textContent).not.toContain(videosWithoutDesc[0].url);
        });
    });

    describe('close behavior', () => {
        it('should call onClose when close button is clicked', () => {
            render(<VideoViewer isOpen={true} onClose={mockOnClose} videos={mockVideos} />);

            const closeButton = screen.getByLabelText('閉じる');
            fireEvent.click(closeButton);
            expect(mockOnClose).toHaveBeenCalledTimes(1);
        });

        it('should call onClose when backdrop is clicked', () => {
            render(<VideoViewer isOpen={true} onClose={mockOnClose} videos={mockVideos} />);

            // The backdrop is the first child (absolute inset-0 bg-black/90)
            const dialog = screen.getByRole('dialog');
            const backdrop = dialog.querySelector('.bg-black\\/90');
            expect(backdrop).toBeInTheDocument();
            if (backdrop) {
                fireEvent.click(backdrop);
                expect(mockOnClose).toHaveBeenCalledTimes(1);
            }
        });

        it('should not call onClose when video container is clicked', () => {
            render(<VideoViewer isOpen={true} onClose={mockOnClose} videos={mockVideos} />);

            const video = screen.getByRole('dialog').querySelector('video')!;
            fireEvent.click(video);
            expect(mockOnClose).not.toHaveBeenCalled();
        });
    });
});
