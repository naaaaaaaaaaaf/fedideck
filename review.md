# Code Review Summary

## Findings
- **Medium**: `imageViewerImages` filters out media with empty URLs, but the render loop still uses the full `mediaAttachments` list. This can desync `imageIndex` and `imageViewerImages.length`, leading to wrong indices and labels like `1/0`, or opening the wrong image when some media lack URLs. Align the render list with the filtered list or derive indices from the same filtered array in both `StatusCard` and `StatusDetailModal`. (`src/components/StatusCard.tsx`, `src/components/StatusDetailModal.tsx`)

## Open Questions / Assumptions
- Assumed desired behavior is to skip rendering image buttons when both `url` and `previewUrl` are missing; if placeholders are desired instead, the viewer index logic should handle that explicitly.

## Change Summary
- Adds safe clamping for ImageViewer indices and updates counters accordingly.
- Filters out images with empty URLs when preparing ImageViewer data.
- Adds accessible labels to image buttons in StatusCard and StatusDetailModal.
- (Uncommitted) Adds click-outside-to-close behavior for ImageViewer content area plus a test.

## Tests
- Not run.
