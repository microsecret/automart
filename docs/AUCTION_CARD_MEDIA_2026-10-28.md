# Auction card media fitting

Actual source photographs now use contain fitting in the existing 4:3 media
frame, with no hover zoom. Missing/error/timeout states retain that same ratio
so a failed request does not shrink the photo area. Neutral theme surfaces
remain visible around portrait/wide photos. No generated illustration replaces
a source photograph.

Missing URL: "Фото не добавлено". Failed request or existing eight-second
deadline: "Фото недоступно". Each fallback has one neutral icon and an accurate
accessible label. Other VehicleFallback callers retain the original default.
Country badges reuse the authored vector flags with a visible country name;
source and country badges each have bounded width.
The price disclaimer wraps instead of hiding the shipping/customs exclusion
behind ellipsis on narrow desktop cards.

Verification uses five explicit disposable database records and browser-served
geometric fixtures (landscape, portrait, 404, absent URL, delayed request).
Three viewports, both themes; verifies frame stability, whole-image fitting
including hover, decoded source aspect, labels, badge separation and overflow.
Fixture screenshots are audit evidence, not vehicle photographs or live lots.
Output: /tmp/lewheel-auction-card-media-20261028/.

Kluster tools unavailable; no Kluster review claimed.
