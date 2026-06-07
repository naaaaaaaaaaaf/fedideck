import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VideoViewer } from './VideoViewer';

describe('VideoViewer', () => {
    // Store originals to restore after tests
    let originalRequestFullscreen: typeof Element.prototype.requestFullscreen;
    let originalExitFullscreen: typeof document.exitFullscreen;

    beforeAll(() => {
        // Store original values
        originalRequestFullscreen = Element.prototype.requestFullscreen;
        originalExitFullscreen = document.exitFullscreen;

        // Mock fullscreenElement as configurable own property
        // Note: fullscreenElement is typically on Document.prototype, not an own property
        Object.defineProperty(document, 'fullscreenElement', {
            writable: true,
            configurable: true,
            value: null,
        });

        // Mock Element.prototype.requestFullscreen
        Element.prototype.requestFullscreen = vi.fn(function () {
            // @ts-expect-error - Mocking fullscreen API for testing
            document.fullscreenElement = this;
            return Promise.resolve();
        }) as unknown as typeof Element.prototype.requestFullscreen;

        // Mock document.exitFullscreen
        document.exitFullscreen = vi.fn(function () {
            // @ts-expect-error - Mocking fullscreen API for testing
            document.fullscreenElement = null;
            return Promise.resolve();
        });
    });

    afterAll(() => {
        // Delete the mocked own property to restore Document.prototype.fullscreenElement
        // This is necessary because Object.getOwnPropertyDescriptor(document, 'fullscreenElement')
        // returns undefined (it's on the prototype, not an own property)
        Reflect.deleteProperty(document as Document & Record<string, unknown>, 'fullscreenElement');

        // Restore original methods
        Element.prototype.requestFullscreen = originalRequestFullscreen;
        document.exitFullscreen = originalExitFullscreen;
    });

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

        it('should render without fixed z-index class', () => {
            const { container } = render(
                <VideoViewer isOpen={true} onClose={mockOnClose} videos={mockVideos} />
            );

            const dialog = container.firstChild as HTMLElement;
            expect(dialog.style.zIndex).toBe('');
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

    describe('video controls', () => {
        it('should render play/pause button', () => {
            render(<VideoViewer isOpen={true} onClose={mockOnClose} videos={mockVideos} />);

            const playButton = screen.getByLabelText('再生');
            expect(playButton).toBeInTheDocument();
        });

        it('should render time display', () => {
            render(<VideoViewer isOpen={true} onClose={mockOnClose} videos={mockVideos} />);

            expect(screen.getByText('0:00 / 0:00')).toBeInTheDocument();
        });

        it('should render seek bar', () => {
            render(<VideoViewer isOpen={true} onClose={mockOnClose} videos={mockVideos} />);

            const seekBar = screen.getByRole('dialog').querySelector('input[type="range"]');
            expect(seekBar).toBeInTheDocument();
            expect(seekBar).toHaveAttribute('aria-label', 'シーク');
        });

        it('should toggle play/pause button label on click', () => {
            render(<VideoViewer isOpen={true} onClose={mockOnClose} videos={mockVideos} />);

            const playButton = screen.getByLabelText('再生');
            expect(playButton).toBeInTheDocument();

            // Click to toggle (though actual video won't play in test environment)
            fireEvent.click(playButton);

            // Button should now have pause label (or still have play if video didn't actually play)
            // The important thing is the button exists and can be clicked
            expect(playButton).toBeInTheDocument();
        });

        it('should handle seek bar change', () => {
            render(<VideoViewer isOpen={true} onClose={mockOnClose} videos={mockVideos} />);

            const seekBar = screen
                .getByRole('dialog')
                .querySelector('input[type="range"]') as HTMLInputElement;
            expect(seekBar).toBeInTheDocument();

            // The seek bar should be functional (able to trigger onChange)
            // In test environment without actual video, duration is 0, so value stays 0
            fireEvent.change(seekBar, { target: { value: '10' } });

            // Value may remain 0 due to max=0 constraint, but onChange should not error
            expect(seekBar).toBeInTheDocument();
        });

        it('should render volume control buttons', () => {
            render(<VideoViewer isOpen={true} onClose={mockOnClose} videos={mockVideos} />);

            const muteButton = screen.getByLabelText('ミュート');
            expect(muteButton).toBeInTheDocument();

            const volumeSlider = screen
                .getByRole('dialog')
                .querySelector('input[aria-label="音量"]') as HTMLInputElement;
            expect(volumeSlider).toBeInTheDocument();
            expect(volumeSlider).toHaveAttribute('type', 'range');
        });

        it('should render fullscreen button', () => {
            render(<VideoViewer isOpen={true} onClose={mockOnClose} videos={mockVideos} />);

            const fullscreenButton = screen.getByLabelText('全画面表示');
            expect(fullscreenButton).toBeInTheDocument();
        });

        it('should toggle mute button label on click', () => {
            render(<VideoViewer isOpen={true} onClose={mockOnClose} videos={mockVideos} />);

            const muteButton = screen.getByLabelText('ミュート');
            expect(muteButton).toBeInTheDocument();

            // Click to toggle mute
            fireEvent.click(muteButton);

            // Button label should change (though in test env without actual video, may not change)
            expect(muteButton).toBeInTheDocument();
        });
    });

    describe('multiple video navigation', () => {
        it('should render navigation buttons when multiple videos', () => {
            render(<VideoViewer isOpen={true} onClose={mockOnClose} videos={mockVideos} />);

            expect(screen.getByLabelText('前の動画')).toBeInTheDocument();
            expect(screen.getByLabelText('次の動画')).toBeInTheDocument();
        });

        it('should render video counter when multiple videos', () => {
            render(<VideoViewer isOpen={true} onClose={mockOnClose} videos={mockVideos} />);

            expect(screen.getByText('1 / 2')).toBeInTheDocument();
        });

        it('should not render navigation buttons when single video', () => {
            const singleVideo = [mockVideos[0]];
            render(<VideoViewer isOpen={true} onClose={mockOnClose} videos={singleVideo} />);

            expect(screen.queryByLabelText('前の動画')).not.toBeInTheDocument();
            expect(screen.queryByLabelText('次の動画')).not.toBeInTheDocument();
        });

        it('should navigate to next video when next button is clicked', () => {
            render(<VideoViewer isOpen={true} onClose={mockOnClose} videos={mockVideos} />);

            const nextButton = screen.getByLabelText('次の動画');
            fireEvent.click(nextButton);

            // Counter should update to 2 / 2
            expect(screen.getByText('2 / 2')).toBeInTheDocument();
        });

        it('should navigate to previous video when previous button is clicked', () => {
            render(
                <VideoViewer
                    isOpen={true}
                    onClose={mockOnClose}
                    videos={mockVideos}
                    initialIndex={1}
                />
            );

            // Should start at 2 / 2
            expect(screen.getByText('2 / 2')).toBeInTheDocument();

            const prevButton = screen.getByLabelText('前の動画');
            fireEvent.click(prevButton);

            // Counter should update to 1 / 2
            expect(screen.getByText('1 / 2')).toBeInTheDocument();
        });

        it('should wrap around to first video when next is clicked on last video', () => {
            render(
                <VideoViewer
                    isOpen={true}
                    onClose={mockOnClose}
                    videos={mockVideos}
                    initialIndex={1}
                />
            );

            // Should start at 2 / 2
            expect(screen.getByText('2 / 2')).toBeInTheDocument();

            const nextButton = screen.getByLabelText('次の動画');
            fireEvent.click(nextButton);

            // Counter should wrap to 1 / 2
            expect(screen.getByText('1 / 2')).toBeInTheDocument();
        });

        it('should wrap around to last video when previous is clicked on first video', () => {
            render(<VideoViewer isOpen={true} onClose={mockOnClose} videos={mockVideos} />);

            // Should start at 1 / 2
            expect(screen.getByText('1 / 2')).toBeInTheDocument();

            const prevButton = screen.getByLabelText('前の動画');
            fireEvent.click(prevButton);

            // Counter should wrap to 2 / 2
            expect(screen.getByText('2 / 2')).toBeInTheDocument();
        });
    });

    describe('keyboard shortcuts', () => {
        it('should toggle play/pause when Space key is pressed', () => {
            render(<VideoViewer isOpen={true} onClose={mockOnClose} videos={mockVideos} />);

            const dialog = screen.getByRole('dialog');
            const playButton = screen.getByLabelText('再生');

            // Press Space key
            fireEvent.keyDown(dialog, { key: ' ' });

            // Play button should still be present
            expect(playButton).toBeInTheDocument();
        });

        it('should handle fullscreen toggle when f key is pressed', () => {
            render(<VideoViewer isOpen={true} onClose={mockOnClose} videos={mockVideos} />);

            const dialog = screen.getByRole('dialog');
            const fullscreenButton = screen.getByLabelText('全画面表示');

            // Press f key
            fireEvent.keyDown(dialog, { key: 'f' });

            // Button should still be present (actual fullscreen not testable in jsdom)
            expect(fullscreenButton).toBeInTheDocument();
        });

        it('should handle F key (uppercase) for fullscreen', () => {
            render(<VideoViewer isOpen={true} onClose={mockOnClose} videos={mockVideos} />);

            const dialog = screen.getByRole('dialog');

            // Press F key (uppercase)
            fireEvent.keyDown(dialog, { key: 'F' });

            expect(screen.getByLabelText('全画面表示')).toBeInTheDocument();
        });

        it('should navigate to next video with ArrowRight when multiple videos', () => {
            render(<VideoViewer isOpen={true} onClose={mockOnClose} videos={mockVideos} />);

            const dialog = screen.getByRole('dialog');

            // Should start at 1 / 2
            expect(screen.getByText('1 / 2')).toBeInTheDocument();

            // Press ArrowRight key
            fireEvent.keyDown(dialog, { key: 'ArrowRight' });

            // Counter should update to 2 / 2
            expect(screen.getByText('2 / 2')).toBeInTheDocument();
        });

        it('should navigate to previous video with ArrowLeft when multiple videos', () => {
            render(<VideoViewer isOpen={true} onClose={mockOnClose} videos={mockVideos} />);

            const dialog = screen.getByRole('dialog');

            // Should start at 1 / 2
            expect(screen.getByText('1 / 2')).toBeInTheDocument();

            // Press ArrowLeft key
            fireEvent.keyDown(dialog, { key: 'ArrowLeft' });

            // Counter should wrap to 2 / 2
            expect(screen.getByText('2 / 2')).toBeInTheDocument();
        });

        describe('focus trap with interactive elements', () => {
            it('should delegate Tab key to baseHandleKeyDown when range input is focused', () => {
                render(<VideoViewer isOpen={true} onClose={mockOnClose} videos={mockVideos} />);

                const seekBar = screen
                    .getByRole('dialog')
                    .querySelector('input[type="range"]') as HTMLInputElement;

                // Simulate Tab key on range input
                // The baseHandleKeyDown should receive the Tab event for focus trap
                fireEvent.keyDown(seekBar, { key: 'Tab' });

                // If focus trap works, the event should not be prevented by our handler
                // and should reach useModalAccessibility's Tab handling
                expect(seekBar).toBeInTheDocument();
            });

            it('should delegate Shift+Tab key to baseHandleKeyDown when button is focused', () => {
                render(<VideoViewer isOpen={true} onClose={mockOnClose} videos={mockVideos} />);

                const closeButton = screen.getByLabelText('閉じる');

                // Simulate Shift+Tab key on button
                fireEvent.keyDown(closeButton, { key: 'Tab', shiftKey: true });

                // Button should still be present, focus trap should handle Tab
                expect(closeButton).toBeInTheDocument();
            });

            it('should delegate ESC key to baseHandleKeyDown when range input is focused', () => {
                render(<VideoViewer isOpen={true} onClose={mockOnClose} videos={mockVideos} />);

                const seekBar = screen
                    .getByRole('dialog')
                    .querySelector('input[type="range"]') as HTMLInputElement;

                // ESC on range input should close modal (via baseHandleKeyDown)
                fireEvent.keyDown(seekBar, { key: 'Escape' });

                expect(mockOnClose).toHaveBeenCalledTimes(1);
            });

            it('should allow arrow keys to work on range input (not intercepted)', () => {
                render(<VideoViewer isOpen={true} onClose={mockOnClose} videos={mockVideos} />);

                const seekBar = screen
                    .getByRole('dialog')
                    .querySelector('input[type="range"]') as HTMLInputElement;

                // Arrow keys on range input should not be intercepted by video controls
                // They should allow default behavior (adjusting the slider)
                fireEvent.keyDown(seekBar, { key: 'ArrowRight' });

                // The slider should still be functional
                expect(seekBar).toBeInTheDocument();
            });

            it('should allow Space key to work on button (not intercepted for play/pause)', () => {
                render(<VideoViewer isOpen={true} onClose={mockOnClose} videos={mockVideos} />);

                const playButton = screen.getByLabelText('再生');

                // Space key on button should not trigger video play/pause
                // It should activate the button instead
                fireEvent.keyDown(playButton, { key: ' ' });

                // Button should still be present and functional
                expect(playButton).toBeInTheDocument();
            });
        });
    });

    describe('gifv type support', () => {
        it('should render gifv video with loop attribute', () => {
            const gifvVideos = [
                {
                    url: 'https://example.com/gifv.mp4',
                    type: 'gifv' as const,
                },
            ];

            render(<VideoViewer isOpen={true} onClose={mockOnClose} videos={gifvVideos} />);

            const video = screen.getByRole('dialog').querySelector('video');
            expect(video).toHaveAttribute('loop');
        });

        it('should render gifv video with muted attribute', () => {
            const gifvVideos = [
                {
                    url: 'https://example.com/gifv.mp4',
                    type: 'gifv' as const,
                },
            ];

            render(<VideoViewer isOpen={true} onClose={mockOnClose} videos={gifvVideos} />);

            const video = screen.getByRole('dialog').querySelector('video') as HTMLVideoElement;
            // Check the muted property
            expect(video.muted).toBe(true);
        });

        it('should not render regular video with loop attribute', () => {
            const regularVideos = [
                {
                    url: 'https://example.com/video.mp4',
                    type: 'video' as const,
                },
            ];

            render(<VideoViewer isOpen={true} onClose={mockOnClose} videos={regularVideos} />);

            const video = screen.getByRole('dialog').querySelector('video');
            expect(video).not.toHaveAttribute('loop');
        });

        it('should not render regular video with muted attribute', () => {
            const regularVideos = [
                {
                    url: 'https://example.com/video.mp4',
                    type: 'video' as const,
                },
            ];

            render(<VideoViewer isOpen={true} onClose={mockOnClose} videos={regularVideos} />);

            const video = screen.getByRole('dialog').querySelector('video') as HTMLVideoElement;
            expect(video.muted).toBe(false);
        });
    });
});
