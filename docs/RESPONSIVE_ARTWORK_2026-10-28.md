# Responsive scenic artwork

The approved artwork and composition are preserved. ScenicBanner,
SectionArtworkHeader and scenic parts category headers now use native picture
sources: existing 960px WebP on viewports up to 600px, existing 1600px WebP
elsewhere. No re-encoding, replacement masters or additional dependencies.

Previously every unoptimized Next Image downloaded the 1600px source; its sizes
attribute did not supply an alternate file. The mobile source retains at least
1.6 source pixels per viewport pixel at the 600px boundary. Existing crop,
position, contrast masks, accessible HTML and decorative alt handling remain.

Across the 22 source pairs on disk: 1,670,906 bytes for the large versions and
741,316 bytes for mobile versions (55.6% lower total). This is an asset-set
comparison, not a claim that every page loads all 22 images or a measured LCP.

Server-only verification: verify-responsive-artwork.mjs checks source file pairs,
actual browser currentSrc, absence of duplicate large image requests on mobile,
decoding, section bounds and page overflow at 390/600/820/1560px, both themes.
The mobile matrix uses DPR 2. Account checks use a disposable audit database.
Screenshots and report: /tmp/lewheel-responsive-artwork-20261028.
