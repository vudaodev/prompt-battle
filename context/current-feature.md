# Current Feature

<!-- Feature name and short description -->

## Status

Not Started

## Goals

<!-- Goals and requirements -->

## Notes

<!-- Any extra notes -->

## History

<!-- Keep this updated. Earliest to latest -->

| Date | Time (GMT) | Description |
| ---- | ---------- | ----------- |
| 2026-06-20 | 15:10 | Added the encode logo (`06-encode.html`) as a registered target in `manifest.ts` (id `encode`, hard, diffThreshold 0.12). Renamed the file to the `NN-name.html` convention. |
| 2026-06-20 | 16:07 | Fixed phantom square in the encode target render. Root cause (found by bisecting the render in headless Chromium): html2canvas 1.4.1 mis-renders the `.logo` `box-shadow` as a hard square. Removed the box-shadow; restored the radial `.logo::after` sheen with `border-radius: inherit`. Verified clean through the html2canvas path; `npm run build` passes. |
