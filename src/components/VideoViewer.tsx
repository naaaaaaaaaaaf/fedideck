import { useState, useRef, useCallback, useEffect } from 'react';
import {
    LuX,
    LuPlay,
    LuPause,
    LuVolume,
    LuVolumeX,
    LuMaximize,
    LuMinimize,
    LuChevronLeft,
    LuChevronRight,
} from 'react-icons/lu';
import { useModalAccessibility } from '../hooks/useModalAccessibility';
import type { VideoViewerVideo } from '../types/video';

export interface VideoViewerProps {
    isOpen: boolean;
    onClose: () => void;
    videos: VideoViewerVideo[];
    initialIndex?: number;
    zIndex?: number;
}

export function VideoViewer({
    isOpen,
    onClose,
    videos,
    initialIndex = 0,
    zIndex,
}: VideoViewerProps) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    // Initialize isMuted based on initial video type to prevent unmuted flash for gifv
    // Use lazy initial state to compute from videos[initialIndex] on first render
    const [isMuted, setIsMuted] = useState(() => {
        const initialVideo = videos[initialIndex];
        return initialVideo?.type === 'gifv';
    });
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const modalRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const videoContainerRef = useRef<HTMLDivElement>(null);
    const videoWrapperRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

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

    // Clamp currentIndex to valid range to prevent out-of-bounds access
    const safeIndex =
        videos.length > 0 ? Math.max(0, Math.min(currentIndex, videos.length - 1)) : 0;
    const currentVideo = videos[safeIndex];

    // Sync currentIndex to safeIndex when it diverges (e.g., initialIndex out of bounds,
    // videos array shrinks while open). This ensures navigation always advances from
    // the currently displayed item.
    useEffect(() => {
        if (currentIndex !== safeIndex) {
            setCurrentIndex(safeIndex);
        }
    }, [currentIndex, safeIndex]);

    // Initialize mute state based on initial video type (gifv should be muted by default)
    useEffect(() => {
        if (currentVideo?.type === 'gifv') {
            setIsMuted(true);
        } else if (currentVideo?.type === 'video') {
            // Regular videos should not be muted by default (unmute when leaving gifv)
            setIsMuted(false);
        }
    }, [currentVideo?.type]);

    // Check if there are multiple videos
    const hasMultipleVideos = videos.length > 1;

    // Navigate to previous video
    const goToPrevious = useCallback(() => {
        setCurrentIndex((prev) => (prev > 0 ? prev - 1 : videos.length - 1));
    }, [videos.length]);

    // Navigate to next video
    const goToNext = useCallback(() => {
        setCurrentIndex((prev) => (prev < videos.length - 1 ? prev + 1 : 0));
    }, [videos.length]);

    // Toggle play/pause
    const togglePlayPause = useCallback(() => {
        if (!videoRef.current) return;

        if (isPlaying) {
            videoRef.current.pause();
        } else {
            // Handle play() promise to catch autoplay/user-gesture restrictions
            const playPromise = videoRef.current.play();
            // play() may not return a Promise in some test environments
            if (playPromise && typeof playPromise.catch === 'function') {
                playPromise.catch((err) => {
                    // Revert isPlaying state on failure
                    setIsPlaying(false);
                    console.error('Failed to play video:', err);
                });
            }
        }
    }, [isPlaying]);

    // Adjust volume with arrow keys
    const adjustVolume = useCallback(
        (delta: number) => {
            if (!videoRef.current) return;
            const newVolume = Math.max(0, Math.min(1, volume + delta));
            videoRef.current.volume = newVolume;
            videoRef.current.muted = newVolume === 0;
            setVolume(newVolume);
            setIsMuted(newVolume === 0);
        },
        [volume]
    );

    // Toggle fullscreen
    const toggleFullscreen = useCallback(() => {
        if (!videoWrapperRef.current) return;

        // Check if Fullscreen API is supported
        if (!document.fullscreenEnabled || !videoWrapperRef.current.requestFullscreen) {
            console.warn('Fullscreen API is not supported in this environment');
            return;
        }

        try {
            if (!document.fullscreenElement) {
                const requestPromise = videoWrapperRef.current.requestFullscreen();
                // Handle promise rejection (e.g., user denies fullscreen)
                if (requestPromise && typeof requestPromise.catch === 'function') {
                    requestPromise.catch((err) => {
                        console.error('Failed to enter fullscreen:', err);
                    });
                }
            } else {
                const exitPromise = document.exitFullscreen();
                // Handle promise rejection
                if (exitPromise && typeof exitPromise.catch === 'function') {
                    exitPromise.catch((err) => {
                        console.error('Failed to exit fullscreen:', err);
                    });
                }
            }
        } catch (err) {
            console.error('Fullscreen toggle error:', err);
        }
    }, []);

    // Handle keyboard navigation
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            const target = e.target as HTMLElement;

            // Special handling for interactive elements
            const isInteractiveElement =
                target.tagName === 'INPUT' ||
                target.tagName === 'BUTTON' ||
                target.isContentEditable;

            if (isInteractiveElement) {
                // For range inputs, allow only Tab/ESC for focus trap
                // For other inputs and contentEditable, also allow Tab/ESC
                // For buttons, allow Tab/ESC and other shortcuts (except Space)
                if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'range') {
                    if (e.key === 'Escape' || e.key === 'Tab') {
                        baseHandleKeyDown(e);
                    }
                    // Arrow keys on range input should not be intercepted for video controls
                    return;
                }

                // For contentEditable elements and text inputs, only allow Tab/ESC
                if (
                    target.isContentEditable ||
                    (target.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'range')
                ) {
                    if (e.key === 'Escape' || e.key === 'Tab') {
                        baseHandleKeyDown(e);
                    }
                    return;
                }

                // For buttons: delegate Tab/ESC, allow other shortcuts except Space
                if (target.tagName === 'BUTTON') {
                    if (e.key === 'Escape' || e.key === 'Tab') {
                        baseHandleKeyDown(e);
                        return;
                    }
                    // Don't intercept Space on buttons (activates the button)
                    // But allow other shortcuts to pass through
                    if (e.key === ' ') {
                        return;
                    }
                    // Continue to handle other keys (f, arrows, etc.)
                }
            }

            // Handle Space key for play/pause
            if (e.key === ' ') {
                e.preventDefault();
                togglePlayPause();
                return;
            }

            // Handle f key for fullscreen
            if (e.key === 'f' || e.key === 'F') {
                e.preventDefault();
                toggleFullscreen();
                return;
            }

            // Handle arrow keys for video navigation (when multiple videos)
            if (hasMultipleVideos) {
                if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    goToPrevious();
                    return;
                }
                if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    goToNext();
                    return;
                }
            }

            // Handle arrow keys for volume adjustment
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

            // Delegate other keys to base handler (ESC, Tab)
            baseHandleKeyDown(e);
        },
        [
            baseHandleKeyDown,
            hasMultipleVideos,
            goToPrevious,
            goToNext,
            togglePlayPause,
            toggleFullscreen,
            adjustVolume,
        ]
    );

    // Handle seek
    const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const time = parseFloat(e.target.value);
        if (videoRef.current) {
            videoRef.current.currentTime = time;
            setCurrentTime(time);
        }
    }, []);

    // Toggle mute
    const toggleMute = useCallback(() => {
        if (!videoRef.current) return;

        if (isMuted) {
            videoRef.current.muted = false;
            setIsMuted(false);
            if (videoRef.current.volume === 0) {
                videoRef.current.volume = 1;
                setVolume(1);
            }
        } else {
            videoRef.current.muted = true;
            setIsMuted(true);
        }
    }, [isMuted]);

    // Handle volume change
    const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseFloat(e.target.value);
        if (videoRef.current) {
            videoRef.current.volume = newVolume;
            videoRef.current.muted = newVolume === 0;
            setVolume(newVolume);
            setIsMuted(newVolume === 0);
        }
    }, []);

    // Handle fullscreen change
    useEffect(() => {
        // Guard: only register listener while modal is open
        // VideoViewer returns null when closed but stays mounted,
        // so we need to avoid registering listeners while closed
        if (!isOpen) return;

        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, [isOpen]);

    // Auto-hide controls when playing
    const resetControlsTimeout = useCallback(() => {
        if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current);
        }

        if (isPlaying) {
            setShowControls(true);
            controlsTimeoutRef.current = setTimeout(() => {
                setShowControls(false);
            }, 3000);
        } else {
            setShowControls(true);
        }
    }, [isPlaying]);

    useEffect(() => {
        resetControlsTimeout();
        return () => {
            if (controlsTimeoutRef.current) {
                clearTimeout(controlsTimeoutRef.current);
            }
        };
    }, [isPlaying, resetControlsTimeout]);

    // Show controls on mouse movement, touch interaction, or focus
    const handleMouseMove = useCallback(() => {
        resetControlsTimeout();
    }, [resetControlsTimeout]);

    const handleTouchStart = useCallback(() => {
        resetControlsTimeout();
    }, [resetControlsTimeout]);

    const handleControlsFocus = useCallback(() => {
        setShowControls(true);
        // Clear timeout to prevent hiding while focused
        if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current);
            controlsTimeoutRef.current = null;
        }
    }, []);

    const handleControlsBlur = useCallback(() => {
        resetControlsTimeout();
    }, [resetControlsTimeout]);

    // Format time for display (MM:SS)
    const formatTime = (time: number): string => {
        if (isNaN(time)) return '0:00';
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    // Video event handlers
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);
        const handleTimeUpdate = () => setCurrentTime(video.currentTime);
        const handleLoadedMetadata = () => setDuration(video.duration);
        const handleEnded = () => setIsPlaying(false);

        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);
        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        video.addEventListener('ended', handleEnded);

        return () => {
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            video.removeEventListener('ended', handleEnded);
        };
        // Re-attach event listeners when video source changes
    }, [currentVideo?.url]);

    // Pause video when navigating to a different video
    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.pause();
        }
        setIsPlaying(false);
        // Reset time display when changing videos
        setCurrentTime(0);
        setDuration(0);

        // Sync mute state with video type (gifv should be muted by default)
        if (currentVideo?.type === 'gifv') {
            setIsMuted(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [safeIndex]);

    // Pause video and reset state when modal closes
    useEffect(() => {
        if (!isOpen) {
            // Pause playback when modal is closed
            if (videoRef.current) {
                videoRef.current.pause();
            }
            setIsPlaying(false);
            // Clear controls timeout to prevent state updates after close
            if (controlsTimeoutRef.current) {
                clearTimeout(controlsTimeoutRef.current);
                controlsTimeoutRef.current = null;
            }
            // Exit fullscreen if active when modal is closed
            if (document.fullscreenElement) {
                const exitPromise = document.exitFullscreen();
                if (exitPromise && typeof exitPromise.catch === 'function') {
                    exitPromise.catch((err) => {
                        // Ignore errors from exiting fullscreen (element may already be removed)
                        console.debug('Fullscreen exit error:', err);
                    });
                }
            }
        }
    }, [isOpen]);

    // Handle backdrop click
    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const handleContentClick = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            const target = e.target as Node;
            if (videoContainerRef.current?.contains(target)) {
                return;
            }

            const targetElement = e.target as HTMLElement | null;
            if (targetElement?.closest('button')) {
                return;
            }

            onClose();
        },
        [onClose]
    );

    if (!isOpen || videos.length === 0) return null;

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center"
            style={zIndex != null ? { zIndex } : undefined}
            onKeyDown={handleKeyDown}
            role="dialog"
            aria-modal="true"
            aria-label="動画ビューアー"
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
                className="relative flex flex-col items-center justify-center w-full h-full p-4"
                onClick={handleContentClick}
                data-testid="video-viewer-content"
            >
                {/* Close button */}
                <button
                    ref={closeButtonRef}
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 bg-slate-800/80 hover:bg-slate-700 rounded-lg transition-colors text-slate-300 hover:text-white z-10"
                    aria-label="閉じる"
                >
                    <LuX className="w-6 h-6" aria-hidden="true" />
                </button>

                {/* Navigation - Previous */}
                {hasMultipleVideos && (
                    <button
                        onClick={goToPrevious}
                        className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-slate-800/80 hover:bg-slate-700 rounded-full transition-colors text-slate-300 hover:text-white z-10"
                        aria-label="前の動画"
                    >
                        <LuChevronLeft className="w-8 h-8" aria-hidden="true" />
                    </button>
                )}

                {/* Navigation - Next */}
                {hasMultipleVideos && (
                    <button
                        onClick={goToNext}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-slate-800/80 hover:bg-slate-700 rounded-full transition-colors text-slate-300 hover:text-white z-10"
                        aria-label="次の動画"
                    >
                        <LuChevronRight className="w-8 h-8" aria-hidden="true" />
                    </button>
                )}

                {/* Video container */}
                <div
                    ref={videoContainerRef}
                    className="flex flex-col items-center justify-center max-w-full max-h-[calc(100vh-8rem)]"
                >
                    <div
                        ref={videoWrapperRef}
                        className="relative"
                        onMouseMove={handleMouseMove}
                        onTouchStart={handleTouchStart}
                        onPointerMove={handleMouseMove}
                    >
                        <video
                            ref={videoRef}
                            src={currentVideo?.url}
                            poster={currentVideo?.previewUrl}
                            loop={currentVideo?.type === 'gifv'}
                            muted={isMuted}
                            playsInline
                            aria-label={currentVideo?.description ?? '動画'}
                            className="max-w-full max-h-[calc(100vh-12rem)] object-contain"
                        />

                        {/* Video controls overlay */}
                        {showControls && (
                            <div
                                className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity duration-300 opacity-100"
                                onFocus={handleControlsFocus}
                                onBlur={handleControlsBlur}
                            >
                                <div className="flex items-center gap-3">
                                    {/* Play/Pause button */}
                                    <button
                                        onClick={togglePlayPause}
                                        className="p-2 hover:bg-white/20 rounded-full transition-colors text-white"
                                        aria-label={isPlaying ? '一時停止' : '再生'}
                                    >
                                        {isPlaying ? (
                                            <LuPause className="w-5 h-5" aria-hidden="true" />
                                        ) : (
                                            <LuPlay className="w-5 h-5" aria-hidden="true" />
                                        )}
                                    </button>

                                    {/* Time display */}
                                    <span className="text-white text-sm tabular-nums">
                                        {formatTime(currentTime)} / {formatTime(duration)}
                                    </span>

                                    {/* Seek bar */}
                                    <input
                                        type="range"
                                        min="0"
                                        max={duration || 0}
                                        value={currentTime}
                                        onChange={handleSeek}
                                        className="flex-1 h-1 bg-white/30 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
                                        aria-label="シーク"
                                    />

                                    {/* Volume control */}
                                    <button
                                        onClick={toggleMute}
                                        className="p-2 hover:bg-white/20 rounded-full transition-colors text-white"
                                        aria-label={isMuted ? 'ミュート解除' : 'ミュート'}
                                    >
                                        {isMuted || volume === 0 ? (
                                            <LuVolumeX className="w-5 h-5" aria-hidden="true" />
                                        ) : (
                                            <LuVolume className="w-5 h-5" aria-hidden="true" />
                                        )}
                                    </button>

                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.1"
                                        value={isMuted ? 0 : volume}
                                        onChange={handleVolumeChange}
                                        className="w-20 h-1 bg-white/30 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
                                        aria-label="音量"
                                    />

                                    {/* Fullscreen button */}
                                    <button
                                        onClick={toggleFullscreen}
                                        className="p-2 hover:bg-white/20 rounded-full transition-colors text-white"
                                        aria-label={isFullscreen ? '全画面解除' : '全画面表示'}
                                    >
                                        {isFullscreen ? (
                                            <LuMinimize className="w-5 h-5" aria-hidden="true" />
                                        ) : (
                                            <LuMaximize className="w-5 h-5" aria-hidden="true" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Video description */}
                    {currentVideo?.description && (
                        <div className="mt-4 text-slate-300 text-sm text-center max-w-2xl px-4">
                            {currentVideo.description}
                        </div>
                    )}

                    {/* Video counter */}
                    {hasMultipleVideos && (
                        <div className="mt-4 text-slate-300 text-sm">
                            {safeIndex + 1} / {videos.length}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
