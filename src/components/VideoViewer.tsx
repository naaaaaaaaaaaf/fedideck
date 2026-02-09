import { useState, useRef, useCallback, useEffect } from 'react';
import { LuX } from 'react-icons/lu';
import { useModalAccessibility } from '../hooks/useModalAccessibility';

export interface VideoViewerVideo {
    url: string;
    previewUrl?: string;
    description?: string;
    type: 'video' | 'gifv';
}

export interface VideoViewerProps {
    isOpen: boolean;
    onClose: () => void;
    videos: VideoViewerVideo[];
    initialIndex?: number;
}

export function VideoViewer({ isOpen, onClose, videos, initialIndex = 0 }: VideoViewerProps) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const modalRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const videoContainerRef = useRef<HTMLDivElement>(null);
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

    // Handle keyboard navigation
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            // Delegate other keys to base handler (ESC, Tab)
            baseHandleKeyDown(e);
        },
        [baseHandleKeyDown]
    );

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

                {/* Video container */}
                <div
                    ref={videoContainerRef}
                    className="flex flex-col items-center justify-center max-w-full max-h-[calc(100vh-8rem)]"
                >
                    <video
                        ref={videoRef}
                        src={currentVideo?.url}
                        poster={currentVideo?.previewUrl}
                        aria-label={currentVideo?.description ?? '動画'}
                        className="max-w-full max-h-[calc(100vh-12rem)] object-contain"
                    />

                    {/* Video description */}
                    {currentVideo?.description && (
                        <div className="mt-4 text-slate-300 text-sm text-center max-w-2xl px-4">
                            {currentVideo.description}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
