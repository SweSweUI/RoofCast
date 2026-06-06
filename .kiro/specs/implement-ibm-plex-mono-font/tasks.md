# Implementation Plan: Implement IBM Plex Mono Font

## Overview

This implementation plan applies IBM Plex Mono as the primary font across the entire application. The implementation involves modifying two configuration files: `app/globals.css` for font loading via Google Fonts CDN, and `tailwind.config.ts` for font family configuration. Based on user clarification, IBM Plex Mono will replace BOTH the sans-serif font (primary application font) and the monospace font to ensure consistent typography throughout the application.

## Tasks

- [x] 1. Add IBM Plex Mono font import to globals.css
  - Add `@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');` at the beginning of `app/globals.css`, before the existing `@import 'leaflet/dist/leaflet.css';` statement
  - Ensure the import includes weights 400, 500, 600, and 700 for full typography support
  - Use `display=swap` parameter to prevent Flash of Invisible Text (FOIT)
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. Update Tailwind font configuration for application-wide IBM Plex Mono
  - [x] 2.1 Update fontFamily.sans to use IBM Plex Mono as primary font
    - Modify `tailwind.config.ts` in the `theme.extend.fontFamily.sans` array
    - Set the first element to `'IBM Plex Mono'`
    - Preserve existing fallback fonts: `'ui-sans-serif'`, `'system-ui'`, `'-apple-system'`, `'Segoe UI'`, `'Roboto'`, `'Helvetica'`, `'Arial'`, `'sans-serif'`
    - Final array: `['IBM Plex Mono', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif']`
    - _Requirements: 2.1, 2.2 (adapted for sans font)_

  - [x] 2.2 Update fontFamily.mono to use IBM Plex Mono as primary font
    - Modify `tailwind.config.ts` in the `theme.extend.fontFamily.mono` array
    - Set the first element to `'IBM Plex Mono'`
    - Preserve system monospace fallbacks: `'ui-monospace'`, `'SFMono-Regular'`, `'Menlo'`, `'monospace'`
    - Final array: `['IBM Plex Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [ ]* 2.3 Write unit tests for Tailwind configuration
  - Verify `fontFamily.sans` array has `'IBM Plex Mono'` as first element
  - Verify `fontFamily.mono` array has `'IBM Plex Mono'` as first element
  - Verify fallback chains are correctly ordered
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 3. Verify Roboto font removal
  - Search `app/globals.css` for any `@import` statements containing 'Roboto' and confirm none exist
  - Search `tailwind.config.ts` for any 'Roboto' string references and confirm none exist
  - Search `app/layout.tsx` for any `<link>` elements referencing Google Fonts URLs with 'Roboto' and confirm none exist
  - _Requirements: 4.1, 4.2, 4.4_

- [ ]* 3.1 Write unit tests for Roboto removal verification
  - Test that `globals.css` contains no 'Roboto' in `@import` statements
  - Test that `tailwind.config.ts` contains no 'Roboto' string
  - Test that `app/layout.tsx` contains no font link tags with 'Roboto'
  - _Requirements: 4.1, 4.2, 4.4_

- [ ] 4. Checkpoint - Manual browser testing
  - Open the application in Chrome, Firefox, and Safari
  - Verify IBM Plex Mono renders correctly across all text elements
  - Test with Google Fonts CDN blocked (browser DevTools) to verify fallback fonts work
  - Verify font weights (400, 500, 600, 700) display correctly
  - Check browser console for any font loading errors
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- IBM Plex Mono is applied as the PRIMARY font for the entire application (not just monospace elements)
- Both `fontFamily.sans` and `fontFamily.mono` are updated to ensure consistent typography
- Existing font weights in components are preserved (bold text stays bold)
- Only the font family itself is changed, not weight or style properties
- The implementation uses CSS `@import` for simplicity; future enhancement could use Next.js font optimization for self-hosting
- Manual browser testing (Task 4) verifies integration requirements 3.1-3.5 and 4.3 which test external browser behavior
- No application code changes required - font applies automatically via Tailwind utilities
- Rollback is straightforward: remove the CSS import and revert the two fontFamily arrays in Tailwind config

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "2.2", "3"] },
    { "id": 2, "tasks": ["2.3", "3.1"] },
    { "id": 3, "tasks": ["4"] }
  ]
}
```
