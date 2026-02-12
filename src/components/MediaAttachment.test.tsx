import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MediaAttachment } from './MediaAttachment';
import type { mastodon } from 'masto';

// Minimal mock media attachment for testing
const createMockMedia = (
    overrides: Partial<mastodon.v1.MediaAttachment> = {}
): mastodon.v1.MediaAttachment => {
    const base = {
        id: '1',
        type: 'image',
        url: 'https://example.com/image.png',
        previewUrl: 'https://example.com/preview.png',
        remoteUrl: null,
        meta: null,
        description: 'Test image',
        blurhash: null,
    };
    return { ...base, ...overrides } as mastodon.v1.MediaAttachment;
};

describe('MediaAttachment', () => {
    describe('rendering images', () => {
        it('should render image with valid URL', () => {
            const media = createMockMedia({ type: 'image' });

            render(<MediaAttachment media={media} isSensitive={false} nsfwRevealed={false} />);

            const img = screen.getByAltText('Test image');
            expect(img).toBeInTheDocument();
            expect(img).toHaveAttribute('src', 'https://example.com/preview.png');
        });

        it('should render image as button when onImageClick is provided', () => {
            const media = createMockMedia({ type: 'image' });

            const { container } = render(
                <MediaAttachment
                    media={media}
                    isSensitive={false}
                    nsfwRevealed={false}
                    onImageClick={() => {}}
                />
            );

            const button = container.querySelector('button');
            expect(button).toBeInTheDocument();
        });

        it('should render image as plain img when onImageClick is not provided', () => {
            const media = createMockMedia({ type: 'image' });

            const { container } = render(
                <MediaAttachment media={media} isSensitive={false} nsfwRevealed={false} />
            );

            const button = container.querySelector('button');
            expect(button).not.toBeInTheDocument();

            const img = container.querySelector('img');
            expect(img).toBeInTheDocument();
        });

        it('should render image with card variant classes', () => {
            const media = createMockMedia({ type: 'image' });

            const { container } = render(
                <MediaAttachment
                    media={media}
                    variant="card"
                    isSensitive={false}
                    nsfwRevealed={false}
                    onImageClick={() => {}}
                />
            );

            const button = container.querySelector('button');
            expect(button).toHaveClass('w-full', 'h-36', 'rounded-lg');
        });

        it('should render image with detail variant classes', () => {
            const media = createMockMedia({ type: 'image' });

            const { container } = render(
                <MediaAttachment
                    media={media}
                    variant="detail"
                    isSensitive={false}
                    nsfwRevealed={false}
                    onImageClick={() => {}}
                />
            );

            const button = container.querySelector('button');
            expect(button).toHaveClass('w-full', 'max-h-96', 'rounded-xl', 'bg-slate-800');
        });

        it('should render image with compact variant classes', () => {
            const media = createMockMedia({ type: 'image' });

            const { container } = render(
                <MediaAttachment
                    media={media}
                    variant="compact"
                    isSensitive={false}
                    nsfwRevealed={false}
                    onImageClick={() => {}}
                />
            );

            // Compact mode renders as plain img (not button) to preserve parent click behavior
            const img = container.querySelector('img');
            expect(img).toHaveClass('w-12', 'h-12', 'rounded');
        });

        it('should not render compact video without previewUrl', () => {
            const media = createMockMedia({
                type: 'video',
                url: 'https://example.com/video.mp4',
                previewUrl: undefined,
            });

            const { container } = render(
                <MediaAttachment
                    media={media}
                    variant="compact"
                    isSensitive={false}
                    nsfwRevealed={false}
                />
            );

            // Video URL (mp4) should not be used in img tag
            expect(container.firstChild).toBeNull();
        });

        it('should not render compact gifv without previewUrl', () => {
            const media = createMockMedia({
                type: 'gifv',
                url: 'https://example.com/animation.mp4',
                previewUrl: undefined,
            });

            const { container } = render(
                <MediaAttachment
                    media={media}
                    variant="compact"
                    isSensitive={false}
                    nsfwRevealed={false}
                />
            );

            // Video URL (mp4) should not be used in img tag
            expect(container.firstChild).toBeNull();
        });

        it('should render compact video with previewUrl', () => {
            const media = createMockMedia({
                type: 'video',
                url: 'https://example.com/video.mp4',
                previewUrl: 'https://example.com/video-poster.png',
            });

            const { container } = render(
                <MediaAttachment
                    media={media}
                    variant="compact"
                    isSensitive={false}
                    nsfwRevealed={false}
                />
            );

            const img = container.querySelector('img');
            expect(img).toBeInTheDocument();
            expect(img).toHaveAttribute('src', 'https://example.com/video-poster.png');
        });

        it('should not render image without valid URL', () => {
            const media = createMockMedia({
                type: 'image',
                url: undefined,
                previewUrl: undefined,
            });

            const { container } = render(
                <MediaAttachment media={media} isSensitive={false} nsfwRevealed={false} />
            );

            expect(container.firstChild).toBeNull();
        });

        it('should use previewUrl as fallback when url is missing', () => {
            const media = createMockMedia({
                type: 'image',
                url: undefined,
                previewUrl: 'https://example.com/preview.png',
            });

            render(<MediaAttachment media={media} isSensitive={false} nsfwRevealed={false} />);

            const img = screen.getByAltText('Test image');
            expect(img).toHaveAttribute('src', 'https://example.com/preview.png');
        });

        it('should apply custom className', () => {
            const media = createMockMedia({ type: 'image' });

            const { container } = render(
                <MediaAttachment
                    media={media}
                    isSensitive={false}
                    nsfwRevealed={false}
                    className="custom-class"
                />
            );

            const img = container.querySelector('img');
            expect(img).toHaveClass('custom-class');
        });
    });

    describe('NSFW blur handling', () => {
        it('should apply blur class to sensitive images', () => {
            const media = createMockMedia({ type: 'image' });
            const onNsfwToggle = vi.fn();

            render(
                <MediaAttachment
                    media={media}
                    isSensitive={true}
                    nsfwRevealed={false}
                    onNsfwToggle={onNsfwToggle}
                />
            );

            const img = screen.getByAltText('Test image');
            expect(img).toHaveClass('nsfw-blur');
        });

        it('should not apply blur to non-sensitive images', () => {
            const media = createMockMedia({ type: 'image' });

            render(<MediaAttachment media={media} isSensitive={false} nsfwRevealed={false} />);

            const img = screen.getByAltText('Test image');
            expect(img).not.toHaveClass('nsfw-blur');
        });

        it('should remove blur when nsfwRevealed is true', () => {
            const media = createMockMedia({ type: 'image' });
            const onNsfwToggle = vi.fn();

            render(
                <MediaAttachment
                    media={media}
                    isSensitive={true}
                    nsfwRevealed={true}
                    onNsfwToggle={onNsfwToggle}
                />
            );

            const img = screen.getByAltText('Test image');
            expect(img).not.toHaveClass('nsfw-blur');
        });

        it('should display overlay on sensitive images', () => {
            const media = createMockMedia({ type: 'image' });
            const onNsfwToggle = vi.fn();

            render(
                <MediaAttachment
                    media={media}
                    isSensitive={true}
                    nsfwRevealed={false}
                    onNsfwToggle={onNsfwToggle}
                />
            );

            expect(screen.getByText('閲覧注意')).toBeInTheDocument();
        });

        it('should not display overlay on non-sensitive images', () => {
            const media = createMockMedia({ type: 'image' });

            render(<MediaAttachment media={media} isSensitive={false} nsfwRevealed={false} />);

            expect(screen.queryByText('閲覧注意')).not.toBeInTheDocument();
        });

        it('should call onNsfwToggle when clicking blurred image', async () => {
            const user = userEvent.setup();
            const media = createMockMedia({ type: 'image' });
            const onNsfwToggle = vi.fn();

            render(
                <MediaAttachment
                    media={media}
                    isSensitive={true}
                    nsfwRevealed={false}
                    onNsfwToggle={onNsfwToggle}
                />
            );

            const button = screen.getByRole('button');
            await user.click(button);

            expect(onNsfwToggle).toHaveBeenCalledTimes(1);
        });

        it('should call onImageClick when clicking revealed image', async () => {
            const user = userEvent.setup();
            const media = createMockMedia({ type: 'image' });
            const onImageClick = vi.fn();

            render(
                <MediaAttachment
                    media={media}
                    isSensitive={true}
                    nsfwRevealed={true}
                    onImageClick={onImageClick}
                />
            );

            const button = screen.getByRole('button');
            await user.click(button);

            expect(onImageClick).toHaveBeenCalledTimes(1);
        });
    });

    describe('video rendering', () => {
        it('should render non-NSFW video as anchor tag', () => {
            const media = createMockMedia({
                type: 'video',
                url: 'https://example.com/video.mp4',
                previewUrl: 'https://example.com/video-poster.png',
                description: 'Test video',
            });

            const { container } = render(
                <MediaAttachment media={media} isSensitive={false} nsfwRevealed={false} />
            );

            const link = container.querySelector('a[href="https://example.com/video.mp4"]');
            expect(link).toBeInTheDocument();
            expect(link).toHaveAttribute('target', '_blank');
            expect(link).toHaveAttribute('rel', 'noopener noreferrer');

            const video = container.querySelector('video');
            expect(video).toBeInTheDocument();
            expect(video).not.toHaveAttribute('controls');
        });

        it('should render non-NSFW video without valid URL as static poster image', () => {
            const media = createMockMedia({
                type: 'video',
                url: undefined,
                previewUrl: 'https://example.com/video-poster.png',
            });

            const { container } = render(
                <MediaAttachment media={media} isSensitive={false} nsfwRevealed={false} />
            );

            // Should render img with previewUrl when url is missing
            const img = container.querySelector('img');
            expect(img).toBeInTheDocument();
            expect(img).toHaveAttribute('src', 'https://example.com/video-poster.png');
        });

        it('should render NSFW video as button with blur', () => {
            const media = createMockMedia({
                type: 'video',
                url: 'https://example.com/video.mp4',
                previewUrl: 'https://example.com/video-poster.png',
            });
            const onNsfwToggle = vi.fn();

            const { container } = render(
                <MediaAttachment
                    media={media}
                    isSensitive={true}
                    nsfwRevealed={false}
                    onNsfwToggle={onNsfwToggle}
                />
            );

            const button = container.querySelector('button[aria-label="閲覧注意の動画を表示"]');
            expect(button).toBeInTheDocument();

            const video = container.querySelector('video');
            expect(video).toHaveClass('nsfw-blur');
            expect(video).toHaveAttribute('aria-hidden', 'true');
            expect(video).toHaveAttribute('tabIndex', '-1');

            const overlay = container.querySelector('div.nsfw-blur-overlay');
            expect(overlay).toBeInTheDocument();
            expect(overlay).toHaveTextContent('閲覧注意');
        });

        it('should not render NSFW video without valid preview URL', () => {
            const media = createMockMedia({
                type: 'video',
                url: 'https://example.com/video.mp4',
                previewUrl: undefined,
            });

            const { container } = render(
                <MediaAttachment media={media} isSensitive={true} nsfwRevealed={false} />
            );

            expect(container.firstChild).toBeNull();
        });

        it('should call onNsfwToggle when clicking NSFW video', async () => {
            const user = userEvent.setup();
            const media = createMockMedia({
                type: 'video',
                url: 'https://example.com/video.mp4',
                previewUrl: 'https://example.com/video-poster.png',
            });
            const onNsfwToggle = vi.fn();

            render(
                <MediaAttachment
                    media={media}
                    isSensitive={true}
                    nsfwRevealed={false}
                    onNsfwToggle={onNsfwToggle}
                />
            );

            const button = screen.getByRole('button', { name: '閲覧注意の動画を表示' });
            await user.click(button);

            expect(onNsfwToggle).toHaveBeenCalledTimes(1);
        });

        it('should render NSFW video with only previewUrl (no url)', () => {
            const media = createMockMedia({
                type: 'video',
                url: undefined,
                previewUrl: 'https://example.com/video-poster.png',
            });
            const onNsfwToggle = vi.fn();

            const { container } = render(
                <MediaAttachment
                    media={media}
                    isSensitive={true}
                    nsfwRevealed={false}
                    onNsfwToggle={onNsfwToggle}
                />
            );

            const button = container.querySelector('button');
            expect(button).toBeInTheDocument();
        });

        it('should render non-NSFW video with only previewUrl as static image', () => {
            const media = createMockMedia({
                type: 'video',
                url: undefined,
                previewUrl: 'https://example.com/video-poster.png',
            });
            const onNsfwToggle = vi.fn();

            const { container } = render(
                <MediaAttachment
                    media={media}
                    isSensitive={true}
                    nsfwRevealed={true}
                    onNsfwToggle={onNsfwToggle}
                />
            );

            // Should render img with previewUrl when url is missing
            const img = container.querySelector('img');
            expect(img).toBeInTheDocument();
            expect(img).toHaveAttribute('src', 'https://example.com/video-poster.png');
        });

        it('should maintain video visibility when toggling NSFW reveal with only previewUrl', () => {
            const media = createMockMedia({
                type: 'video',
                url: undefined,
                previewUrl: 'https://example.com/video-poster.png',
            });
            const onNsfwToggle = vi.fn();

            // Render with NSFW revealed = false
            const { container: container1, rerender } = render(
                <MediaAttachment
                    media={media}
                    isSensitive={true}
                    nsfwRevealed={false}
                    onNsfwToggle={onNsfwToggle}
                />
            );
            expect(container1.firstChild).not.toBeNull();

            // Rerender with NSFW revealed = true (simulating toggle)
            rerender(
                <MediaAttachment
                    media={media}
                    isSensitive={true}
                    nsfwRevealed={true}
                    onNsfwToggle={onNsfwToggle}
                />
            );
            expect(container1.firstChild).not.toBeNull();
        });

        describe('with onVideoClick', () => {
            it('should render non-NSFW video as button when onVideoClick is provided', () => {
                const media = createMockMedia({
                    type: 'video',
                    url: 'https://example.com/video.mp4',
                    previewUrl: 'https://example.com/video-poster.png',
                    description: 'Test video',
                });
                const onVideoClick = vi.fn();

                const { container } = render(
                    <MediaAttachment
                        media={media}
                        isSensitive={false}
                        nsfwRevealed={false}
                        onVideoClick={onVideoClick}
                    />
                );

                const link = container.querySelector('a[href]');
                expect(link).not.toBeInTheDocument();

                const button = container.querySelector('button');
                expect(button).toBeInTheDocument();
                expect(button).toHaveAttribute('aria-label', 'Test video');
            });

            it('should call onVideoClick when clicking non-NSFW video button', async () => {
                const user = userEvent.setup();
                const media = createMockMedia({
                    type: 'video',
                    url: 'https://example.com/video.mp4',
                    previewUrl: 'https://example.com/video-poster.png',
                    description: 'Test video',
                });
                const onVideoClick = vi.fn();

                render(
                    <MediaAttachment
                        media={media}
                        isSensitive={false}
                        nsfwRevealed={false}
                        onVideoClick={onVideoClick}
                    />
                );

                const button = screen.getByRole('button', { name: 'Test video' });
                await user.click(button);

                expect(onVideoClick).toHaveBeenCalledTimes(1);
            });

            it('should render NSFW revealed video as button when onVideoClick is provided', () => {
                const media = createMockMedia({
                    type: 'video',
                    url: 'https://example.com/video.mp4',
                    previewUrl: 'https://example.com/video-poster.png',
                    description: 'NSFW video',
                });
                const onNsfwToggle = vi.fn();
                const onVideoClick = vi.fn();

                const { container } = render(
                    <MediaAttachment
                        media={media}
                        isSensitive={true}
                        nsfwRevealed={true}
                        onNsfwToggle={onNsfwToggle}
                        onVideoClick={onVideoClick}
                    />
                );

                const button = container.querySelector('button');
                expect(button).toBeInTheDocument();
                expect(button).toHaveAttribute('aria-label', 'NSFW video');

                const video = container.querySelector('video');
                expect(video).not.toHaveClass('nsfw-blur');
            });

            it('should call onVideoClick when clicking NSFW revealed video button', async () => {
                const user = userEvent.setup();
                const media = createMockMedia({
                    type: 'video',
                    url: 'https://example.com/video.mp4',
                    previewUrl: 'https://example.com/video-poster.png',
                    description: 'NSFW video',
                });
                const onNsfwToggle = vi.fn();
                const onVideoClick = vi.fn();

                render(
                    <MediaAttachment
                        media={media}
                        isSensitive={true}
                        nsfwRevealed={true}
                        onNsfwToggle={onNsfwToggle}
                        onVideoClick={onVideoClick}
                    />
                );

                const button = screen.getByRole('button', { name: 'NSFW video' });
                await user.click(button);

                expect(onVideoClick).toHaveBeenCalledTimes(1);
                expect(onNsfwToggle).not.toHaveBeenCalled();
            });

            it('should call onNsfwToggle when clicking NSFW blur state video button', async () => {
                const user = userEvent.setup();
                const media = createMockMedia({
                    type: 'video',
                    url: 'https://example.com/video.mp4',
                    previewUrl: 'https://example.com/video-poster.png',
                });
                const onNsfwToggle = vi.fn();
                const onVideoClick = vi.fn();

                render(
                    <MediaAttachment
                        media={media}
                        isSensitive={true}
                        nsfwRevealed={false}
                        onNsfwToggle={onNsfwToggle}
                        onVideoClick={onVideoClick}
                    />
                );

                const button = screen.getByRole('button', { name: '閲覧注意の動画を表示' });
                await user.click(button);

                expect(onNsfwToggle).toHaveBeenCalledTimes(1);
                expect(onVideoClick).not.toHaveBeenCalled();
            });
        });
    });

    describe('gifv rendering', () => {
        it('should render non-NSFW gifv as anchor tag with autoplay', () => {
            const media = createMockMedia({
                type: 'gifv',
                url: 'https://example.com/animation.mp4',
                previewUrl: 'https://example.com/animation-poster.png',
                description: 'Test animation',
            });

            const { container } = render(
                <MediaAttachment media={media} isSensitive={false} nsfwRevealed={false} />
            );

            const link = container.querySelector('a[href="https://example.com/animation.mp4"]');
            expect(link).toBeInTheDocument();
            expect(link).toHaveAttribute('target', '_blank');
            expect(link).toHaveAttribute('rel', 'noopener noreferrer');
            expect(link).toHaveAttribute('aria-label', 'Test animation');

            const video = container.querySelector('video');
            expect(video).toBeInTheDocument();
            expect(video).not.toHaveAttribute('autoPlay');
            expect(video).toHaveAttribute('loop');
        });

        it('should render non-NSFW gifv without valid URL as static poster image', () => {
            const media = createMockMedia({
                type: 'gifv',
                url: undefined,
                previewUrl: 'https://example.com/animation-poster.png',
            });

            const { container } = render(
                <MediaAttachment media={media} isSensitive={false} nsfwRevealed={false} />
            );

            // Should render img with previewUrl when url is missing
            const img = container.querySelector('img');
            expect(img).toBeInTheDocument();
            expect(img).toHaveAttribute('src', 'https://example.com/animation-poster.png');
        });

        it('should render NSFW gifv as button with blur (no autoplay)', () => {
            const media = createMockMedia({
                type: 'gifv',
                url: 'https://example.com/animation.mp4',
                previewUrl: 'https://example.com/animation-poster.png',
            });
            const onNsfwToggle = vi.fn();

            const { container } = render(
                <MediaAttachment
                    media={media}
                    isSensitive={true}
                    nsfwRevealed={false}
                    onNsfwToggle={onNsfwToggle}
                />
            );

            const button = screen.getByRole('button', { name: '閲覧注意のGIFを表示' });
            expect(button).toBeInTheDocument();

            const video = container.querySelector('video');
            expect(video).toHaveClass('nsfw-blur');
            expect(video).not.toHaveAttribute('autoPlay');

            const overlay = container.querySelector('div.nsfw-blur-overlay');
            expect(overlay).toBeInTheDocument();
            expect(overlay).toHaveTextContent('閲覧注意');
        });

        it('should not render NSFW gifv without valid preview URL', () => {
            const media = createMockMedia({
                type: 'gifv',
                url: 'https://example.com/animation.mp4',
                previewUrl: undefined,
            });
            const onNsfwToggle = vi.fn();

            const { container } = render(
                <MediaAttachment
                    media={media}
                    isSensitive={true}
                    nsfwRevealed={false}
                    onNsfwToggle={onNsfwToggle}
                />
            );

            expect(container.firstChild).toBeNull();
        });

        it('should call onNsfwToggle when clicking NSFW gifv', async () => {
            const user = userEvent.setup();
            const media = createMockMedia({
                type: 'gifv',
                url: 'https://example.com/animation.mp4',
                previewUrl: 'https://example.com/animation-poster.png',
            });
            const onNsfwToggle = vi.fn();

            render(
                <MediaAttachment
                    media={media}
                    isSensitive={true}
                    nsfwRevealed={false}
                    onNsfwToggle={onNsfwToggle}
                />
            );

            const button = screen.getByRole('button', { name: '閲覧注意のGIFを表示' });
            await user.click(button);

            expect(onNsfwToggle).toHaveBeenCalledTimes(1);
        });

        it('should render NSFW gifv with only previewUrl (no url)', () => {
            const media = createMockMedia({
                type: 'gifv',
                url: undefined,
                previewUrl: 'https://example.com/animation-poster.png',
            });
            const onNsfwToggle = vi.fn();

            const { container } = render(
                <MediaAttachment
                    media={media}
                    isSensitive={true}
                    nsfwRevealed={false}
                    onNsfwToggle={onNsfwToggle}
                />
            );

            const button = container.querySelector('button');
            expect(button).toBeInTheDocument();
        });

        it('should render non-NSFW gifv with only previewUrl as static image', () => {
            const media = createMockMedia({
                type: 'gifv',
                url: undefined,
                previewUrl: 'https://example.com/animation-poster.png',
            });
            const onNsfwToggle = vi.fn();

            const { container } = render(
                <MediaAttachment
                    media={media}
                    isSensitive={true}
                    nsfwRevealed={true}
                    onNsfwToggle={onNsfwToggle}
                />
            );

            // Should render img with previewUrl when url is missing
            const img = container.querySelector('img');
            expect(img).toBeInTheDocument();
            expect(img).toHaveAttribute('src', 'https://example.com/animation-poster.png');
        });

        it('should maintain gifv visibility when toggling NSFW reveal with only previewUrl', () => {
            const media = createMockMedia({
                type: 'gifv',
                url: undefined,
                previewUrl: 'https://example.com/animation-poster.png',
            });
            const onNsfwToggle = vi.fn();

            // Render with NSFW revealed = false
            const { container: container1, rerender } = render(
                <MediaAttachment
                    media={media}
                    isSensitive={true}
                    nsfwRevealed={false}
                    onNsfwToggle={onNsfwToggle}
                />
            );
            expect(container1.firstChild).not.toBeNull();

            // Rerender with NSFW revealed = true (simulating toggle)
            rerender(
                <MediaAttachment
                    media={media}
                    isSensitive={true}
                    nsfwRevealed={true}
                    onNsfwToggle={onNsfwToggle}
                />
            );
            expect(container1.firstChild).not.toBeNull();
        });

        describe('with onVideoClick', () => {
            it('should render non-NSFW gifv as button when onVideoClick is provided', () => {
                const media = createMockMedia({
                    type: 'gifv',
                    url: 'https://example.com/animation.mp4',
                    previewUrl: 'https://example.com/animation-poster.png',
                    description: 'Test animation',
                });
                const onVideoClick = vi.fn();

                const { container } = render(
                    <MediaAttachment
                        media={media}
                        isSensitive={false}
                        nsfwRevealed={false}
                        onVideoClick={onVideoClick}
                    />
                );

                const link = container.querySelector('a[href]');
                expect(link).not.toBeInTheDocument();

                const button = container.querySelector('button');
                expect(button).toBeInTheDocument();
                expect(button).toHaveAttribute('aria-label', 'Test animation');

                const video = container.querySelector('video') as HTMLVideoElement;
                expect(video).not.toHaveAttribute('autoPlay');
                expect(video).toHaveAttribute('loop');
                expect(video.muted).toBe(true);
            });

            it('should call onVideoClick when clicking non-NSFW gifv button', async () => {
                const user = userEvent.setup();
                const media = createMockMedia({
                    type: 'gifv',
                    url: 'https://example.com/animation.mp4',
                    previewUrl: 'https://example.com/animation-poster.png',
                    description: 'Test animation',
                });
                const onVideoClick = vi.fn();

                render(
                    <MediaAttachment
                        media={media}
                        isSensitive={false}
                        nsfwRevealed={false}
                        onVideoClick={onVideoClick}
                    />
                );

                const button = screen.getByRole('button', { name: 'Test animation' });
                await user.click(button);

                expect(onVideoClick).toHaveBeenCalledTimes(1);
            });

            it('should render NSFW revealed gifv as button when onVideoClick is provided', () => {
                const media = createMockMedia({
                    type: 'gifv',
                    url: 'https://example.com/animation.mp4',
                    previewUrl: 'https://example.com/animation-poster.png',
                    description: 'NSFW animation',
                });
                const onNsfwToggle = vi.fn();
                const onVideoClick = vi.fn();

                const { container } = render(
                    <MediaAttachment
                        media={media}
                        isSensitive={true}
                        nsfwRevealed={true}
                        onNsfwToggle={onNsfwToggle}
                        onVideoClick={onVideoClick}
                    />
                );

                const button = container.querySelector('button');
                expect(button).toBeInTheDocument();
                expect(button).toHaveAttribute('aria-label', 'NSFW animation');

                const video = container.querySelector('video');
                expect(video).not.toHaveClass('nsfw-blur');
                expect(video).not.toHaveAttribute('autoPlay');
                expect(video).toHaveAttribute('loop');
            });

            it('should call onVideoClick when clicking NSFW revealed gifv button', async () => {
                const user = userEvent.setup();
                const media = createMockMedia({
                    type: 'gifv',
                    url: 'https://example.com/animation.mp4',
                    previewUrl: 'https://example.com/animation-poster.png',
                    description: 'NSFW animation',
                });
                const onNsfwToggle = vi.fn();
                const onVideoClick = vi.fn();

                render(
                    <MediaAttachment
                        media={media}
                        isSensitive={true}
                        nsfwRevealed={true}
                        onNsfwToggle={onNsfwToggle}
                        onVideoClick={onVideoClick}
                    />
                );

                const button = screen.getByRole('button', { name: 'NSFW animation' });
                await user.click(button);

                expect(onVideoClick).toHaveBeenCalledTimes(1);
                expect(onNsfwToggle).not.toHaveBeenCalled();
            });

            it('should call onNsfwToggle when clicking NSFW blur state gifv button', async () => {
                const user = userEvent.setup();
                const media = createMockMedia({
                    type: 'gifv',
                    url: 'https://example.com/animation.mp4',
                    previewUrl: 'https://example.com/animation-poster.png',
                });
                const onNsfwToggle = vi.fn();
                const onVideoClick = vi.fn();

                render(
                    <MediaAttachment
                        media={media}
                        isSensitive={true}
                        nsfwRevealed={false}
                        onNsfwToggle={onNsfwToggle}
                        onVideoClick={onVideoClick}
                    />
                );

                const button = screen.getByRole('button', { name: '閲覧注意のGIFを表示' });
                await user.click(button);

                expect(onNsfwToggle).toHaveBeenCalledTimes(1);
                expect(onVideoClick).not.toHaveBeenCalled();
            });
        });
    });

    describe('accessibility', () => {
        it('should have correct aria-label for sensitive images', () => {
            const media = createMockMedia({ type: 'image' });
            const onNsfwToggle = vi.fn();

            render(
                <MediaAttachment
                    media={media}
                    isSensitive={true}
                    nsfwRevealed={false}
                    imageIndex={0}
                    totalImages={3}
                    onNsfwToggle={onNsfwToggle}
                />
            );

            const button = screen.getByRole('button', { name: /閲覧注意の画像を表示 \(1\/3\)/ });
            expect(button).toBeInTheDocument();
        });

        it('should have correct aria-label for non-sensitive images with description', () => {
            const media = createMockMedia({
                type: 'image',
                description: 'Beautiful sunset',
            });

            render(
                <MediaAttachment
                    media={media}
                    isSensitive={false}
                    nsfwRevealed={false}
                    imageIndex={0}
                    totalImages={3}
                    onImageClick={() => {}}
                />
            );

            const button = screen.getByRole('button', { name: 'Beautiful sunset' });
            expect(button).toBeInTheDocument();
        });

        it('should have correct aria-label for images without description', () => {
            const media = createMockMedia({
                type: 'image',
                description: undefined,
            });

            render(
                <MediaAttachment
                    media={media}
                    isSensitive={false}
                    nsfwRevealed={false}
                    imageIndex={1}
                    totalImages={2}
                    onImageClick={() => {}}
                />
            );

            const button = screen.getByRole('button', { name: /画像を拡大 \(2\/2\)/ });
            expect(button).toBeInTheDocument();
        });

        it('should set aria-hidden and tabIndex=-1 for decorative video elements', () => {
            const media = createMockMedia({
                type: 'gifv',
                url: 'https://example.com/animation.mp4',
                previewUrl: 'https://example.com/animation-poster.png',
            });

            const { container } = render(
                <MediaAttachment media={media} isSensitive={false} nsfwRevealed={false} />
            );

            const video = container.querySelector('video');
            expect(video).toHaveAttribute('aria-hidden', 'true');
            expect(video).toHaveAttribute('tabIndex', '-1');
        });
    });

    describe('unknown media types', () => {
        it('should return null for unknown media type', () => {
            const media = createMockMedia({
                type: 'unknown' as mastodon.v1.MediaAttachment['type'],
            });

            const { container } = render(
                <MediaAttachment media={media} isSensitive={false} nsfwRevealed={false} />
            );

            expect(container.firstChild).toBeNull();
        });
    });

    describe('URL validation', () => {
        it('should handle null url and null previewUrl for image', () => {
            const media = createMockMedia({
                type: 'image',
                url: undefined,
                previewUrl: undefined,
            });

            const { container } = render(
                <MediaAttachment media={media} isSensitive={false} nsfwRevealed={false} />
            );

            expect(container.firstChild).toBeNull();
        });

        it('should handle empty string url for image', () => {
            const media = createMockMedia({
                type: 'image',
                url: '',
                previewUrl: '',
            });

            const { container } = render(
                <MediaAttachment media={media} isSensitive={false} nsfwRevealed={false} />
            );

            expect(container.firstChild).toBeNull();
        });
    });

    describe('variant-specific overlay text sizing', () => {
        it('should use text-xs for compact variant NSFW overlay', () => {
            const media = createMockMedia({
                type: 'image',
                url: 'https://example.com/image.png',
                previewUrl: 'https://example.com/preview.png',
            });
            const onNsfwToggle = vi.fn();

            const { container } = render(
                <MediaAttachment
                    media={media}
                    variant="compact"
                    isSensitive={true}
                    nsfwRevealed={false}
                    onNsfwToggle={onNsfwToggle}
                />
            );

            const overlay = container.querySelector('.nsfw-blur-overlay span');
            expect(overlay).toHaveClass('text-xs');
            expect(overlay).not.toHaveClass('text-sm');
        });

        it('should use text-sm for card variant NSFW overlay', () => {
            const media = createMockMedia({
                type: 'image',
                url: 'https://example.com/image.png',
                previewUrl: 'https://example.com/preview.png',
            });
            const onNsfwToggle = vi.fn();

            const { container } = render(
                <MediaAttachment
                    media={media}
                    variant="card"
                    isSensitive={true}
                    nsfwRevealed={false}
                    onNsfwToggle={onNsfwToggle}
                />
            );

            const overlay = container.querySelector('.nsfw-blur-overlay span');
            expect(overlay).toHaveClass('text-sm');
            expect(overlay).not.toHaveClass('text-xs');
        });

        it('should use text-sm for detail variant NSFW overlay', () => {
            const media = createMockMedia({
                type: 'image',
                url: 'https://example.com/image.png',
                previewUrl: 'https://example.com/preview.png',
            });
            const onNsfwToggle = vi.fn();

            const { container } = render(
                <MediaAttachment
                    media={media}
                    variant="detail"
                    isSensitive={true}
                    nsfwRevealed={false}
                    onNsfwToggle={onNsfwToggle}
                />
            );

            const overlay = container.querySelector('.nsfw-blur-overlay span');
            expect(overlay).toHaveClass('text-sm');
            expect(overlay).not.toHaveClass('text-xs');
        });

        it('should use text-xs for compact variant NSFW video overlay', () => {
            const media = createMockMedia({
                type: 'video',
                url: 'https://example.com/video.mp4',
                previewUrl: 'https://example.com/preview.png',
            });
            const onNsfwToggle = vi.fn();

            const { container } = render(
                <MediaAttachment
                    media={media}
                    variant="compact"
                    isSensitive={true}
                    nsfwRevealed={false}
                    onNsfwToggle={onNsfwToggle}
                />
            );

            const overlay = container.querySelector('.nsfw-blur-overlay span');
            expect(overlay).toHaveClass('text-xs');
        });
    });

    describe('audio rendering', () => {
        describe('basic rendering', () => {
            it('should render audio player with valid URL in card variant', () => {
                const media = createMockMedia({
                    type: 'audio',
                    url: 'https://example.com/audio.mp3',
                    previewUrl: 'https://example.com/artwork.png',
                    description: 'Test audio',
                });

                const { container } = render(
                    <MediaAttachment
                        media={media}
                        variant="card"
                        isSensitive={false}
                        nsfwRevealed={false}
                    />
                );

                const audio = container.querySelector('audio');
                expect(audio).toBeInTheDocument();
                expect(audio).toHaveAttribute('src', 'https://example.com/audio.mp3');
                expect(audio).toHaveAttribute('controls');
                expect(audio).toHaveAttribute('preload', 'none');
            });

            it('should render audio player in detail variant', () => {
                const media = createMockMedia({
                    type: 'audio',
                    url: 'https://example.com/audio.mp3',
                });

                const { container } = render(
                    <MediaAttachment
                        media={media}
                        variant="detail"
                        isSensitive={false}
                        nsfwRevealed={false}
                    />
                );

                const audio = container.querySelector('audio');
                expect(audio).toBeInTheDocument();
            });

            it('should render controls attribute on audio element', () => {
                const media = createMockMedia({
                    type: 'audio',
                    url: 'https://example.com/audio.mp3',
                });

                const { container } = render(
                    <MediaAttachment media={media} isSensitive={false} nsfwRevealed={false} />
                );

                const audio = container.querySelector('audio');
                expect(audio).toHaveAttribute('controls');
            });

            it('should prioritize url over previewUrl for audio playback', () => {
                const media = createMockMedia({
                    type: 'audio',
                    url: 'https://example.com/audio.mp3',
                    previewUrl: 'https://example.com/artwork.png',
                });

                const { container } = render(
                    <MediaAttachment media={media} isSensitive={false} nsfwRevealed={false} />
                );

                const audio = container.querySelector('audio');
                expect(audio).toHaveAttribute('src', 'https://example.com/audio.mp3');
                expect(audio).not.toHaveAttribute('src', 'https://example.com/artwork.png');
            });

            it('should return null for invalid URL', () => {
                const media = createMockMedia({
                    type: 'audio',
                    url: undefined,
                    previewUrl: undefined,
                });

                const { container } = render(
                    <MediaAttachment media={media} isSensitive={false} nsfwRevealed={false} />
                );

                expect(container.firstChild).toBeNull();
            });

            it('should use remoteUrl as fallback when url is missing', () => {
                const media = createMockMedia({
                    type: 'audio',
                    url: undefined,
                    remoteUrl: 'https://example.com/audio.mp3',
                    previewUrl: 'https://example.com/artwork.png',
                });

                const { container } = render(
                    <MediaAttachment media={media} isSensitive={false} nsfwRevealed={false} />
                );

                const audio = container.querySelector('audio');
                expect(audio).toHaveAttribute('src', 'https://example.com/audio.mp3');
            });

            it('should display artwork when previewUrl is available', () => {
                const media = createMockMedia({
                    type: 'audio',
                    url: 'https://example.com/audio.mp3',
                    previewUrl: 'https://example.com/artwork.png',
                });

                const { container } = render(
                    <MediaAttachment media={media} isSensitive={false} nsfwRevealed={false} />
                );

                const img = container.querySelector('img');
                expect(img).toBeInTheDocument();
                expect(img).toHaveAttribute('src', 'https://example.com/artwork.png');
            });

            it('should not display artwork when previewUrl is missing', () => {
                const media = createMockMedia({
                    type: 'audio',
                    url: 'https://example.com/audio.mp3',
                    previewUrl: undefined,
                });

                const { container } = render(
                    <MediaAttachment media={media} isSensitive={false} nsfwRevealed={false} />
                );

                const img = container.querySelector('img');
                expect(img).not.toBeInTheDocument();
            });
        });

        describe('compact mode', () => {
            it('should render music icon in compact mode', () => {
                const media = createMockMedia({
                    type: 'audio',
                    url: 'https://example.com/audio.mp3',
                    previewUrl: null, // No artwork - should show music icon
                });

                const { container } = render(
                    <MediaAttachment
                        media={media}
                        variant="compact"
                        isSensitive={false}
                        nsfwRevealed={false}
                    />
                );

                // Find the wrapper div by class
                const wrapperDiv = container.querySelector('div.bg-slate-800');
                expect(wrapperDiv).toBeInTheDocument();
                // Check for music icon (svg)
                const icon = wrapperDiv?.querySelector('svg');
                expect(icon).toBeInTheDocument();
            });

            it('should render artwork thumbnail in compact mode when available', () => {
                const media = createMockMedia({
                    type: 'audio',
                    url: 'https://example.com/audio.mp3',
                    previewUrl: 'https://example.com/artwork.png',
                });

                const { container } = render(
                    <MediaAttachment
                        media={media}
                        variant="compact"
                        isSensitive={false}
                        nsfwRevealed={false}
                    />
                );

                const img = container.querySelector('img');
                expect(img).toBeInTheDocument();
                expect(img).toHaveClass('w-12', 'h-12', 'rounded');
            });

            it('should apply w-12 h-12 classes in compact mode', () => {
                const media = createMockMedia({
                    type: 'audio',
                    url: 'https://example.com/audio.mp3',
                });

                const { container } = render(
                    <MediaAttachment
                        media={media}
                        variant="compact"
                        isSensitive={false}
                        nsfwRevealed={false}
                    />
                );

                const wrapper = container.firstChild as HTMLElement;
                expect(wrapper).toHaveClass('w-12', 'h-12');
            });
        });

        describe('NSFW blur', () => {
            it('should render music icon with blur overlay when NSFW and not revealed', () => {
                const media = createMockMedia({
                    type: 'audio',
                    url: 'https://example.com/audio.mp3',
                });
                const onNsfwToggle = vi.fn();

                const { container } = render(
                    <MediaAttachment
                        media={media}
                        isSensitive={true}
                        nsfwRevealed={false}
                        onNsfwToggle={onNsfwToggle}
                    />
                );

                const button = container.querySelector('button');
                expect(button).toBeInTheDocument();
                expect(button).toHaveAttribute('aria-label', '閲覧注意の音声プレーヤーを表示');

                const icon = container.querySelector('svg');
                expect(icon).toBeInTheDocument();
            });

            it('should render audio player after NSFW reveal', () => {
                const media = createMockMedia({
                    type: 'audio',
                    url: 'https://example.com/audio.mp3',
                });
                const onNsfwToggle = vi.fn();

                const { container } = render(
                    <MediaAttachment
                        media={media}
                        isSensitive={true}
                        nsfwRevealed={true}
                        onNsfwToggle={onNsfwToggle}
                    />
                );

                const audio = container.querySelector('audio');
                expect(audio).toBeInTheDocument();

                const button = container.querySelector('button');
                expect(button).not.toBeInTheDocument();
            });

            it('should call onNsfwToggle when clicking NSFW audio button', async () => {
                const user = userEvent.setup();
                const media = createMockMedia({
                    type: 'audio',
                    url: 'https://example.com/audio.mp3',
                });
                const onNsfwToggle = vi.fn();

                render(
                    <MediaAttachment
                        media={media}
                        isSensitive={true}
                        nsfwRevealed={false}
                        onNsfwToggle={onNsfwToggle}
                    />
                );

                const button = screen.getByRole('button', {
                    name: '閲覧注意の音声プレーヤーを表示',
                });
                await user.click(button);

                expect(onNsfwToggle).toHaveBeenCalledTimes(1);
            });

            it('should return null when NSFW and onNsfwToggle not provided', () => {
                const media = createMockMedia({
                    type: 'audio',
                    url: 'https://example.com/audio.mp3',
                });

                const { container } = render(
                    <MediaAttachment media={media} isSensitive={true} nsfwRevealed={false} />
                );

                expect(container.firstChild).toBeNull();
            });
        });

        describe('accessibility', () => {
            it('should have correct aria-label for audio with description', () => {
                const media = createMockMedia({
                    type: 'audio',
                    url: 'https://example.com/audio.mp3',
                    description: 'Podcast episode',
                });

                const { container } = render(
                    <MediaAttachment media={media} isSensitive={false} nsfwRevealed={false} />
                );

                const audio = container.querySelector('audio');
                expect(audio).toHaveAttribute('aria-label', 'Podcast episode');
            });

            it('should have default aria-label for audio without description', () => {
                const media = createMockMedia({
                    type: 'audio',
                    url: 'https://example.com/audio.mp3',
                    description: undefined,
                });

                const { container } = render(
                    <MediaAttachment media={media} isSensitive={false} nsfwRevealed={false} />
                );

                const audio = container.querySelector('audio');
                expect(audio).toHaveAttribute('aria-label', '音声プレーヤー');
            });

            it('should have correct NSFW aria-label', () => {
                const media = createMockMedia({
                    type: 'audio',
                    url: 'https://example.com/audio.mp3',
                });
                const onNsfwToggle = vi.fn();

                render(
                    <MediaAttachment
                        media={media}
                        isSensitive={true}
                        nsfwRevealed={false}
                        onNsfwToggle={onNsfwToggle}
                    />
                );

                const button = screen.getByRole('button', {
                    name: '閲覧注意の音声プレーヤーを表示',
                });
                expect(button).toBeInTheDocument();
            });
        });

        describe('edge cases', () => {
            it('should return null when both url and previewUrl are empty', () => {
                const media = createMockMedia({
                    type: 'audio',
                    url: '',
                    previewUrl: '',
                });

                const { container } = render(
                    <MediaAttachment media={media} isSensitive={false} nsfwRevealed={false} />
                );

                expect(container.firstChild).toBeNull();
            });

            it('should handle NSFW audio with missing previewUrl', () => {
                const media = createMockMedia({
                    type: 'audio',
                    url: 'https://example.com/audio.mp3',
                    previewUrl: undefined,
                });
                const onNsfwToggle = vi.fn();

                const { container } = render(
                    <MediaAttachment
                        media={media}
                        isSensitive={true}
                        nsfwRevealed={false}
                        onNsfwToggle={onNsfwToggle}
                    />
                );

                const button = container.querySelector('button');
                expect(button).toBeInTheDocument();
                expect(button).toHaveClass('nsfw-blur-container');
            });
        });
    });
});
