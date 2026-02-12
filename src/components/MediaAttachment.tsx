import type { mastodon } from 'masto';
import { LuPlay, LuMusic } from 'react-icons/lu';
import { firstNonEmpty } from '../utils/firstNonEmpty';

/**
 * Check if a URL appears to be an image URL based on file extension
 * Returns false for null/undefined, or URLs without image extensions
 */
const isImageUrl = (url: string | null | undefined): boolean => {
    if (!url) return false;
    const imageExtensions = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i;
    return imageExtensions.test(url);
};

export interface MediaAttachmentProps {
    media: mastodon.v1.MediaAttachment;
    variant?: 'compact' | 'card' | 'detail';
    isSensitive: boolean;
    nsfwRevealed: boolean;
    onNsfwToggle?: () => void;
    onImageClick?: () => void;
    imageIndex?: number;
    totalImages?: number;
    onVideoClick?: () => void;
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
    onVideoClick,
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
    // compact: smaller text for 48x48px thumbnails, card/detail: normal size
    const overlayTextClass = variant === 'compact' ? 'text-xs' : 'text-sm';

    // Select display URL based on variant
    // detail: prioritize full resolution, card/compact: prioritize thumbnail for bandwidth
    const displayUrl = firstNonEmpty(
        variant === 'detail' ? media.url : media.previewUrl,
        variant === 'detail' ? media.previewUrl : media.url
    );

    // Check if media has valid URL
    const hasValidUrl = (): boolean => {
        return firstNonEmpty(media.url, media.previewUrl) !== '';
    };

    // Generate accessible label
    const getAccessibleLabel = (mediaType?: string): string => {
        if (needsBlur) {
            const blurLabel =
                mediaType === 'video'
                    ? '動画'
                    : mediaType === 'gifv'
                      ? 'GIF'
                      : mediaType === 'audio'
                        ? '音声プレーヤー'
                        : '画像';

            if (imageIndex !== undefined && totalImages !== undefined) {
                return `閲覧注意の${blurLabel}を表示 (${imageIndex + 1}/${totalImages})`;
            }
            return `閲覧注意の${blurLabel}を表示`;
        }

        const mediaLabel =
            mediaType === 'video'
                ? '動画'
                : mediaType === 'gifv'
                  ? 'GIF'
                  : mediaType === 'audio'
                    ? '音声プレーヤー'
                    : '画像';

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
        // Audio type: render music icon or artwork thumbnail
        if (media.type === 'audio') {
            const artworkUrl = firstNonEmpty(media.previewUrl, media.previewRemoteUrl);
            const validArtworkUrl = artworkUrl && isImageUrl(artworkUrl) ? artworkUrl : null;

            // NSFW audio in compact mode: render as button with blur
            if (needsBlur) {
                if (!onNsfwToggle) {
                    return null;
                }
                return (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onNsfwToggle();
                        }}
                        className={`relative block overflow-hidden text-left nsfw-blur-container ${variantClasses} ${className} bg-slate-800 flex items-center justify-center`}
                        aria-label={getAccessibleLabel('audio')}
                    >
                        {validArtworkUrl ? (
                            <img
                                src={validArtworkUrl}
                                alt={media.description ?? ''}
                                role="presentation"
                                className={`${variantClasses} ${objectFitClass} nsfw-blur`}
                            />
                        ) : (
                            <LuMusic className="w-6 h-6 text-slate-300" aria-hidden="true" />
                        )}
                        {/* Add visual layer for NSFW indication */}
                        <div className="absolute inset-0 bg-slate-700/80" aria-hidden="true" />
                        <div className="nsfw-blur-overlay">
                            <span className={`text-white ${overlayTextClass} font-medium`}>
                                閲覧注意
                            </span>
                        </div>
                    </button>
                );
            }

