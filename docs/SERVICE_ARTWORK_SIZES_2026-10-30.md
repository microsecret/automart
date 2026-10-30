# Density-aware service artwork

Continue image optimisation while preserving the approved old LeWheel style.
Small help/service illustrations should avoid oversized image downloads;
large illustrations must retain detail. Keep real labels, actions, data,
dimensions, layout, themes, lazy loading and decorative accessibility intact.

ServiceArtwork exposes the existing 96/320/640px approved transparent WebP
variants through native width-descriptor srcset and a declared pixel size.
Its fallback URL retains the original 320/640px rule. A native img is used
because the previous unoptimized Next Image does not generate responsive
candidates. The image remains the direct child for existing card CSS.
Explicit width and height keep space reserved before decoding.

prepare-service-artwork-sizes.mjs checks all typed artwork variants, reuses
existing 96px assets and derives only missing ones from the approved 320px
canvas with the existing sharp dependency. Full canvas, alpha and proportions
are retained. The only new derivative is titanium-v1/parts-96.webp.
No new imagery, image host, animation or dependency is introduced.

The disposable server audit covers four actual public routes (help, selling,
support, services), two themes, 390/1560px viewports and 1x/2x densities.
Fresh browser contexts prevent cached larger candidates masking selection.
It checks currentSrc, decoding, square contain frames, decorative labels,
real destinations, direct-child layout, overflow and per-view unique image
file totals against the previous selection. These totals concern service
artwork only, not full-page network traffic or Core Web Vitals.
Screenshots and measurements: /tmp/lewheel-service-artwork-20261030/.

All typecheck, lint, build and browser execution runs on the server. Review
the scoped diff before release. Kluster is unavailable and not claimed.
