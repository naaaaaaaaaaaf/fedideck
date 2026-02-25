import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ComposeMediaPreview } from './ComposeMediaPreview';
import type { MediaFile } from '../../hooks/useMediaUpload';

describe('ComposeMediaPreview', () => {
    const mockOnRemove = vi.fn();
    const mockOnUpdateAltText = vi.fn();
    const mockOnToggleSensitive = vi.fn();

    const defaultMediaFiles: MediaFile[] = [
        {
            localId: 'media-1',
            preview: 'https://example.com/image.png',
            uploading: false,
            uploadedId: 'server-id',
            altText: '',
            kind: 'image',
        },
    ];

    const defaultProps = {
        mediaFiles: defaultMediaFiles,
        onRemove: mockOnRemove,
        onUpdateAltText: mockOnUpdateAltText,
        isSensitive: false,
        onToggleSensitive: mockOnToggleSensitive,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render nothing when no media files', () => {
        const { container } = render(<ComposeMediaPreview {...defaultProps} mediaFiles={[]} />);

        expect(container.firstChild).toBeNull();
    });

    it('should render image preview', () => {
        render(<ComposeMediaPreview {...defaultProps} />);

        const img = screen.getByAltText('添付メディア 1');
        expect(img).toBeInTheDocument();
    });

    it('should render video preview', () => {
        const videoMedia: MediaFile[] = [
            {
                localId: 'video-1',
                preview: 'https://example.com/video.mp4',
                uploading: false,
                altText: '',
                kind: 'video',
            },
        ];

        render(<ComposeMediaPreview {...defaultProps} mediaFiles={videoMedia} />);

        const video = document.querySelector('video');
        expect(video).toBeInTheDocument();
    });

    it('should render audio preview', () => {
        const audioMedia: MediaFile[] = [
            {
                localId: 'audio-1',
                preview: 'https://example.com/audio.mp3',
                uploading: false,
                altText: '',
                kind: 'audio',
            },
        ];

        render(<ComposeMediaPreview {...defaultProps} mediaFiles={audioMedia} />);

        const audio = document.querySelector('audio');
        expect(audio).toBeInTheDocument();
    });

    it('should call onRemove when clicking remove button', () => {
        render(<ComposeMediaPreview {...defaultProps} />);

        fireEvent.click(screen.getByLabelText('メディア 1 を削除'));

        expect(mockOnRemove).toHaveBeenCalledWith('media-1');
    });

    it('should disable remove button when uploading', () => {
        const uploadingMedia: MediaFile[] = [
            {
                ...defaultMediaFiles[0],
                uploading: true,
            },
        ];

        render(<ComposeMediaPreview {...defaultProps} mediaFiles={uploadingMedia} />);

        expect(screen.getByLabelText('メディア 1 を削除')).toBeDisabled();
    });

    it('should call onUpdateAltText when typing alt text', () => {
        render(<ComposeMediaPreview {...defaultProps} />);

        const input = screen.getByPlaceholderText('代替テキストを追加...');
        fireEvent.change(input, { target: { value: 'Image description' } });

        expect(mockOnUpdateAltText).toHaveBeenCalledWith('media-1', 'Image description');
    });

    it('should display existing alt text', () => {
        const mediaWithAlt: MediaFile[] = [
            {
                ...defaultMediaFiles[0],
                altText: 'Existing alt text',
            },
        ];

        render(<ComposeMediaPreview {...defaultProps} mediaFiles={mediaWithAlt} />);

        expect(screen.getByDisplayValue('Existing alt text')).toBeInTheDocument();
    });

    it('should disable alt text input when uploading', () => {
        const uploadingMedia: MediaFile[] = [
            {
                ...defaultMediaFiles[0],
                uploading: true,
            },
        ];

        render(<ComposeMediaPreview {...defaultProps} mediaFiles={uploadingMedia} />);

        expect(screen.getByPlaceholderText('代替テキストを追加...')).toBeDisabled();
    });

    it('should show upload overlay when uploading', () => {
        const uploadingMedia: MediaFile[] = [
            {
                ...defaultMediaFiles[0],
                uploading: true,
            },
        ];

        render(<ComposeMediaPreview {...defaultProps} mediaFiles={uploadingMedia} />);

        expect(screen.getByLabelText('アップロード中')).toBeInTheDocument();
    });

    it('should show error overlay when upload failed', () => {
        const errorMedia: MediaFile[] = [
            {
                ...defaultMediaFiles[0],
                uploading: false,
                error: 'Upload failed',
            },
        ];

        render(<ComposeMediaPreview {...defaultProps} mediaFiles={errorMedia} />);

        expect(screen.getByText('Upload failed')).toBeInTheDocument();
    });

    it('should render NSFW toggle', () => {
        render(<ComposeMediaPreview {...defaultProps} />);

        expect(screen.getByLabelText('閲覧注意 (NSFW)')).toBeInTheDocument();
    });

    it('should call onToggleSensitive when clicking NSFW checkbox', () => {
        render(<ComposeMediaPreview {...defaultProps} />);

        fireEvent.click(screen.getByLabelText('閲覧注意 (NSFW)'));

        expect(mockOnToggleSensitive).toHaveBeenCalledWith(true);
    });

    it('should show NSFW checkbox as checked when isSensitive is true', () => {
        render(<ComposeMediaPreview {...defaultProps} isSensitive={true} />);

        const checkbox = screen.getByLabelText('閲覧注意 (NSFW)') as HTMLInputElement;
        expect(checkbox.checked).toBe(true);
    });

    it('should render multiple media files', () => {
        const multipleMedia: MediaFile[] = [
            { ...defaultMediaFiles[0], localId: 'media-1' },
            { ...defaultMediaFiles[0], localId: 'media-2' },
        ];

        render(<ComposeMediaPreview {...defaultProps} mediaFiles={multipleMedia} />);

        expect(screen.getByLabelText('メディア 1 を削除')).toBeInTheDocument();
        expect(screen.getByLabelText('メディア 2 を削除')).toBeInTheDocument();
    });
});
