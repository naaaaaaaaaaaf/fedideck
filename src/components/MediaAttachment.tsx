import type { mastodon } from 'masto';

export interface MediaAttachmentProps {
    media: mastodon.v1.MediaAttachment;
    variant?: 'compact' | 'card' | 'detail';
    isSensitive: boolean;
    nsfwRevealed: boolean;
    onNsfwToggle?: () => void;
    onImageClick?: () => void;
    imageIndex?: number;
    totalImages?: number;
    className?: string;
}

export function MediaAttachment({
    media,
    variant = 'card',
    isSensitive,
    nsfwRevealed,
    onNsfwToggle,
    onImageClick,
    imageIndex,
    totalImages,
    className = '',
}: MediaAttachmentProps) {
    const needsBlur = isSensitive && !nsfwRevealed;

    // Variant-specific classes
    const variantClasses = {
        compact: 'w-12 h-12 rounded',
        card: 'w-full h-36 rounded-lg',
        detail: 'w-full max-h-96 rounded-xl bg-slate-800',
    }[variant];

    // Variant-specific object-fit
    // detail: contain to show full image, card/compact: cover for uniform thumbnails
    const objectFitClass = variant === 'detail' ? 'object-contain' : 'object-cover';

    // Select display URL based on variant
    // detail: prioritize full resolution, card/compact: prioritize thumbnail for bandwidth
    const displayUrl =
        variant === 'detail'
            ? (media.url ?? media.previewUrl ?? '')
            : (media.previewUrl ?? media.url ?? '');

    // Check if media has valid URL
    const hasValidUrl = (): boolean => {
        const url = media.url ?? media.previewUrl ?? '';
        return url !== '';
    };

    // Check if media has valid preview URL (for NSFW case)
    const hasValidPreviewUrl = (): boolean => {
        return (media.previewUrl ?? '') !== '';
    };

    // Generate accessible label
    const getAccessibleLabel = (): string => {
        if (needsBlur) {
            if (imageIndex !== undefined && totalImages !== undefined) {
                return `閲覧注意の画像を表示 (${imageIndex + 1}/${totalImages})`;
            }
            return '閲覧注意の画像を表示';
        }
        if (media.description) {
            return media.description;
        }
        if (imageIndex !== undefined && totalImages !== undefined) {
            return `画像を拡大 (${imageIndex + 1}/${totalImages})`;
        }
        return '画像を拡大';
    };

    // Render image type
    if (media.type === 'image') {
        if (!hasValidUrl()) {
            return null;
        }

        // For NSFW or when onImageClick is provided, render as button
        if (needsBlur || onImageClick) {
            return (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (isSensitive && !nsfwRevealed && onNsfwToggle) {
                            onNsfwToggle();
                        } else if (onImageClick) {
                            onImageClick();
                        }
                    }}
                    className={`block overflow-hidden text-left nsfw-blur-container ${variantClasses} ${className}`}
                    aria-label={getAccessibleLabel()}
                >
                    <img
                        src={displayUrl}
                        alt={media.description || '添付メディア'}
                        className={`${variantClasses} ${objectFitClass} transition-opacity ${
                            needsBlur ? 'nsfw-blur' : 'hover:opacity-90'
                        }`}
                    />
                    {needsBlur && (
                        <div className="nsfw-blur-overlay">
                            <span className="text-white text-sm font-medium">閲覧注意</span>
                        </div>
                    )}
                </button>
            );
        }

        // For non-NSFW without onImageClick (e.g., NotificationCard thumbnails), render as plain img
        return (
            <img
                src={displayUrl}
                alt={media.description || '添付メディア'}
                className={`${variantClasses} ${className} ${objectFitClass}`}
            />
        );
    }

    // Render video type
    if (media.type === 'video') {
        // Non-NSFW video: render as <a> tag
        if (!needsBlur) {
            if (!media.url) {
                return null;
            }
            return (
                <a
                    href={media.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`block overflow-hidden ${variantClasses} ${className}`}
                    aria-label={media.description || '動画'}
                >
                    <video
                        src={media.url}
                        poster={media.previewUrl ?? undefined}
                        className={`${variantClasses} ${objectFitClass}`}
                    />
                </a>
            );
        }

        // NSFW video: render as button with blur toggle
        if (!hasValidPreviewUrl()) {
            return null;
        }
        return (
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    onNsfwToggle?.();
                }}
                className={`block overflow-hidden text-left nsfw-blur-container ${variantClasses} ${className}`}
                aria-label="閲覧注意の動画を表示"
            >
                <video
                    src={media.url ?? undefined}
                    poster={media.previewUrl}
                    className={`${variantClasses} ${objectFitClass} nsfw-blur`}
                    aria-hidden="true"
                    tabIndex={-1}
                />
                <div className="nsfw-blur-overlay">
                    <span className="text-white text-sm font-medium">閲覧注意</span>
                </div>
            </button>
        );
    }

    // Render gifv type
    if (media.type === 'gifv') {
        // Non-NSFW gifv: render as <a> tag with autoplay
        if (!needsBlur) {
            if (!media.url) {
                return null;
            }
            return (
                <a
                    href={media.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`block overflow-hidden ${variantClasses} ${className}`}
                    aria-label={media.description || 'GIFアニメーション'}
                >
                    <video
                        src={media.url}
                        poster={media.previewUrl ?? undefined}
                        className={`${variantClasses} ${objectFitClass}`}
                        autoPlay
                        loop
                        muted
                        playsInline
                        aria-hidden="true"
                        tabIndex={-1}
                    />
                </a>
            );
        }

        // NSFW gifv: render as button with blur toggle (no autoplay)
        if (!hasValidPreviewUrl()) {
            return null;
        }
        return (
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    onNsfwToggle?.();
                }}
                className={`block overflow-hidden text-left nsfw-blur-container ${variantClasses} ${className}`}
                aria-label="閲覧注意のGIFを表示"
            >
                <video
                    src={media.url ?? undefined}
                    poster={media.previewUrl}
                    className={`${variantClasses} ${objectFitClass} nsfw-blur`}
                    muted
                    playsInline
                    aria-hidden="true"
                    tabIndex={-1}
                />
                <div className="nsfw-blur-overlay">
                    <span className="text-white text-sm font-medium">閲覧注意</span>
                </div>
            </button>
        );
    }

    // Unknown media type - skip rendering
    return null;
}
