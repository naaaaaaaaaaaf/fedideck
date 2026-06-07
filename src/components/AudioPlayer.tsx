import { useState, useRef, useCallback, useEffect } from 'react';
import { LuX, LuMusic } from 'react-icons/lu';
import { useModalAccessibility } from '../hooks/useModalAccessibility';
import type { AudioViewerTrack } from '../types/audio';

export interface AudioPlayerProps {
    isOpen: boolean;
    onClose: () => void;
    tracks: AudioViewerTrack[];
    initialIndex?: number;
    /** Whether this modal is the active (top-most) overlay */
    isActive?: boolean;
    zIndex?: number;
}

/**
 * Audio player modal component for audio attachments.
 * Provides playback controls, artwork display, and multi-track navigation.
 */
export function AudioPlayer({
    isOpen,
    onClose,
    tracks,
    initialIndex = 0,
    isActive = true,
    zIndex,
}: AudioPlayerProps) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [artworkError, setArtworkError] = useState(false);

    const modalRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const rafRef = useRef<number | null>(null);
    const wasPlayingRef = useRef(false);

    const { handleKeyDown: baseHandleKeyDown } = useModalAccessibility({
        isOpen,
        onClose,
        closeButtonRef,
        modalRef,
    });

    // Update currentIndex when initialIndex changes
    useEffect(() => {
        setCurrentIndex(initialIndex);
    }, [initialIndex]);

    const hasMultipleTracks = tracks.length > 1;
    const safeIndex =
        tracks.length > 0 ? Math.max(0, Math.min(currentIndex, tracks.length - 1)) : 0;
    const currentTrack = tracks[safeIndex];

    // Sync currentIndex to safeIndex when it diverges (e.g., initialIndex out of bounds,
    // tracks array shrinks)
    useEffect(() => {
        if (currentIndex !== safeIndex) {
            setCurrentIndex(safeIndex);
        }
    }, [currentIndex, safeIndex]);

    // Reset playback state when track changes
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const wasPlaying = wasPlayingRef.current;
        wasPlayingRef.current = false; // Reset after reading
        audio.pause();
        setCurrentTime(0);
        setDuration(0);
        setArtworkError(false);

        // If was playing before track switch, auto-play the new track
        if (wasPlaying) {
            // Wait for the new src to load before playing
            const handleCanPlay = () => {
                const playPromise = audio.play();
                if (playPromise && typeof playPromise.catch === 'function') {
                    playPromise.catch(() => setIsPlaying(false));
                }
                audio.removeEventListener('canplay', handleCanPlay);
            };
            audio.addEventListener('canplay', handleCanPlay);
            return () => audio.removeEventListener('canplay', handleCanPlay);
        } else {
            setIsPlaying(false);
        }
    }, [safeIndex]);

    // Navigation callbacks
    const goToPrevious = useCallback(() => {
        wasPlayingRef.current = audioRef.current ? !audioRef.current.paused : false;
        setCurrentIndex((prev) => (prev > 0 ? prev - 1 : tracks.length - 1));
    }, [tracks.length]);

    const goToNext = useCallback(() => {
        wasPlayingRef.current = audioRef.current ? !audioRef.current.paused : false;
        setCurrentIndex((prev) => (prev < tracks.length - 1 ? prev + 1 : 0));
    }, [tracks.length]);

    // Playback controls
    const togglePlayPause = useCallback(() => {
        if (!audioRef.current) return;

        if (isPlaying) {
            audioRef.current.pause();
        } else {
            const playPromise = audioRef.current.play();
            if (playPromise && typeof playPromise.catch === 'function') {
                playPromise.catch(() => {
                    setIsPlaying(false);
                });
            }
        }
        setIsPlaying(!isPlaying);
    }, [isPlaying]);

    const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (!audioRef.current) return;
        const time = parseFloat(e.target.value);
        audioRef.current.currentTime = time;
        setCurrentTime(time);
    }, []);

    const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (!audioRef.current) return;
        const vol = parseFloat(e.target.value);
        audioRef.current.volume = vol;
        audioRef.current.muted = false;
        setIsMuted(vol === 0);
        if (vol > 0) {
            setVolume(vol);
        }
    }, []);

    const toggleMute = useCallback(() => {
        if (!audioRef.current) return;
        const newMuted = !isMuted;
        audioRef.current.muted = newMuted;
        if (!newMuted) {
            // Restore to saved volume (or default 0.5 if volume was never set above 0)
            const restoreVol = volume > 0 ? volume : 0.5;
            audioRef.current.volume = restoreVol;
            setVolume(restoreVol);
        }
        setIsMuted(newMuted);
    }, [isMuted, volume]);

    const seekBy = useCallback((seconds: number) => {
        if (!audioRef.current) return;
        const newTime = Math.max(
            0,
            Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + seconds)
        );
        audioRef.current.currentTime = newTime;
        setCurrentTime(newTime);
    }, []);

    const adjustVolume = useCallback(
        (delta: number) => {
            if (!audioRef.current) return;
            const baseVolume = isMuted ? 0 : volume;
            const newVolume = Math.max(0, Math.min(1, baseVolume + delta));
            audioRef.current.volume = newVolume;
            audioRef.current.muted = false;
            setIsMuted(newVolume === 0);
            if (newVolume > 0) {
                setVolume(newVolume);
            }
        },
        [volume, isMuted]
    );

    // Format time as MM:SS
    const formatTime = (time: number): string => {
        if (!isFinite(time) || isNaN(time) || time < 0) return '0:00';
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    // Keyboard shortcuts
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            const target = e.target as HTMLElement;

            // Special handling for interactive elements
            const isInteractiveElement =
                target.tagName === 'INPUT' ||
                target.tagName === 'BUTTON' ||
                target.isContentEditable;

            if (isInteractiveElement) {
                // For range inputs, allow only Tab/Escape for focus trap
                if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'range') {
                    if (e.key === 'Escape' || e.key === 'Tab') {
                        baseHandleKeyDown(e);
                    }
                    return;
                }

                // For buttons: delegate Tab/Escape, allow other shortcuts except Space
                if (target.tagName === 'BUTTON') {
                    if (e.key === 'Escape' || e.key === 'Tab') {
                        baseHandleKeyDown(e);
                        return;
                    }
                    if (e.key === ' ') return;
                }
            }

            // Space: play/pause
            if (e.key === ' ') {
                e.preventDefault();
                togglePlayPause();
                return;
            }

            // M: mute toggle
            if (e.key === 'm' || e.key === 'M') {
                e.preventDefault();
                toggleMute();
                return;
            }

            // Shift + Arrow Left/Right: track navigation
            if (e.shiftKey && e.key === 'ArrowLeft') {
                e.preventDefault();
                goToPrevious();
                return;
            }
            if (e.shiftKey && e.key === 'ArrowRight') {
                e.preventDefault();
                goToNext();
                return;
            }

            // Arrow Left/Right: ±5秒シーク
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                seekBy(-5);
                return;
            }
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                seekBy(5);
                return;
            }

            // Arrow Up/Down: 音量調整
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                adjustVolume(0.1);
                return;
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                adjustVolume(-0.1);
                return;
            }

            baseHandleKeyDown(e);
        },
        [
            togglePlayPause,
            toggleMute,
            goToPrevious,
            goToNext,
            seekBy,
            adjustVolume,
            baseHandleKeyDown,
        ]
    );

    // Handle backdrop click
    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    // Audio event handlers
    const handleTimeUpdate = useCallback(() => {
        if (rafRef.current !== null) return; // Already scheduled

        rafRef.current = requestAnimationFrame(() => {
            if (audioRef.current) {
                setCurrentTime(audioRef.current.currentTime);
            }
            rafRef.current = null;
        });
    }, []);

    const handleLoadedMetadata = useCallback(() => {
        if (audioRef.current) {
            setDuration(audioRef.current.duration);
        }
    }, []);

    const handleEnded = useCallback(() => {
        setIsPlaying(false);
        if (hasMultipleTracks) {
            goToNext();
        }
    }, [hasMultipleTracks, goToNext]);

    // Pause audio and cancel animation frame when modal closes.
    // Captures audio/raf refs in closure so cleanup works even after unmount.
    useEffect(() => {
        if (isOpen) {
            const audio = audioRef.current;
            const getRaf = () => rafRef.current;
            return () => {
                if (audio) {
                    audio.pause();
                }
                const raf = getRaf();
                if (raf !== null) {
                    cancelAnimationFrame(raf);
                    rafRef.current = null;
                }
            };
        }
    }, [isOpen]);

    if (!isOpen || tracks.length === 0) return null;

    return (
        <div
            className="fixed inset-0 flex items-center justify-center"
            style={zIndex != null ? { zIndex } : undefined}
            onKeyDown={isActive ? handleKeyDown : undefined}
            role="dialog"
            aria-modal={isActive ? 'true' : undefined}
            aria-label="オーディオプレーヤー"
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/90"
                onClick={handleBackdropClick}
                aria-hidden="true"
            />

            {/* Modal content */}
            <div
                ref={modalRef}
                className="relative bg-slate-800 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl"
                data-testid="audio-player-content"
            >
                {/* Close button */}
                <button
                    ref={closeButtonRef}
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 bg-slate-700/80 hover:bg-slate-600 rounded-lg transition-colors text-slate-300 hover:text-white"
                    aria-label="閉じる"
                >
                    <LuX className="w-6 h-6" aria-hidden="true" />
                </button>

                {/* Hidden audio element */}
                <audio
                    ref={audioRef}
                    src={currentTrack?.url}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    onEnded={handleEnded}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                />

                {/* Artwork */}
                <div className="flex justify-center mb-4">
                    {currentTrack?.artworkUrl && !artworkError ? (
                        <img
                            src={currentTrack.artworkUrl}
                            alt={currentTrack.description ?? 'アルバムアート'}
                            className="w-[280px] h-[280px] object-cover rounded-lg shadow-lg"
                            onError={() => setArtworkError(true)}
                        />
                    ) : (
                        <div className="w-[280px] h-[280px] bg-slate-700 rounded-lg shadow-lg flex items-center justify-center">
                            <LuMusic className="w-24 h-24 text-slate-500" aria-hidden="true" />
                        </div>
                    )}
                </div>

                {/* Track description */}
                {currentTrack?.description && (
                    <div className="mb-4 text-center text-slate-300 text-sm">
                        {currentTrack.description}
                    </div>
                )}

                {/* Playback controls */}
                <div className="space-y-4">
                    {/* Seek bar */}
                    <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-xs w-12 text-right">
                            {formatTime(currentTime)}
                        </span>
                        <input
                            type="range"
                            min="0"
                            max={Number.isFinite(duration) ? duration : 0}
                            value={Math.min(currentTime, Number.isFinite(duration) ? duration : 0)}
                            onChange={handleSeek}
                            className="flex-1 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                            aria-label="シーク"
                        />
                        <span className="text-slate-400 text-xs w-12">{formatTime(duration)}</span>
                    </div>

                    {/* Play/Pause and Volume */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={togglePlayPause}
                                className="p-3 bg-blue-600 hover:bg-blue-500 rounded-full transition-colors text-white"
                                aria-label={isPlaying ? '一時停止' : '再生'}
                            >
                                {isPlaying ? (
                                    <svg
                                        className="w-6 h-6"
                                        fill="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <rect x="6" y="4" width="4" height="16" />
                                        <rect x="14" y="4" width="4" height="16" />
                                    </svg>
                                ) : (
                                    <svg
                                        className="w-6 h-6"
                                        fill="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <polygon points="5,3 19,12 5,21" />
                                    </svg>
                                )}
                            </button>
                        </div>

                        {/* Volume control */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={toggleMute}
                                className="p-2 text-slate-400 hover:text-white transition-colors"
                                aria-label={isMuted ? 'ミュート解除' : 'ミュート'}
                            >
                                {isMuted || volume === 0 ? (
                                    <svg
                                        className="w-5 h-5"
                                        fill="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                                    </svg>
                                ) : (
                                    <svg
                                        className="w-5 h-5"
                                        fill="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                                    </svg>
                                )}
                            </button>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.1"
                                value={isMuted ? 0 : volume}
                                onChange={handleVolumeChange}
                                className="w-20 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                                aria-label="音量"
                            />
                        </div>
                    </div>

                    {/* Track navigation */}
                    {hasMultipleTracks && (
                        <div className="flex items-center justify-center gap-4">
                            <button
                                onClick={goToPrevious}
                                className="p-2 text-slate-400 hover:text-white transition-colors"
                                aria-label="前のトラック"
                            >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <polygon
                                        points="6,6 6,18 18,12"
                                        transform="rotate(180 12 12)"
                                    />
                                </svg>
                            </button>
                            <span className="text-slate-400 text-sm">
                                {safeIndex + 1} / {tracks.length}
                            </span>
                            <button
                                onClick={goToNext}
                                className="p-2 text-slate-400 hover:text-white transition-colors"
                                aria-label="次のトラック"
                            >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <polygon points="6,6 6,18 18,12" />
                                </svg>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
