# Catalog details and help artwork — 2026-10-28

## Scope

All six product departments use decorative raster identities for their existing product groups. Eleven new transparent masters cover tools, care, wipers, dashcams, mats, seat covers, compressors, jacks, safety kits, roof racks and jump starters. Existing oils/filters/mechanical artwork remains in use. Five additional catalog-menu entries reuse appropriate identities; all unit labels reserve the same 22px slot. Body, exhaust and steering still await their own artwork.

Four inner help pages reuse the approved compact section header and service identities. Text, warnings, existing moderation wording, destinations and support event are preserved. No change to publication, payment or moderation policy.

## Asset fitting and provenance

Built-in imagegen mode, original unbranded product illustrations, generated source resolution (not native 8K). Selected PNG masters: `D:/Проекты/Авторынок/output/catalog-details-20261028/`. `charger-adapter-unused.png` is an unused first variant, not shipped. Server sharp prepares 96px/192px square transparent WebP canvases with contain fit. Render frame: 52×52px, contain, fixed flex sizing; no cropped objects or distorted aspect ratios. New assets do not overwrite old public artwork.

## Exact prompt set

For each subject below, concatenate this prefix, the subject, and the suffix.

Prefix:

"Use case: product-mockup. Original LeWheel automotive catalog icon: "

Suffix:

. Photorealistic precision 3D studio product render. Deep petrol teal enamel #08535f, dark rubber where appropriate, brushed titanium, restrained copper fittings #d5a27e. Businesslike, realistic automotive materials and clear recognizable silhouette. Centered complete object, three-quarter product view, occupy about 75 percent of a square canvas with equal clear margins on all four sides. Everything fully inside the canvas, no cropped ends. Consistent soft studio illumination and camera scale. Genuinely transparent background, no floor plate, no frame, no scenery, no words, no numbers, no logos, no brands, no watermark, no smoke or glow.

Subjects:

- `tools`: an open compact automotive socket-wrench case, a ratchet and four neatly arranged precision sockets
- `care`: an automotive detailing trigger-spray bottle beside a compact blank metal car-care canister
- `wiper`: two complete automotive windshield wiper blades, one shorter than the other, neatly parallel
- `dashcam`: a compact automotive dashboard camera, visible glass lens, small mounting bracket
- `mats`: two complete automotive floor mats, sculpted rubber channels, subtly different sizes
- `seat-cover`: one complete fitted automotive seat cover shown on a single detached front car seat, headrest included
- `compressor`: a compact portable automotive tire air compressor, coiled hose and a small round analog gauge with no lettering
- `jack`: a complete low-profile automotive hydraulic floor jack, lifting pad and short upright handle
- `safety`: a closed automotive first-aid case with a simple embossed medical cross and folded reflective warning triangle beside it
- `roof-rack`: a complete compact automotive roof luggage rack with two crossbars and a shallow cargo basket

Final charger prompt (replaces the unused first adapter variant):

Use case: product-mockup. Original LeWheel automotive catalog icon: a complete compact automotive jump-start battery pack with a short red cable and red crocodile clamp plus a short black cable and black crocodile clamp, neatly arranged beside the pack; clearly a car battery starter, not a USB or cigarette-lighter adapter. Photorealistic precision 3D studio product render. Deep petrol teal enamel #08535f, dark rubber where appropriate, brushed titanium, restrained copper fittings #d5a27e. Businesslike, realistic automotive materials and clear recognizable silhouette. Centered complete object, three-quarter product view, occupy about 75 percent of a square canvas with equal clear margins on all four sides. Everything fully inside the canvas, no cropped ends. Consistent soft studio illumination and camera scale. Genuinely transparent background, no floor plate, no frame, no scenery, no words, no numbers, no logos, no brands, no watermark, no smoke or glow.

## Verification

`scripts/verify-catalog-details.mjs` runs against the disposable audit server. Six departments plus four help pages, desktop/tablet/mobile and light/dark: image decoding, complete group artwork, fixed frames, label bounds, step alignment, horizontal overflow, catalog menu/Escape, real group URLs, publication destination and support open/close. No support messages are sent. Snapshot/report directory: `/tmp/lewheel-catalog-details-20261028/`.

Kluster tools are unavailable in this session; no Kluster review is claimed.
