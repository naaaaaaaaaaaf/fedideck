import type { mastodon } from 'masto';
import { firstNonEmpty } from '../utils/firstNonEmpty';

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

    // Variant-specific overlay text size
    // compact: smaller text for 12x12px thumbnails, card/detail: normal size
    const overlayTextClass = variant === 'compact' ? 'text-xs' : 'text-sm';

    // Select display URL based on variant
    // detail: prioritize full resolution, card/compact: prioritize thumbnail for bandwidth
    const displayUrl = firstNonEmpty(
        variant === 'detail' ? media.url : media.previewUrl,
        variant === 'detail' ? media.previewUrl : media.url,
        ''
    );

    // Check if media has valid URL
    const hasValidUrl = (): boolean => {
        return firstNonEmpty(media.url, media.previewUrl) !== '';
    };

    // Check if media has valid preview URL (for NSFW case)
    const hasValidPreviewUrl = (): boolean => {
        return firstNonEmpty(media.previewUrl) !== '';
    };

    // Generate accessible label
    const getAccessibleLabel = (mediaType?: string): string => {
        const mediaLabel = mediaType === 'video' ? '動画' : mediaType === 'gifv' ? 'GIF' : '画像';

        if (needsBlur) {
            if (imageIndex !== undefined && totalImages !== undefined) {
                return `閲覧注意の${mediaLabel}を表示 (${imageIndex + 1}/${totalImages})`;
            }
            return `閲覧注意の${mediaLabel}を表示`;
        }
        if (media.description) {
            return media.description;
        }
        if (imageIndex !== undefined && totalImages !== undefined) {
            return `${mediaLabel}を拡大 (${imageIndex + 1}/${totalImages})`;
        }
        return `${mediaLabel}を拡大`;
    };

    // Compact mode: render media as simple thumbnails
    // This preserves parent element's click behavior (e.g., NotificationCard)
    if (variant === 'compact') {
        // For video/gifv, we need a valid previewUrl (poster image)
        // Cannot use video URL (mp4) directly in an img tag
        if (media.type === 'video' || media.type === 'gifv') {
            const posterUrl = firstNonEmpty(media.previewUrl);
            if (posterUrl === '') {
                return null;
            }
        }

        // For images, use previewUrl with url fallback
        const thumbnailUrl = firstNonEmpty(media.previewUrl, media.url);
        if (thumbnailUrl === '') {
            return null;
        }

        // NSFW thumbnail in compact mode: render as button with blur
        if (needsBlur) {
            return (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onNsfwToggle?.();
                    }}
                    className={`block overflow-hidden text-left nsfw-blur-container ${variantClasses} ${className}`}
                    aria-label={getAccessibleLabel(media.type)}
                >
                    <img
                        src={thumbnailUrl}
                        alt={media.description ?? ''}
                        className={`${variantClasses} ${objectFitClass} nsfw-blur`}
                        aria-hidden="true"
                    />
                    <div className="nsfw-blur-overlay">
                        <span className={`text-white ${overlayTextClass} font-medium`}>
                            閲覧注意
                        </span>
                    </div>
                </button>
            );
        }

        // Non-NSFW thumbnail: render as plain img
        const fallbackAlt =
            media.type === 'video' ? '添付動画' : media.type === 'gifv' ? '添付GIF' : '添付画像';
        return (
            <img
                src={thumbnailUrl}
                alt={media.description ?? fallbackAlt}
                className={`${variantClasses} ${className} ${objectFitClass}`}
            />
        );
    }

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
                    aria-label={getAccessibleLabel(media.type)}
                >
                    <img
                        src={displayUrl}
                        alt={media.description ?? ''}
                        className={`${variantClasses} ${objectFitClass} transition-opacity ${
                            needsBlur ? 'nsfw-blur' : 'hover:opacity-90'
                        }`}
                        aria-hidden="true"
                    />
                    {needsBlur && (
                        <div className="nsfw-blur-overlay">
                            <span className={`text-white ${overlayTextClass} font-medium`}>
                                閲覧注意
                            </span>
                        </div>
                    )}
                </button>
            );
        }

        // For non-NSFW without onImageClick (e.g., NotificationCard thumbnails), render as plain img
        return (
            <img
                src={displayUrl}
                alt={media.description ?? ''}
                className={`${variantClasses} ${className} ${objectFitClass}`}
            />
        );
    }

    // Render video type
    if (media.type === 'video') {
        // Non-NSFW video: render as <a> tag
        if (!needsBlur) {
            if (!firstNonEmpty(media.url)) {
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
                        poster={firstNonEmpty(media.previewUrl) || undefined}
                        className={`${variantClasses} ${objectFitClass}`}
                    />
                </a>
            );
        }

        // NSFW video: render as button with blur toggle
        if (!hasValidPreviewUrl() || !hasValidUrl()) {
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
                aria-label={getAccessibleLabel(media.type)}
            >
                <video
                    src={media.url || undefined}
                    poster={firstNonEmpty(media.previewUrl) || undefined}
                    className={`${variantClasses} ${objectFitClass} nsfw-blur`}
                    aria-hidden="true"
                    tabIndex={-1}
                />
                <div className="nsfw-blur-overlay">
                    <span className={`text-white ${overlayTextClass} font-medium`}>閲覧注意</span>
                </div>
            </button>
        );
    }

    // Render gifv type
    if (media.type === 'gifv') {
        // Non-NSFW gifv: render as <a> tag with autoplay
        if (!needsBlur) {
            if (!firstNonEmpty(media.url)) {
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
                        poster={firstNonEmpty(media.previewUrl) || undefined}
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
        if (!hasValidPreviewUrl() || !hasValidUrl()) {
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
                aria-label={getAccessibleLabel(media.type)}
            >
                <video
                    src={media.url || undefined}
                    poster={firstNonEmpty(media.previewUrl) || undefined}
                    className={`${variantClasses} ${objectFitClass} nsfw-blur`}
                    muted
                    playsInline
                    aria-hidden="true"
                    tabIndex={-1}
                />
                <div className="nsfw-blur-overlay">
                    <span className={`text-white ${overlayTextClass} font-medium`}>閲覧注意</span>
                </div>
            </button>
        );
    }

    // Unknown media type - skip rendering
    return null;
}