            // Non-NSFW audio: show artwork or music icon
            return (
                <div
                    className={`${variantClasses} ${className} bg-slate-800 flex items-center justify-center`}
                >
                    {validArtworkUrl ? (
                        <img
                            src={validArtworkUrl}
                            alt={media.description ?? ''}
                            role="presentation"
                            className={`${variantClasses} ${objectFitClass}`}
                        />
                    ) : (
                        <LuMusic className="w-6 h-6 text-slate-400" aria-hidden="true" />
                    )}
                </div>
            );
        }

        // Compact mode only supports image/video/gifv types
        // Note: audio is handled separately above (line 99)
        // Unknown types are not rendered as thumbnails
        if (media.type !== 'image' && media.type !== 'video' && media.type !== 'gifv') {
            return null;
        }

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
            // If onNsfwToggle is not provided, we cannot properly handle NSFW content
            if (!onNsfwToggle) {
                return null;
            }
            return (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onNsfwToggle?.();
                    }}
                    className={`relative block overflow-hidden text-left nsfw-blur-container ${variantClasses} ${className}`}
                    aria-label={getAccessibleLabel(media.type)}
                >
                    <img
                        src={thumbnailUrl}
                        alt={media.description ?? ''}
                        role="presentation"
                        className={`${variantClasses} ${objectFitClass} nsfw-blur`}
                    />
                    <div className="nsfw-blur-overlay">
                        <span className={`text-white ${overlayTextClass} font-medium`}>
                            閲覧注意
                        </span>
                    </div>
                    {/* Play button for video/gifv */}
                    {(media.type === 'video' || media.type === 'gifv') && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="p-1.5 bg-white/90 rounded-full">
                                <LuPlay className="w-3 h-3 text-slate-900" aria-hidden="true" />
                            </div>
                        </div>
                    )}
                </button>
            );
        }

        // Non-NSFW thumbnail: render as img with play button overlay for video/gifv
        // Use empty alt when no description to treat thumbnail as decorative
        if (media.type === 'video' || media.type === 'gifv') {
            return (
                <div
                    className={`relative block overflow-hidden ${variantClasses} ${className}`}
                    role="img"
                    aria-label={
                        media.description || (media.type === 'video' ? '動画' : 'GIFアニメーション')
                    }
                >
                    <img
                        src={thumbnailUrl}
                        alt={media.description ?? ''}
                        role="presentation"
                        className={`${variantClasses} ${objectFitClass}`}
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <div className="p-1.5 bg-white/90 rounded-full">
                            <LuPlay className="w-3 h-3 text-slate-900" aria-hidden="true" />
                        </div>
                    </div>
                </div>
            );
        }

        // For images, render as plain img
        return (
            <img
                src={thumbnailUrl}
                alt={media.description ?? ''}
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
            // If NSFW content needs blur but onNsfwToggle is not provided, cannot handle properly
            if (needsBlur && !onNsfwToggle) {
                return null;
            }
            return (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (isSensitive && !nsfwRevealed) {
                            onNsfwToggle?.();
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
                        role="presentation"
                        className={`${variantClasses} ${objectFitClass} transition-opacity ${
                            needsBlur ? 'nsfw-blur' : 'hover:opacity-90'
                        }`}
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
        const videoUrl = firstNonEmpty(media.url);
        const posterUrl = firstNonEmpty(media.previewUrl);

        // NSFW blur state: render as button with blur toggle
        if (needsBlur) {
            // If onNsfwToggle is not provided, cannot properly handle NSFW content
            if (!onNsfwToggle) {
                return null;
            }
            // Need at least posterUrl for NSFW blur display
            if (!posterUrl) {
                return null;
            }
            return (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onNsfwToggle();
                    }}
                    className={`block overflow-hidden text-left nsfw-blur-container ${variantClasses} ${className}`}
                    aria-label={getAccessibleLabel(media.type)}
                >
                    <video
                        poster={posterUrl}
                        preload="none"
                        className={`${variantClasses} ${objectFitClass} nsfw-blur`}
                        aria-hidden="true"
                        tabIndex={-1}
                    />
                    <div className="nsfw-blur-overlay">
                        <span className={`text-white ${overlayTextClass} font-medium`}>
                            閲覧注意
                        </span>
                    </div>
                </button>
            );
        }

        // Non-NSFW or NSFW revealed: render video without blur
        // If we have poster URL but no video URL, render as static image
        if (!videoUrl && posterUrl) {
            return (
                <img
                    src={posterUrl}
                    alt={getAccessibleLabel(media.type)}
                    className={`${variantClasses} ${className} ${objectFitClass}`}
                />
            );
        }

        if (!videoUrl) {
            return null;
        }

        // If onVideoClick is provided, render as button
        if (onVideoClick) {
            return (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onVideoClick();
                    }}
                    className={`group relative block overflow-hidden text-left ${variantClasses} ${className}`}
                    aria-label={getAccessibleLabel(media.type)}
                >
                    <video
                        src={videoUrl}
                        poster={posterUrl || undefined}
                        preload="none"
                        className={`${variantClasses} ${objectFitClass}`}
                        aria-hidden="true"
                        tabIndex={-1}
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 focus-visible:opacity-100 group-focus-within:opacity-100 transition-opacity">
                        <div className="p-3 bg-white/90 rounded-full">
                            <LuPlay className="w-6 h-6 text-slate-900" aria-hidden="true" />
                        </div>
                    </div>
                </button>
            );
        }

        // Otherwise, render as <a> tag (legacy behavior)
        return (
            <a
                href={videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`group relative block overflow-hidden ${variantClasses} ${className}`}
                aria-label={getAccessibleLabel(media.type)}
            >
                <video
                    src={videoUrl}
                    poster={posterUrl || undefined}
                    preload="none"
                    className={`${variantClasses} ${objectFitClass}`}
                    aria-hidden="true"
                    tabIndex={-1}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 focus-visible:opacity-100 group-focus-within:opacity-100 transition-opacity pointer-events-none">
                    <div className="p-3 bg-white/90 rounded-full">
                        <LuPlay className="w-6 h-6 text-slate-900" aria-hidden="true" />
                    </div>
                </div>
            </a>
        );
    }

    // Render gifv type
    if (media.type === 'gifv') {
        const videoUrl = firstNonEmpty(media.url);
        const posterUrl = firstNonEmpty(media.previewUrl);

        // NSFW blur state: render as button with blur toggle
        if (needsBlur) {
            // If onNsfwToggle is not provided, cannot properly handle NSFW content
            if (!onNsfwToggle) {
                return null;
            }
            // Need at least posterUrl for NSFW blur display
            if (!posterUrl) {
                return null;
            }
            return (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onNsfwToggle();
                    }}
                    className={`block overflow-hidden text-left nsfw-blur-container ${variantClasses} ${className}`}
                    aria-label={getAccessibleLabel(media.type)}
                >
                    <video
                        poster={posterUrl}
                        preload="none"
                        className={`${variantClasses} ${objectFitClass} nsfw-blur`}
                        loop
                        muted
                        playsInline
                        aria-hidden="true"
                        tabIndex={-1}
                    />
                    <div className="nsfw-blur-overlay">
                        <span className={`text-white ${overlayTextClass} font-medium`}>
                            閲覧注意
                        </span>
                    </div>
                </button>
            );
        }

        // Non-NSFW or NSFW revealed: render video without blur
        // If we have poster URL but no video URL, render as static image
        if (!videoUrl && posterUrl) {
            return (
                <img
                    src={posterUrl}
                    alt={getAccessibleLabel(media.type)}
                    className={`${variantClasses} ${className} ${objectFitClass}`}
                />
            );
        }

        if (!videoUrl) {
            return null;
        }

        // If onVideoClick is provided, render as button
        if (onVideoClick) {
            return (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onVideoClick();
                    }}
                    className={`group relative block overflow-hidden text-left ${variantClasses} ${className}`}
                    aria-label={getAccessibleLabel(media.type)}
                >
                    <video
                        src={videoUrl}
                        poster={posterUrl || undefined}
                        preload="none"
                        className={`${variantClasses} ${objectFitClass}`}
                        loop
                        muted
                        playsInline
                        aria-hidden="true"
                        tabIndex={-1}
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 focus-visible:opacity-100 group-focus-within:opacity-100 transition-opacity">
                        <div className="p-3 bg-white/90 rounded-full">
                            <LuPlay className="w-6 h-6 text-slate-900" aria-hidden="true" />
                        </div>
                    </div>
                </button>
            );
        }

        // Otherwise, render as <a> tag (legacy behavior)
        return (
            <a
                href={videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`group relative block overflow-hidden ${variantClasses} ${className}`}
                aria-label={getAccessibleLabel(media.type)}
            >
                <video
                    src={videoUrl}
                    poster={posterUrl || undefined}
                    preload="none"
                    className={`${variantClasses} ${objectFitClass}`}
                    loop
                    muted
                    playsInline
                    aria-hidden="true"
                    tabIndex={-1}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 focus-visible:opacity-100 group-focus-within:opacity-100 transition-opacity pointer-events-none">
                    <div className="p-3 bg-white/90 rounded-full">
                        <LuPlay className="w-6 h-6 text-slate-900" aria-hidden="true" />
                    </div>
                </div>
            </a>
        );
    }

    // Render audio type
    if (media.type === 'audio') {
        // CRITICAL: audioUrlは音声ファイルURLのみ使用（previewUrlは画像の可能性大）
        const audioUrl = firstNonEmpty(media.url, media.remoteUrl);
        const artworkUrl = firstNonEmpty(media.previewUrl, media.previewRemoteUrl);
        const validArtworkUrl = artworkUrl && isImageUrl(artworkUrl) ? artworkUrl : null;

        if (audioUrl === '') {
            return null;
        }

        if (needsBlur) {
            if (!onNsfwToggle) {
                return null;
            }
            return (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onNsfwToggle();
                    }}
                    className={`w-full rounded-lg p-3 bg-slate-800 text-left nsfw-blur-container relative ${className}`}
                    aria-label={getAccessibleLabel('audio')}
                >
                    <LuMusic className="w-6 h-6 text-slate-300" aria-hidden="true" />
                    {/* Add visual layer for NSFW indication */}
                    <div className="absolute inset-0 bg-slate-700/80" aria-hidden="true" />
                </button>
            );
        }

        // 音声専用レイアウト（variantClassesの h-36/max-h-96 を使わない）
        return (
            <div className={`w-full rounded-lg bg-slate-800 p-3 ${className}`}>
                {validArtworkUrl && (
                    <img
                        src={validArtworkUrl}
                        alt=""
                        className="w-20 h-20 rounded mb-2 object-cover"
                    />
                )}
                <audio
                    src={audioUrl}
                    controls
                    preload="none"
                    className="w-full"
                    aria-label={media.description ?? '音声プレーヤー'}
                >
                    <a href={audioUrl} target="_blank" rel="noopener noreferrer">
                        音声を開く
                    </a>
                </audio>
            </div>
        );
    }

    // Unknown media type - skip rendering
    return null;
}
