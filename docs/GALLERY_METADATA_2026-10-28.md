# Gallery source metadata

Source, complete lot number, country and real view count now occupy a compact
wrapping toolbar above the photograph. Previously absolutely positioned badges
could be hidden behind the positioned image at z-index 1. Moving these facts
outside the image frame avoids photo obstruction and stacking dependencies.

The existing authored country flags are reused with visible names. View counts
use the shared Russian plural helper; no synthetic counts are introduced.
Long unbroken lot numbers wrap within the source column, without ellipsis.

Server-only isolated audit extends verify-auction-gallery.mjs with a 60-digit
lot number and browser hit testing to ensure facts are visible and not covered.
Portrait/landscape, 35 images, keyboard navigation and image-error recovery
remain covered. Use GALLERY_AUDIT_METADATA=1 for separate screenshot output:
/tmp/lewheel-gallery-metadata-20261028/.

Kluster is unavailable; no Kluster review claimed.
