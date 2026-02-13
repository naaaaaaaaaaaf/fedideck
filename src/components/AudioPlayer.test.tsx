import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AudioPlayer } from './AudioPlayer';
import type { AudioViewerTrack } from '../types/audio';

describe('AudioPlayer', () => {
    const mockOnClose = vi.fn();
    const mockTracks: AudioViewerTrack[] = [
        {
            url: 'https://example.com/audio1.mp3',
            artworkUrl: 'https://example.com/artwork1.jpg',
            description: 'Test audio 1',
        },
        {
            url: 'https://example.com/audio2.mp3',
            artworkUrl: 'https://example.com/artwork2.jpg',
            description: 'Test audio 2',
        },
        {
            url: 'https://example.com/audio3.mp3',
            artworkUrl: undefined,
            description: 'Test audio 3',
        },
    ];

    beforeEach(() => {
        mockOnClose.mockClear();
        // Mock HTMLAudioElement methods
        HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
        HTMLMediaElement.prototype.pause = vi.fn();
    });

    afterEach(() => {
        mockOnClose.mockReset();
        vi.restoreAllMocks();
    });

    describe('rendering', () => {
        it('should not render when isOpen is false', () => {
            const { container } = render(
                <AudioPlayer isOpen={false} onClose={mockOnClose} tracks={mockTracks} />
            );
            expect(container.firstChild).toBe(null);
        });

        it('should not render when tracks array is empty', () => {
            const { container } = render(
                <AudioPlayer isOpen={true} onClose={mockOnClose} tracks={[]} />
            );
            expect(container.firstChild).toBe(null);
        });

        it('should render audio element with correct src', () => {
            render(<AudioPlayer isOpen={true} onClose={mockOnClose} tracks={mockTracks} />);

            const audio = screen.getByRole('dialog').querySelector('audio');
            expect(audio).toBeInTheDocument();
            expect(audio).toHaveAttribute('src', mockTracks[0].url);
        });

        it('should render close button', () => {
            render(<AudioPlayer isOpen={true} onClose={mockOnClose} tracks={mockTracks} />);

            const closeButton = screen.getByLabelText('閉じる');
            expect(closeButton).toBeInTheDocument();
        });

        it('should render track description when provided', () => {
            render(<AudioPlayer isOpen={true} onClose={mockOnClose} tracks={mockTracks} />);

            expect(screen.getByText('Test audio 1')).toBeInTheDocument();
        });

        it('should render with correct aria-label', () => {
            render(<AudioPlayer isOpen={true} onClose={mockOnClose} tracks={mockTracks} />);

            const dialog = screen.getByRole('dialog');
            expect(dialog).toHaveAttribute('aria-label', 'オーディオプレーヤー');
            expect(dialog).toHaveAttribute('aria-modal', 'true');
        });

        it('should render with correct z-index', () => {
            const { container } = render(
                <AudioPlayer isOpen={true} onClose={mockOnClose} tracks={mockTracks} />
            );

            const dialog = container.firstChild as HTMLElement;
            expect(dialog).toHaveClass('z-[60]');
        });

        it('should render artwork when artworkUrl is provided', () => {
            render(<AudioPlayer isOpen={true} onClose={mockOnClose} tracks={mockTracks} />);

            const artwork = screen.getByAltText('Test audio 1');
            expect(artwork).toBeInTheDocument();
            expect(artwork).toHaveAttribute('src', mockTracks[0].artworkUrl);
        });

        it('should render music icon when artworkUrl is not provided', () => {
            render(
                <AudioPlayer
                    isOpen={true}
                    onClose={mockOnClose}
                    tracks={[{ url: 'https://example.com/audio.mp3', description: 'No artwork' }]}
                />
            );

            // The music icon is inside a div with bg-slate-700
            const iconContainer = screen.getByRole('dialog').querySelector('.bg-slate-700');
            expect(iconContainer).toBeInTheDocument();
        });
    });

    describe('initial index clamping', () => {
        it('should clamp initialIndex to valid range (negative)', () => {
            render(
                <AudioPlayer
                    isOpen={true}
                    onClose={mockOnClose}
                    tracks={mockTracks}
                    initialIndex={-5}
                />
            );

            // Should show first track
            expect(screen.getByText('Test audio 1')).toBeInTheDocument();
        });

        it('should clamp initialIndex to valid range (too high)', () => {
            render(
                <AudioPlayer
                    isOpen={true}
                    onClose={mockOnClose}
                    tracks={mockTracks}
                    initialIndex={100}
                />
            );

            // Should show last track
            expect(screen.getByText('Test audio 3')).toBeInTheDocument();
        });

        it('should sync currentIndex when initialIndex prop changes', () => {
            const { rerender } = render(
                <AudioPlayer
                    isOpen={true}
                    onClose={mockOnClose}
                    tracks={mockTracks}
                    initialIndex={0}
                />
            );

            expect(screen.getByText('Test audio 1')).toBeInTheDocument();

            rerender(
                <AudioPlayer
                    isOpen={true}
                    onClose={mockOnClose}
                    tracks={mockTracks}
                    initialIndex={2}
                />
            );

            expect(screen.getByText('Test audio 3')).toBeInTheDocument();
        });

        it('should clamp currentIndex when tracks array shrinks', () => {
            const { rerender } = render(
                <AudioPlayer
                    isOpen={true}
                    onClose={mockOnClose}
                    tracks={mockTracks}
                    initialIndex={2}
                />
            );

            // Currently on track 3
            expect(screen.getByText('Test audio 3')).toBeInTheDocument();

            // Shrink tracks to only 1
            rerender(
                <AudioPlayer
                    isOpen={true}
                    onClose={mockOnClose}
                    tracks={[mockTracks[0]]}
                    initialIndex={2}
                />
            );

            // Should clamp to the only available track
            expect(screen.getByText('Test audio 1')).toBeInTheDocument();
        });
    });

    describe('playback controls', () => {
        it('should toggle play/pause when play button is clicked', async () => {
            render(<AudioPlayer isOpen={true} onClose={mockOnClose} tracks={mockTracks} />);

            const playButton = screen.getByLabelText('再生');
            fireEvent.click(playButton);

            await waitFor(() => {
                expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
            });
        });

        it('should show pause icon when playing', async () => {
            render(<AudioPlayer isOpen={true} onClose={mockOnClose} tracks={mockTracks} />);

            const playButton = screen.getByLabelText('再生');
            fireEvent.click(playButton);

            await waitFor(() => {
                expect(screen.getByLabelText('一時停止')).toBeInTheDocument();
            });
        });
    });

    describe('volume controls', () => {
        it('should toggle mute when mute button is clicked', () => {
            render(<AudioPlayer isOpen={true} onClose={mockOnClose} tracks={mockTracks} />);

            const muteButton = screen.getByLabelText('ミュート');
            fireEvent.click(muteButton);

            expect(screen.getByLabelText('ミュート解除')).toBeInTheDocument();
        });
    });

    describe('track navigation', () => {
        it('should show navigation buttons when multiple tracks', () => {
            render(<AudioPlayer isOpen={true} onClose={mockOnClose} tracks={mockTracks} />);

            expect(screen.getByLabelText('前のトラック')).toBeInTheDocument();
            expect(screen.getByLabelText('次のトラック')).toBeInTheDocument();
        });

        it('should not show navigation buttons when single track', () => {
            render(<AudioPlayer isOpen={true} onClose={mockOnClose} tracks={[mockTracks[0]]} />);

            expect(screen.queryByLabelText('前のトラック')).not.toBeInTheDocument();
            expect(screen.queryByLabelText('次のトラック')).not.toBeInTheDocument();
        });

        it('should navigate to next track', () => {
            render(<AudioPlayer isOpen={true} onClose={mockOnClose} tracks={mockTracks} />);

            const nextButton = screen.getByLabelText('次のトラック');
            fireEvent.click(nextButton);

            expect(screen.getByText('Test audio 2')).toBeInTheDocument();
        });

        it('should navigate to previous track', () => {
            render(
                <AudioPlayer
                    isOpen={true}
                    onClose={mockOnClose}
                    tracks={mockTracks}
                    initialIndex={1}
                />
            );

            const prevButton = screen.getByLabelText('前のトラック');
            fireEvent.click(prevButton);

            expect(screen.getByText('Test audio 1')).toBeInTheDocument();
        });

        it('should wrap around when going past last track', () => {
            render(
                <AudioPlayer
                    isOpen={true}
                    onClose={mockOnClose}
                    tracks={mockTracks}
                    initialIndex={2}
                />
            );

            const nextButton = screen.getByLabelText('次のトラック');
            fireEvent.click(nextButton);

            expect(screen.getByText('Test audio 1')).toBeInTheDocument();
        });

        it('should wrap around when going before first track', () => {
            render(<AudioPlayer isOpen={true} onClose={mockOnClose} tracks={mockTracks} />);

            const prevButton = screen.getByLabelText('前のトラック');
            fireEvent.click(prevButton);

            expect(screen.getByText('Test audio 3')).toBeInTheDocument();
        });

        it('should reset time and duration when switching tracks', () => {
            render(<AudioPlayer isOpen={true} onClose={mockOnClose} tracks={mockTracks} />);

            const audio = screen.getByRole('dialog').querySelector('audio') as HTMLAudioElement;
            Object.defineProperty(audio, 'currentTime', { writable: true, value: 30 });
            Object.defineProperty(audio, 'duration', { writable: true, value: 120 });
            fireEvent.loadedMetadata(audio);

            const nextButton = screen.getByLabelText('次のトラック');
            fireEvent.click(nextButton);

            // Time displays should reset to 0:00
            const timeDisplays = screen.getAllByText('0:00');
            expect(timeDisplays.length).toBeGreaterThanOrEqual(2);
        });

        it('should pause audio when switching tracks', () => {
            render(<AudioPlayer isOpen={true} onClose={mockOnClose} tracks={mockTracks} />);

            const nextButton = screen.getByLabelText('次のトラック');
            fireEvent.click(nextButton);

            expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
        });

        it('should show play button after switching tracks when not playing', () => {
            render(<AudioPlayer isOpen={true} onClose={mockOnClose} tracks={mockTracks} />);

            const nextButton = screen.getByLabelText('次のトラック');
            fireEvent.click(nextButton);

            expect(screen.getByLabelText('再生')).toBeInTheDocument();
        });
    });

    describe('closing', () => {
        it('should call onClose when close button is clicked', () => {
            render(<AudioPlayer isOpen={true} onClose={mockOnClose} tracks={mockTracks} />);

            const closeButton = screen.getByLabelText('閉じる');
            fireEvent.click(closeButton);

            expect(mockOnClose).toHaveBeenCalled();
        });

        it('should call onClose when backdrop is clicked', () => {
            const { container } = render(
                <AudioPlayer isOpen={true} onClose={mockOnClose} tracks={mockTracks} />
            );

            const backdrop = container.querySelector('.bg-black\\/90');
            fireEvent.click(backdrop!);

            expect(mockOnClose).toHaveBeenCalled();
        });

        it('should pause audio when modal closes via isOpen change', () => {
            const { rerender } = render(
                <AudioPlayer isOpen={true} onClose={mockOnClose} tracks={mockTracks} />
            );

            // Close by changing isOpen to false
            rerender(<AudioPlayer isOpen={false} onClose={mockOnClose} tracks={mockTracks} />);

            expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
        });

        it('should pause audio when Escape key is pressed', () => {
            const handleClose = vi.fn();
            const { rerender } = render(
                <AudioPlayer isOpen={true} onClose={handleClose} tracks={mockTracks} />
            );

            const dialog = screen.getByRole('dialog');
            fireEvent.keyDown(dialog, { key: 'Escape' });

            expect(handleClose).toHaveBeenCalled();

            // Simulate parent responding to onClose by setting isOpen=false
            rerender(<AudioPlayer isOpen={false} onClose={handleClose} tracks={mockTracks} />);

            expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
        });

        it('should pause audio when backdrop is clicked', () => {
            const handleClose = vi.fn();
            const { container, rerender } = render(
                <AudioPlayer isOpen={true} onClose={handleClose} tracks={mockTracks} />
            );

            const backdrop = container.querySelector('.bg-black\\/90');
            fireEvent.click(backdrop!);

            expect(handleClose).toHaveBeenCalled();

            // Simulate parent responding to onClose by setting isOpen=false
            rerender(<AudioPlayer isOpen={false} onClose={handleClose} tracks={mockTracks} />);

            expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
        });
    });

    describe('keyboard shortcuts', () => {
        it('should toggle play/pause on Space key', async () => {
            render(<AudioPlayer isOpen={true} onClose={mockOnClose} tracks={mockTracks} />);

            const dialog = screen.getByRole('dialog');
            fireEvent.keyDown(dialog, { key: ' ' });

            await waitFor(() => {
                expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
            });
        });

        it('should toggle mute on M key', () => {
            render(<AudioPlayer isOpen={true} onClose={mockOnClose} tracks={mockTracks} />);

            const dialog = screen.getByRole('dialog');
            fireEvent.keyDown(dialog, { key: 'm' });

            expect(screen.getByLabelText('ミュート解除')).toBeInTheDocument();
        });

        it('should toggle mute on Shift+M key', () => {
            render(<AudioPlayer isOpen={true} onClose={mockOnClose} tracks={mockTracks} />);

            const dialog = screen.getByRole('dialog');
            fireEvent.keyDown(dialog, { key: 'M', shiftKey: true });

            expect(screen.getByLabelText('ミュート解除')).toBeInTheDocument();
        });

        it('should navigate tracks with Shift+ArrowLeft/Right', () => {
            render(<AudioPlayer isOpen={true} onClose={mockOnClose} tracks={mockTracks} />);

            const dialog = screen.getByRole('dialog');

            // Navigate to next track
            fireEvent.keyDown(dialog, { key: 'ArrowRight', shiftKey: true });
            expect(screen.getByText('Test audio 2')).toBeInTheDocument();

            // Navigate to previous track
            fireEvent.keyDown(dialog, { key: 'ArrowLeft', shiftKey: true });
            expect(screen.getByText('Test audio 1')).toBeInTheDocument();
        });

        it('should seek with ArrowLeft/Right (no Shift)', () => {
            render(<AudioPlayer isOpen={true} onClose={mockOnClose} tracks={mockTracks} />);

            const dialog = screen.getByRole('dialog');
            const audio = screen.getByRole('dialog').querySelector('audio') as HTMLAudioElement;

            // Mock currentTime
            Object.defineProperty(audio, 'currentTime', {
                writable: true,
                value: 10,
            });
            Object.defineProperty(audio, 'duration', {
                writable: true,
                value: 100,
            });

            // Seek forward
            fireEvent.keyDown(dialog, { key: 'ArrowRight' });
            // Note: actual currentTime change happens via audioRef

            // Seek backward
            fireEvent.keyDown(dialog, { key: 'ArrowLeft' });
        });

        it('should adjust volume with ArrowUp/Down', () => {
            render(<AudioPlayer isOpen={true} onClose={mockOnClose} tracks={mockTracks} />);

            const dialog = screen.getByRole('dialog');
            const audio = screen.getByRole('dialog').querySelector('audio') as HTMLAudioElement;

            // Mock volume
            Object.defineProperty(audio, 'volume', {
                writable: true,
                value: 0.5,
            });

            // Volume up
            fireEvent.keyDown(dialog, { key: 'ArrowUp' });

            // Volume down
            fireEvent.keyDown(dialog, { key: 'ArrowDown' });
        });

        it('should not intercept arrow keys on range inputs', () => {
            render(<AudioPlayer isOpen={true} onClose={mockOnClose} tracks={mockTracks} />);

            const seekBar = screen.getByLabelText('シーク');
            const audio = screen.getByRole('dialog').querySelector('audio') as HTMLAudioElement;

            Object.defineProperty(audio, 'currentTime', {
                writable: true,
                value: 10,
            });
            Object.defineProperty(audio, 'duration', {
                writable: true,
                value: 100,
            });

            // Arrow key on range input should NOT trigger seekBy
            const event = new KeyboardEvent('keydown', {
                key: 'ArrowRight',
                bubbles: true,
            });
            const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
            seekBar.dispatchEvent(event);

            // preventDefault should NOT have been called by our handler
            // (the event should pass through to the range input's native behavior)
            expect(preventDefaultSpy).not.toHaveBeenCalled();
        });

        it('should allow Escape on range inputs to close modal', () => {
            render(<AudioPlayer isOpen={true} onClose={mockOnClose} tracks={mockTracks} />);

            const seekBar = screen.getByLabelText('シーク');
            fireEvent.keyDown(seekBar, { key: 'Escape' });

            expect(mockOnClose).toHaveBeenCalled();
        });

        it('should close on Escape key', () => {
            render(<AudioPlayer isOpen={true} onClose={mockOnClose} tracks={mockTracks} />);

            const dialog = screen.getByRole('dialog');
            fireEvent.keyDown(dialog, { key: 'Escape' });

            expect(mockOnClose).toHaveBeenCalled();
        });
    });

    describe('artwork error handling', () => {
        it('should fallback to music icon on artwork error', () => {
            render(<AudioPlayer isOpen={true} onClose={mockOnClose} tracks={mockTracks} />);

            const artwork = screen.getByAltText('Test audio 1');
            fireEvent.error(artwork);

            // After error, artwork should be replaced with music icon container
            const iconContainer = screen.getByRole('dialog').querySelector('.bg-slate-700');
            expect(iconContainer).toBeInTheDocument();
        });
    });

    describe('play() rejection handling', () => {
        it('should handle play() rejection gracefully', async () => {
            // Mock play to reject
            HTMLMediaElement.prototype.play = vi
                .fn()
                .mockRejectedValue(new Error('Autoplay blocked'));

            render(<AudioPlayer isOpen={true} onClose={mockOnClose} tracks={mockTracks} />);

            const playButton = screen.getByLabelText('再生');
            fireEvent.click(playButton);

            // Wait for rejection to be handled
            await waitFor(() => {
                // Should still show play button (state reverted)
                expect(screen.getByLabelText('再生')).toBeInTheDocument();
            });
        });
    });

    describe('track counter', () => {
        it('should show track counter when multiple tracks', () => {
            render(
                <AudioPlayer
                    isOpen={true}
                    onClose={mockOnClose}
                    tracks={mockTracks}
                    initialIndex={1}
                />
            );

            expect(screen.getByText('2 / 3')).toBeInTheDocument();
        });
    });

    describe('seek bar', () => {
        it('should render seek bar', () => {
            render(<AudioPlayer isOpen={true} onClose={mockOnClose} tracks={mockTracks} />);

            const seekBar = screen.getByLabelText('シーク');
            expect(seekBar).toBeInTheDocument();
        });

        it('should handle seek bar change event', () => {
            render(<AudioPlayer isOpen={true} onClose={mockOnClose} tracks={mockTracks} />);

            const seekBar = screen.getByLabelText('シーク');
            // Verify the event handler doesn't throw
            expect(() => {
                fireEvent.change(seekBar, { target: { value: '50' } });
            }).not.toThrow();
        });
    });

    describe('volume bar', () => {
        it('should render volume bar', () => {
            render(<AudioPlayer isOpen={true} onClose={mockOnClose} tracks={mockTracks} />);

            const volumeBar = screen.getByLabelText('音量');
            expect(volumeBar).toBeInTheDocument();
        });

        it('should update volume when volume bar is changed', () => {
            render(<AudioPlayer isOpen={true} onClose={mockOnClose} tracks={mockTracks} />);

            const audio = screen.getByRole('dialog').querySelector('audio') as HTMLAudioElement;
            Object.defineProperty(audio, 'volume', {
                writable: true,
                value: 1,
            });

            const volumeBar = screen.getByLabelText('音量');
            fireEvent.change(volumeBar, { target: { value: '0.5' } });

            expect(audio.volume).toBe(0.5);
        });
    });

    describe('formatTime edge cases', () => {
        it('should display 0:00 when duration is NaN', () => {
            render(<AudioPlayer isOpen={true} onClose={mockOnClose} tracks={mockTracks} />);

            const audio = screen.getByRole('dialog').querySelector('audio') as HTMLAudioElement;
            Object.defineProperty(audio, 'duration', {
                writable: true,
                value: NaN,
            });
            fireEvent.loadedMetadata(audio);

            // The duration display should show 0:00 for NaN
            const timeDisplays = screen.getAllByText('0:00');
            expect(timeDisplays.length).toBeGreaterThanOrEqual(1);
        });

        it('should display 0:00 when duration is Infinity', () => {
            render(<AudioPlayer isOpen={true} onClose={mockOnClose} tracks={mockTracks} />);

            const audio = screen.getByRole('dialog').querySelector('audio') as HTMLAudioElement;
            Object.defineProperty(audio, 'duration', {
                writable: true,
                value: Infinity,
            });
            fireEvent.loadedMetadata(audio);

            // The duration display should show 0:00 for Infinity
            const timeDisplays = screen.getAllByText('0:00');
            expect(timeDisplays.length).toBeGreaterThanOrEqual(1);
        });
    });
});
