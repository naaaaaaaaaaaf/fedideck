import { LuX, LuLoader } from 'react-icons/lu';
import type { MediaFile } from '../../hooks/useMediaUpload';

interface ComposeMediaPreviewProps {
    mediaFiles: MediaFile[];
    onRemove: (localId: string) => void;
    onUpdateAltText: (localId: string, altText: string) => void;
    isSensitive: boolean;
    onToggleSensitive: (sensitive: boolean) => void;
}

/**
 * Helper functions for media type detection
 */
const isAudioMedia = (m: MediaFile): boolean =>
    m.kind === 'audio' || (m.file && m.file.type.startsWith('audio/'));

const isVideoMedia = (m: MediaFile): boolean =>
    m.kind === 'video' || m.kind === 'gifv' || (m.file && m.file.type.startsWith('video/'));

/**
 * Media preview component for compose modal
 * Displays uploaded media with alt text input and remove button
 */
export function ComposeMediaPreview({
    mediaFiles,
    onRemove,
    onUpdateAltText,
    isSensitive,
    onToggleSensitive,
}: ComposeMediaPreviewProps) {
    if (mediaFiles.length === 0) return null;

    return (
        <>
            <div className="mb-3 space-y-2">
                {mediaFiles.map((media, index) => (
                    <div key={media.localId} className="bg-slate-800 rounded-lg overflow-hidden">
                        <div className={`relative ${isAudioMedia(media) ? 'p-3' : 'aspect-video'}`}>
                            {isAudioMedia(media) ? (
                                <audio
                                    src={media.preview}
                                    controls
                                    preload="none"
                                    className="w-full"
                                />
                            ) : isVideoMedia(media) ? (
                                <video
                                    src={media.preview}
                                    className="w-full h-full object-cover"
                                    muted
                                />
                            ) : (
                                <img
                                    src={media.preview}
                                    alt={media.altText || `添付メディア ${index + 1}`}
                                    className="w-full h-full object-cover"
                                />
                            )}

                            {/* Upload overlay */}
                            {media.uploading && (
                                <div
                                    className="absolute inset-0 bg-black/50 flex items-center justify-center"
                                    aria-busy="true"
                                    aria-label="アップロード中"
                                >
                                    <LuLoader
                                        className="w-6 h-6 text-white animate-spin"
                                        aria-hidden="true"
                                    />
                                </div>
                            )}

                            {/* Error overlay */}
                            {media.error && (
                                <div
                                    className="absolute inset-0 bg-red-900/50 flex items-center justify-center p-2"
                                    role="alert"
                                >
                                    <span className="text-xs text-red-200 text-center">
                                        {media.error}
                                    </span>
                                </div>
                            )}

                            {/* Remove button */}
                            <button
                                onClick={() => onRemove(media.localId)}
                                disabled={media.uploading}
                                className="absolute top-1 right-1 w-6 h-6 bg-black/70 hover:bg-black rounded-full flex items-center justify-center text-white transition-colors disabled:opacity-50"
                                aria-label={`メディア ${index + 1} を削除`}
                            >
                                <LuX className="w-4 h-4" aria-hidden="true" />
                            </button>
                        </div>

                        {/* Alt text input */}
                        <div className="p-2 border-t border-slate-700">
                            <label htmlFor={`alt-text-${media.localId}`} className="sr-only">
                                メディア {index + 1} の代替テキスト
                            </label>
                            <input
                                id={`alt-text-${media.localId}`}
                                type="text"
                                value={media.altText}
                                onChange={(e) => onUpdateAltText(media.localId, e.target.value)}
                                placeholder="代替テキストを追加..."
                                disabled={media.uploading}
                                className="w-full px-2 py-1 text-sm bg-slate-900 border border-slate-700 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
                            />
                        </div>
                    </div>
                ))}
            </div>

            {/* NSFW toggle - only shown when media is attached */}
            <label className="flex items-center gap-2 mb-3 text-sm text-slate-400 cursor-pointer">
                <input
                    type="checkbox"
                    checked={isSensitive}
                    onChange={(e) => onToggleSensitive(e.target.checked)}
                    className="w-4 h-4 rounded bg-slate-900 border-slate-700"
                />
                閲覧注意 (NSFW)
            </label>
        </>
    );
}
