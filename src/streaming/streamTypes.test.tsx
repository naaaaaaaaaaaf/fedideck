import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { getStreamDisplayName, getStreamIcon, type StreamConfig } from './streamTypes';

describe('getStreamDisplayName', () => {
    it('should return "ホーム" for home stream', () => {
        const config: StreamConfig = { type: 'home' };
        expect(getStreamDisplayName(config)).toBe('ホーム');
    });

    it('should return "通知" for notifications stream', () => {
        const config: StreamConfig = { type: 'notifications' };
        expect(getStreamDisplayName(config)).toBe('通知');
    });

    it('should return "連合タイムライン" for public stream', () => {
        const config: StreamConfig = { type: 'public' };
        expect(getStreamDisplayName(config)).toBe('連合タイムライン');
    });

    it('should return "ローカルタイムライン" for public:local stream', () => {
        const config: StreamConfig = { type: 'public:local' };
        expect(getStreamDisplayName(config)).toBe('ローカルタイムライン');
    });

    it('should return "リスト" for list stream', () => {
        const config: StreamConfig = { type: 'list', listId: '123' };
        expect(getStreamDisplayName(config)).toBe('リスト');
    });

    it('should return hashtag name with # prefix for hashtag stream', () => {
        const config: StreamConfig = { type: 'hashtag', hashtag: 'typescript' };
        expect(getStreamDisplayName(config)).toBe('#typescript');
    });

    it('should return "#undefined" when hashtag is not set', () => {
        const config: StreamConfig = { type: 'hashtag' };
        expect(getStreamDisplayName(config)).toBe('#undefined');
    });
});

describe('getStreamIcon', () => {
    it('should render LuHouse icon for home stream', () => {
        const { container } = render(<>{getStreamIcon('home')}</>);
        expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should render LuBell icon for notifications stream', () => {
        const { container } = render(<>{getStreamIcon('notifications')}</>);
        expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should render LuGlobe icon for public stream', () => {
        const { container } = render(<>{getStreamIcon('public')}</>);
        expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should render LuUsers icon for public:local stream', () => {
        const { container } = render(<>{getStreamIcon('public:local')}</>);
        expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should render LuList icon for list stream', () => {
        const { container } = render(<>{getStreamIcon('list')}</>);
        expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should render LuHash icon for hashtag stream', () => {
        const { container } = render(<>{getStreamIcon('hashtag')}</>);
        expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should render different icons for each stream type', () => {
        const types = ['home', 'notifications', 'public', 'public:local', 'list', 'hashtag'] as const;
        const icons = types.map(type => {
            const { container } = render(<>{getStreamIcon(type)}</>);
            return container.innerHTML;
        });

        // All icons should be unique
        const uniqueIcons = new Set(icons);
        expect(uniqueIcons.size).toBe(types.length);
    });
});
