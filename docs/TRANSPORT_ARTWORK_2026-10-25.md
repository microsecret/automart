# Transport category artwork — 25 October 2026

## Artwork and implementation

Three standalone original illustrations were generated with the built-in
imagegen tool: a heavy tractor truck, a road motorcycle and a tracked excavator.
Transparent PNG masters are saved outside public assets in
`D:/Проекты/Авторынок/output/transport-art-20261025/{trucks,moto,special}.png`.
Original tool outputs remain preserved under the user's Codex generated-images
directory. This is new decorative category art, not seller photography.

Visual analysis: all three have a recognizable three-quarter silhouette with
the front facing left. The teal enamel body, silver mechanical detail and warm
copper trim match the existing cars/parts family. Transparent margins preserve
wheels, mirrors and the excavator bucket; `object-fit: contain` keeps the whole
subject inside the existing 144×88 desktop / 90×66 mobile artwork area. No text
or logos are baked into the files. The catalogue title, real count, filters,
sort controls, links and listing photographs remain ordinary unchanged HTML/data.

Server-only preparation validates real alpha and creates 320px/640px WebPs.
The original large masters are not served to visitors. The existing compact
illustrated heading now also applies to `/category/moto`, `/category/trucks`
and `/category/special`; cars/parts are retained. Water and air are not claimed
as completed in this batch.

## Prompt set

Common prompt for each independent generation:

> Use case: product-mockup. Asset type: one standalone decorative 3D category
> illustration for LeWheel automotive marketplace. Original unbranded vehicle,
> genuinely transparent background with clean alpha, no floor, no pedestal,
> no studio backdrop. Photorealistic premium commercial product rendering,
> detailed realistic mechanical construction and materials, dark petrol teal
> enamel #08535f, brushed titanium and restrained warm copper #d5a27e trim.
> Three-quarter front view facing left, entire subject visible with generous
> 12 percent clear margin on every side. Landscape-oriented subject centered
> within square canvas. Soft warm key light, crisp silver edge highlights
> readable on both white and dark teal interfaces. Strong recognizable
> silhouette at 120px display size, no text, logos, people, watermark, toy
> proportions, neon, grids or UI. This is decorative category artwork, not an
> image of a real listing.

Subjects appended to the common prompt:

- Trucks: a modern realistic European-style cab-over heavy tractor truck,
  two rear axles, no trailer, substantial dark teal cab, black tires and
  physically credible metallic chassis.
- Moto: a sophisticated modern naked road motorcycle, realistic two wheels,
  dark teal fuel tank, titanium engine and exhaust, restrained copper accents,
  no rider.
- Special: a realistic compact tracked hydraulic excavator, dark petrol teal
  cab and body, titanium hydraulic boom and bucket folded toward the ground,
  black crawler tracks, convincing construction-machine proportions.

## Verification scope

The category browser audit covers all five illustrated categories, both themes
and desktop/mobile layouts, alpha/asset bounds, heading semantics, loaded art,
sorting, filters, missing/broken/loaded listing media and grid/list actions.
Its catalog entries are intercepted fixtures on an isolated server, never
production listings. Type checking, scoped ESLint and a production build run
on the server before promotion. Kluster is unavailable in this session; no
Kluster review is claimed. Image-to-code kept generation/analysis ahead of
implementation; Impeccable preserved the existing compact visual structure.

TypeScript, scoped ESLint, production build and 424 browser/asset assertions
passed. The desktop/mobile screenshot review confirmed all three subjects stay
fully visible on light and dark pages without enlarging the existing slots.

| Asset | 320px WebP | 640px WebP |
|---|---:|---:|
| Moto | 31,980 bytes | 92,086 bytes |
| Trucks | 24,540 bytes | 69,554 bytes |
| Special | 32,062 bytes | 90,896 bytes |

The preparation command retains the old cars/parts default; new categories
can be selected explicitly after the source and output directory arguments.
