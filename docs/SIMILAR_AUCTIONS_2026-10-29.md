# Similar auction cards

## Requirements for this change

- Preserve the existing LeWheel card layout, palette, dimensions and source photos.
- Keep actual API ranking, same-country selection, prices and navigation unchanged.
- Use theme surfaces in both themes and a neutral fallback for absent/failed photos.
- Keep the complete source image visible and the media slot at 150px.
- Localize the canonical body labels and gas fuel label without inventing facts.
- Retain keyboard links/focus; gate pointer motion and respect reduced motion.

## Implementation and review scope

AuctionSimilarMedia owns only image rendering/error presentation. Failure is
keyed to the requested URL; the parent still validates and normalizes media URLs.
No API, database, ranking, dependencies or payment behavior changed.
The arrow inside the navigable card is decorative; the link text names the lot.

Image dimensions are explicit. Existing hover feedback is limited to fine hover
pointers and movement is disabled for reduced-motion users. No new animation
library or decorative entrance is added to this frequently used surface.

The disposable audit covers four real seeded similar records, landscape and
portrait fixtures, 404 and absent photos, actual zero mileage, translated facts,
theme surfaces, keyboard focus and Enter navigation at three widths/both themes.
Screenshots/report: /tmp/lewheel-similar-auctions-20261029/.

Self-review completed; independent standards/spec reviews target the scoped
commit before push. Kluster is unavailable and is not claimed as a check.
