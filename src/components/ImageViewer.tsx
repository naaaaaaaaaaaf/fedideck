import { useState, useRef, useCallback } from 'react';
import { LuX, LuChevronLeft, LuChevronRight } from 'react-icons/lu';
import { useModalAccessibility } from '../hooks/useModalAccessibility';

export interface ImageViewerImage {
    url: string;
    previewUrl?: string;
    description?: string;
}

export interface ImageViewerProps {
    isOpen: boolean;
    onClose: () => void;
    images: ImageViewerImage[];
    initialIndex?: number;
    zIndex?: number;
}

export function ImageViewer({
    isOpen,
    onClose,
    images,
    initialIndex = 0,
    zIndex,
}: ImageViewerProps) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const modalRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const imageContainerRef = useRef<HTMLDivElement>(null);

    const { handleKeyDown: baseHandleKeyDown } = useModalAccessibility({
        isOpen,
        onClose,
        closeButtonRef,
        modalRef,
    });

    const hasMultipleImages = images.length > 1;
    // Clamp currentIndex to valid range to prevent out-of-bounds access
    // This handles cases where images array changes while viewer is open
    const safeIndex =
        images.length > 0 ? Math.max(0, Math.min(currentIndex, images.length - 1)) : 0;
    const currentImage = images[safeIndex];

    const goToPrevious = useCallback(() => {
        setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
    }, [images.length]);

    const goToNext = useCallback(() => {
        setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
    }, [images.length]);

    // Handle keyboard navigation (arrows for image navigation)
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            // Handle arrow keys for image navigation
            if (hasMultipleImages) {
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

            // Delegate other keys to base handler (ESC, Tab)
            baseHandleKeyDown(e);
        },
        [hasMultipleImages, goToPrevious, goToNext, baseHandleKeyDown]
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
            if (imageContainerRef.current?.contains(target)) {
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

    if (!isOpen || images.length === 0) return null;

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center"
            style={zIndex != null ? { zIndex } : undefined}
            onKeyDown={handleKeyDown}
            role="dialog"
            aria-modal="true"
            aria-label="画像ビューアー"
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
                data-testid="image-viewer-content"
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
                {hasMultipleImages && (
                    <button
                        onClick={goToPrevious}
                        className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-slate-800/80 hover:bg-slate-700 rounded-full transition-colors text-slate-300 hover:text-white z-10"
                        aria-label="前の画像"
                    >
                        <LuChevronLeft className="w-8 h-8" aria-hidden="true" />
                    </button>
                )}

                {/* Navigation - Next */}
                {hasMultipleImages && (
                    <button
                        onClick={goToNext}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-slate-800/80 hover:bg-slate-700 rounded-full transition-colors text-slate-300 hover:text-white z-10"
                        aria-label="次の画像"
                    >
                        <LuChevronRight className="w-8 h-8" aria-hidden="true" />
                    </button>
                )}

                {/* Image container */}
                <div
                    ref={imageContainerRef}
                    className="flex flex-col items-center justify-center max-w-full max-h-[calc(100vh-8rem)]"
                >
                    <img
                        src={currentImage?.url}
                        alt={currentImage?.description ?? ''}
                        className="max-w-full max-h-[calc(100vh-12rem)] object-contain"
                    />

                    {/* Image counter */}
                    {hasMultipleImages && (
                        <div className="mt-4 text-slate-300 text-sm">
                            {safeIndex + 1} / {images.length}
                        </div>
                    )}

                    {/* Image description */}
                    {currentImage?.description && (
                        <div className="mt-2 text-slate-400 text-sm text-center max-w-2xl px-4">
                            {currentImage.description}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
