# Auction body artwork

Seven original decorative vehicle silhouettes, approved petrol teal / titanium /
copper palette. Generated with the built-in ImageGen tool. Original PNG masters:
`D:/Проекты/Авторынок/output/auction-body-20261028/`.

No generated image replaces a real lot photograph. Visible labels, counts,
top-six distribution and filters remain owned by the existing auction page/API.
Unknown future body types retain a neutral icon fallback.

Server preparation uses existing sharp, checks transparent alpha, trims only
transparent outer margins and contains the entire vehicle within a padded
120x72 or 240x144 WebP frame. Native picture density selection serves the
smaller version at DPR 1 and larger at DPR 2. Fixed contain frames avoid crop
or stretch, and controls retain aria-pressed and visible keyboard focus.

## Prompt set

Prefix: `Use case: product-mockup. One `

Subjects:

- sedan: four-door sedan with a separate rear trunk and three-box silhouette
- hatchback: compact five-door hatchback with short rear overhang and upright rear hatch
- suv: mid-size five-door crossover SUV, raised ride height and tall roof
- wagon: five-door estate station wagon, long extended roof and large rear cargo windows
- coupe: two-door sports coupe with low flowing roof and long doors
- pickup: double-cab pickup truck with clearly visible open cargo bed behind the cab
- minivan: family minivan with tall single-volume cabin and sliding rear doors

Suffix: `. Original generic unbranded automotive product illustration for LeWheel. Photorealistic precise 3D studio render, deep petrol teal enamel #08535f, brushed titanium trim, restrained copper wheel details #d5a27e, realistic black rubber. Front three-quarter view facing left, entire vehicle and all wheels visible. One vehicle only centered on square canvas with generous transparent margins, no crop. Clear accurate body silhouette legible at 100px wide. Soft neutral studio light, genuine transparent background. No floor slab, scenery, frame, text, numbers, logos, badges, smoke, glow or watermark.`

## Verification

`scripts/verify-auction-body-artwork.mjs` seeds only a disposable audit database.
Checks actual API counts, top-six selection and the omitted seventh body through
a direct filter, WebP file weights, DPR selection, image fitting, compact tile
height, mobile rail access, keyboard selection and click-to-clear. Three widths,
both themes. Screenshots contain clearly named audit records, not live lots.
Output: `/tmp/lewheel-auction-body-20261028/`.

Verified result: 240 browser/API/asset checks passed, 12 screenshots across
desktop/tablet/mobile and both themes. All 14 WebP variants total 83,510 bytes;
only one density variant per visible tile is requested by the browser.

Kluster tools unavailable; no Kluster review claimed.
