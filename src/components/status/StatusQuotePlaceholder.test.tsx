import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusQuotePlaceholder } from './StatusQuotePlaceholder';
import type { mastodon } from 'masto';

describe('StatusQuotePlaceholder', () => {
    describe('non-accepted states', () => {
        it('renders pending message', () => {
            render(<StatusQuotePlaceholder state="pending" />);
            expect(screen.getByText('引用の承認待ち')).toBeInTheDocument();
        });

        it('renders rejected message', () => {
            render(<StatusQuotePlaceholder state="rejected" />);
            expect(screen.getByText('引用が拒否されました')).toBeInTheDocument();
        });

        it('renders revoked message', () => {
            render(<StatusQuotePlaceholder state="revoked" />);
            expect(screen.getByText('引用が取り消されました')).toBeInTheDocument();
        });

        it('renders deleted message', () => {
            render(<StatusQuotePlaceholder state="deleted" />);
            expect(screen.getByText('引用元の投稿が削除されました')).toBeInTheDocument();
        });

        it('renders unauthorized message', () => {
            render(<StatusQuotePlaceholder state="unauthorized" />);
            expect(screen.getByText('引用する権限がありません')).toBeInTheDocument();
        });

        it('renders blocked_account message', () => {
            render(<StatusQuotePlaceholder state="blocked_account" />);
            expect(screen.getByText('ブロックしたアカウントの投稿です')).toBeInTheDocument();
        });

        it('renders blocked_domain message', () => {
            render(<StatusQuotePlaceholder state="blocked_domain" />);
            expect(screen.getByText('ブロックしたドメインの投稿です')).toBeInTheDocument();
        });

        it('renders muted_account message', () => {
            render(<StatusQuotePlaceholder state="muted_account" />);
            expect(screen.getByText('ミュートしたアカウントの投稿です')).toBeInTheDocument();
        });
    });

    describe('accepted state', () => {
        it('renders nothing for accepted state without isShallow', () => {
            const { container } = render(<StatusQuotePlaceholder state="accepted" />);
            expect(container.firstChild).toBeNull();
        });

        it('renders loading message for accepted state with isShallow', () => {
            render(<StatusQuotePlaceholder state="accepted" isShallow={true} />);
            expect(screen.getByText('引用を読み込み中...')).toBeInTheDocument();
        });
    });

    describe('variant styles', () => {
        it('applies card variant styles by default', () => {
            const { container } = render(<StatusQuotePlaceholder state="pending" />);
            const placeholder = container.firstChild as HTMLElement;
            expect(placeholder).toHaveClass('mt-3');
        });

        it('applies detail variant styles when specified', () => {
            const { container } = render(
                <StatusQuotePlaceholder state="pending" variant="detail" />
            );
            const placeholder = container.firstChild as HTMLElement;
            expect(placeholder).toHaveClass('mt-4');
        });
    });

    describe('icons', () => {
        it('shows clock icon for pending state', () => {
            const { container } = render(<StatusQuotePlaceholder state="pending" />);
            // LuClock renders an SVG
            const svg = container.querySelector('svg');
            expect(svg).toBeInTheDocument();
        });

        it('shows ban icon for rejected state', () => {
            const { container } = render(<StatusQuotePlaceholder state="rejected" />);
            const svg = container.querySelector('svg');
            expect(svg).toBeInTheDocument();
        });

        it('shows trash icon for deleted state', () => {
            const { container } = render(<StatusQuotePlaceholder state="deleted" />);
            const svg = container.querySelector('svg');
            expect(svg).toBeInTheDocument();
        });

        it('shows loading spinner for accepted shallow quote', () => {
            const { container } = render(
                <StatusQuotePlaceholder state="accepted" isShallow={true} />
            );
            const svg = container.querySelector('svg');
            expect(svg).toHaveClass('animate-spin');
        });
    });
});
