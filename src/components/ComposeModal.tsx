import { useState, useRef } from 'react';
import { LuX, LuTriangleAlert, LuGlobe, LuLockOpen, LuLock, LuMail, LuLoader, LuImage } from 'react-icons/lu';
import { useAccountsStore } from '../store/accounts';
import { getClient, createStatus, uploadMedia, type CreateStatusParams } from '../api/mastoClient';

interface ComposeModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type Visibility = 'public' | 'unlisted' | 'private' | 'direct';

interface VisibilityOption {
    value: Visibility;
    label: string;
    description: string;
    icon: React.ReactNode;
}

interface MediaFile {
    file: File;
    preview: string;
    uploading: boolean;
    uploadedId?: string;
    error?: string;
}

const VISIBILITY_OPTIONS: VisibilityOption[] = [
    { value: 'public', label: '公開', description: '全員に表示', icon: <LuGlobe /> },
    { value: 'unlisted', label: '未収載', description: '公開タイムラインに表示しない', icon: <LuLockOpen /> },
    { value: 'private', label: 'フォロワーのみ', description: 'フォロワーにのみ表示', icon: <LuLock /> },
    { value: 'direct', label: 'ダイレクト', description: 'メンションしたユーザーにのみ表示', icon: <LuMail /> },
];

const MAX_CHARS = 500;
const MAX_MEDIA = 4;
const ACCEPTED_MEDIA_TYPES = 'image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm';

