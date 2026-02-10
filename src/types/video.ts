/**
 * Video type definitions shared between components and utilities
 */

export interface VideoViewerVideo {
    url: string;
    previewUrl?: string;
    description?: string;
    type: 'video' | 'gifv';
}
