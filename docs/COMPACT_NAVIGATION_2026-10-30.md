# Compact sidebar artwork

Preserve the approved existing LeWheel design, artwork, 22px icon frames,
accessible link labels and destinations. Reduce image downloads without
changing category headers, larger widgets or product data.

NavigationArtwork selects 96px derivatives instead of 320px sources.
PartCategoryArtwork selects 96px only when compact; its full-size sources
remain unchanged. Existing navigation-v1 and product-v1 96px images are reused.

The server-only prepare-compact-navigation.mjs script derives thirty images
from the approved category-v1/titanium-v1 sources using the existing sharp
dependency. It retains the full canvas, transparency and aspect ratio without
trimming or cropping. A 96px source covers a 22px display at 4x density.
No new generated illustration, animation, dependency or image host is added.
The original prepare-navigation-artwork.mjs master preparation stays intact.

Measured file totals: 623,584 bytes before, 100,204 bytes after (83.9% smaller).
This compares this set of thirty files, not the entire page or site payload.

The disposable shell audit checks decoded compact sources, fixed frames,
alignment, labels, destinations, mobile navigation, themes and reduced motion.
Screenshots: /tmp/lewheel-sidebar-compact-20261030/.
Typecheck, lint, build and browser checks run only on the server. Review the
scoped diff before push/deploy. Kluster is unavailable and not claimed.