export function ComposeModal({ isOpen, onClose }: ComposeModalProps) {
    const [content, setContent] = useState('');
    const [visibility, setVisibility] = useState<Visibility>('public');
    const [showCW, setShowCW] = useState(false);
    const [cwText, setCwText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const activeAccount = useAccountsStore(state => state.getActiveAccount());

    const remainingChars = MAX_CHARS - content.length;
    const isOverLimit = remainingChars < 0;
    const hasMedia = mediaFiles.length > 0;
    const allMediaUploaded = mediaFiles.every(m => m.uploadedId && !m.uploading);
    const isUploading = mediaFiles.some(m => m.uploading);
    const canSubmit = (content.trim().length > 0 || hasMedia) && !isOverLimit && !isSubmitting && !isUploading && activeAccount && (!hasMedia || allMediaUploaded);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || !activeAccount) return;

        const remainingSlots = MAX_MEDIA - mediaFiles.length;
        const filesToAdd = Array.from(files).slice(0, remainingSlots);

        if (filesToAdd.length === 0) return;

        // Check for video - video can only be alone
        const hasVideo = mediaFiles.some(m => m.file.type.startsWith('video/'));
        const newHasVideo = filesToAdd.some(f => f.type.startsWith('video/'));

        if (hasVideo || (newHasVideo && mediaFiles.length > 0)) {
            setError('動画は他のメディアと同時に添付できません');
            return;
        }

        if (newHasVideo && filesToAdd.length > 1) {
            setError('動画は1つのみ添付できます');
            return;
        }

        const client = getClient(activeAccount);

        // Create preview and add to state
        const newMediaFiles: MediaFile[] = filesToAdd.map(file => ({
            file,
            preview: URL.createObjectURL(file),
            uploading: true,
        }));

        setMediaFiles(prev => [...prev, ...newMediaFiles]);
        setError(null);

        // Upload each file
        for (let i = 0; i < filesToAdd.length; i++) {
            const file = filesToAdd[i];
            const mediaIndex = mediaFiles.length + i;

            try {
                const media = await uploadMedia(client, file);
                setMediaFiles(prev => prev.map((m, idx) =>
                    idx === mediaIndex
                        ? { ...m, uploading: false, uploadedId: media.id }
                        : m
                ));
            } catch (err) {
                console.error('Failed to upload media:', err);
                setMediaFiles(prev => prev.map((m, idx) =>
                    idx === mediaIndex
                        ? { ...m, uploading: false, error: err instanceof Error ? err.message : 'アップロードに失敗しました' }
                        : m
                ));
            }
        }

        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const removeMedia = (index: number) => {
        setMediaFiles(prev => {
            const media = prev[index];
            if (media.preview) {
                URL.revokeObjectURL(media.preview);
            }
            return prev.filter((_, i) => i !== index);
        });
    };

    const handleSubmit = async () => {
        if (!canSubmit || !activeAccount) return;

        setIsSubmitting(true);
        setError(null);

        try {
            const client = getClient(activeAccount);
            const params: CreateStatusParams = {
                status: content,
                visibility,
            };

            if (showCW && cwText.trim()) {
                params.spoilerText = cwText.trim();
            }

            if (hasMedia && allMediaUploaded) {
                params.mediaIds = mediaFiles.map(m => m.uploadedId!);
            }

            await createStatus(client, params);

            // Clean up previews
            mediaFiles.forEach(m => {
                if (m.preview) URL.revokeObjectURL(m.preview);
            });

            // Reset form and close modal on success
            setContent('');
            setCwText('');
            setShowCW(false);
            setVisibility('public');
            setMediaFiles([]);
            onClose();
        } catch (err) {
            console.error('Failed to post status:', err);
            setError(err instanceof Error ? err.message : '投稿に失敗しました');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        if (isSubmitting || isUploading) return;

        // Clean up previews
        mediaFiles.forEach(m => {
            if (m.preview) URL.revokeObjectURL(m.preview);
        });
        setMediaFiles([]);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={handleClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-lg mx-4 bg-slate-900 rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 shrink-0">
                    <h2 className="text-lg font-semibold text-slate-100">新しい投稿</h2>
                    <button
                        onClick={handleClose}
                        disabled={isSubmitting || isUploading}
                        className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-slate-200 disabled:opacity-50"
                    >
                        <LuX className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto flex-1">
                    {/* Account indicator */}
                    {activeAccount && (
                        <div className="flex items-center gap-2 mb-3">
                            <img
                                src={activeAccount.account.avatar}
                                alt=""
                                className="w-8 h-8 rounded-lg"
                            />
                            <div className="text-sm">
                                <div className="text-slate-200">{activeAccount.account.displayName || activeAccount.account.username}</div>
                                <div className="text-slate-400">@{activeAccount.account.acct}</div>
                            </div>
                        </div>
                    )}

                    {/* CW and Media buttons */}
                    <div className="mb-3 flex gap-2">
                        <button
                            onClick={() => setShowCW(!showCW)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${showCW
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
                                }`}
                        >
                            <LuTriangleAlert className="w-4 h-4" />
                            CW
                        </button>

                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={mediaFiles.length >= MAX_MEDIA || isUploading}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${hasMedia
                                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                                : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            <LuImage className="w-4 h-4" />
                            画像/動画
                            {hasMedia && <span className="text-xs">({mediaFiles.length}/{MAX_MEDIA})</span>}
                        </button>

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept={ACCEPTED_MEDIA_TYPES}
                            multiple
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                    </div>

                    {showCW && (
                        <input
                            type="text"
                            value={cwText}
                            onChange={(e) => setCwText(e.target.value)}
                            placeholder="警告文を入力..."
                            className="w-full mb-3 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                    )}

                    {/* Media Preview */}
                    {hasMedia && (
                        <div className="mb-3 grid grid-cols-2 gap-2">
                            {mediaFiles.map((media, index) => (
                                <div key={index} className="relative aspect-video bg-slate-800 rounded-lg overflow-hidden">
                                    {media.file.type.startsWith('video/') ? (
                                        <video
                                            src={media.preview}
                                            className="w-full h-full object-cover"
                                            muted
                                        />
                                    ) : (
                                        <img
                                            src={media.preview}
                                            alt=""
                                            className="w-full h-full object-cover"
                                        />
                                    )}

                                    {/* Upload overlay */}
                                    {media.uploading && (
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                            <LuLoader className="w-6 h-6 text-white animate-spin" />
                                        </div>
                                    )}

                                    {/* Error overlay */}
                                    {media.error && (
                                        <div className="absolute inset-0 bg-red-900/50 flex items-center justify-center p-2">
                                            <span className="text-xs text-red-200 text-center">{media.error}</span>
                                        </div>
                                    )}

                                    {/* Remove button */}
                                    <button
                                        onClick={() => removeMedia(index)}
                                        disabled={media.uploading}
                                        className="absolute top-1 right-1 w-6 h-6 bg-black/70 hover:bg-black rounded-full flex items-center justify-center text-white transition-colors disabled:opacity-50"
                                    >
                                        <LuX className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Text area */}
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="今なにしてる？"
                        rows={6}
                        disabled={isSubmitting}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 resize-none focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
                        autoFocus
                    />

                    {/* Character count */}
                    <div className={`text-sm text-right mt-1 ${isOverLimit ? 'text-red-400' : remainingChars <= 50 ? 'text-amber-400' : 'text-slate-400'
                        }`}>
                        {remainingChars}
                    </div>

                    {/* Visibility selector */}
                    <div className="mt-3">
                        <label className="text-sm text-slate-400 mb-2 block">公開範囲</label>
                        <div className="grid grid-cols-2 gap-2">
                            {VISIBILITY_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => setVisibility(option.value)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all ${visibility === option.value
                                        ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                                        : 'bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-600'
                                        }`}
                                >
                                    <span className="text-lg">{option.icon}</span>
                                    <div>
                                        <div className="text-sm font-medium">{option.label}</div>
                                        <div className="text-xs text-slate-400">{option.description}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Error message */}
                    {error && (
                        <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-slate-700/50 bg-slate-800/50 shrink-0">
                    <button
                        onClick={handleClose}
                        disabled={isSubmitting || isUploading}
                        className="px-4 py-2 text-slate-300 hover:text-slate-100 transition-colors disabled:opacity-50"
                    >
                        キャンセル
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        className="flex items-center gap-2 px-6 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium rounded-lg transition-colors"
                    >
                        {(isSubmitting || isUploading) && <LuLoader className="w-4 h-4 animate-spin" />}
                        {isSubmitting ? '投稿中...' : isUploading ? 'アップロード中...' : '投稿'}
                    </button>
                </div>
            </div>
        </div>
    );
}
