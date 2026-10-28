# Whole-photo auction detail gallery

Main source image, immediate preview, thumbnail rail and similar-lot photographs
use contain fitting. No source photo is replaced or altered. The gallery frame,
thumbnail surfaces, border and active outline use the existing theme tokens.

Keyboard events are scoped to the gallery region: left/right wrap, Home/End
select first/last. The focusable main frame describes these controls. Selecting
a thumbnail outside the rail viewport updates only horizontal rail scroll;
the page is not scrolled. The existing 30-thumbnail window and source request
warm-up policy remain in place.
Failed thumbnail requests render a neutral icon and track failure separately
from the larger rendition, so a thumbnail failure cannot suppress a valid photo.

Isolated browser audit: `scripts/verify-auction-gallery.mjs`. Disposable record
contains 35 geometric fixtures including portrait, landscape and failed image.
Checks fitting, window bound, keyboard navigation, selected thumbnail visibility,
page-scroll preservation, error recovery and overflow. Three viewports and both
themes. Screenshots are labeled audit fixtures, not live vehicle photos.
Output: `/tmp/lewheel-auction-gallery-20261028/`.

Kluster unavailable; no Kluster review claimed.
