# Water and air category artwork — 25 October 2026

## Scope and visual analysis

Two standalone illustrations were created with the built-in imagegen tool,
without using the CLI fallback. PNG masters are preserved at
`D:/Проекты/Авторынок/output/marine-air-art-20261025/water.png` and
`D:/Проекты/Авторынок/output/marine-air-art-20261025/air.png`; the original
Codex-generated files are also retained.

The boat has a complete dark-teal hull, cabin, metallic rails and warm trim,
without water or scenery. The jet has a complete nose, wings, tail and landing
gear. The left-facing three-quarter silhouettes, petrol enamel, titanium and
copper match the previous transport illustrations. No HTML headings, counts,
controls or seller facts are baked into the images. These are decorative
category illustrations, not photographs of actual listings.

Both use the existing contained 144×88 desktop / 90×66 mobile art slots.
The seven illustrated categories are now cars, parts, moto, trucks, special,
water and air. No sidebar navigation, real listing media, API semantics,
authentication, database schema or Telegram moderation behavior is changed.
Server preparation checks real transparency and creates 320px/640px WebPs;
large PNG masters are not included in public assets.

## Exact generation prompts

### Water

Use case: product-mockup. Asset type: one standalone decorative 3D category illustration for LeWheel automotive marketplace. Original unbranded vehicle, genuinely transparent background with clean alpha; no floor, pedestal, scenery or studio backdrop. Photorealistic premium commercial product rendering, realistic engineering and materials. Dark petrol teal enamel #08535f, brushed titanium and restrained warm copper #d5a27e trim. Three-quarter front view facing left, complete subject centered within a square canvas with 12 percent transparent margin on every side. Soft warm studio key light with crisp silver highlights for legibility on both white and dark teal interfaces. Strong recognizable silhouette at 120px display size. No text, logos, registration marks, people, watermark, toy proportions, neon, grids or UI. Decorative category artwork, not a real seller listing photograph. Subject: a sophisticated modern compact cabin motorboat with a sleek deep-teal hull, visible full keel and bow, brushed metallic railings, windshield and restrained copper deck trim; dry product cutout with no water, waves or splashes, physically credible hull and cabin proportions

### Air

Use case: product-mockup. Asset type: one standalone decorative 3D category illustration for LeWheel automotive marketplace. Original unbranded vehicle, genuinely transparent background with clean alpha; no floor, pedestal, scenery or studio backdrop. Photorealistic premium commercial product rendering, realistic engineering and materials. Dark petrol teal enamel #08535f, brushed titanium and restrained warm copper #d5a27e trim. Three-quarter front view facing left, complete subject centered within a square canvas with 12 percent transparent margin on every side. Soft warm studio key light with crisp silver highlights for legibility on both white and dark teal interfaces. Strong recognizable silhouette at 120px display size. No text, logos, registration marks, people, watermark, toy proportions, neon, grids or UI. Decorative category artwork, not a real seller listing photograph. Subject: a small modern twin-engine business jet with deep-teal fuselage, titanium wings and restrained copper accents; landing gear down, all wings including both wingtips, tailplanes, tail and nose fully visible, realistic aircraft proportions, no dramatic foreshortening, no runway or sky

## Verification

The server-only category audit covers all seven categories, both themes and
desktop/mobile sizes, image loading, alpha/asset bounds, headings, overflow,
sorting, filters, media fallback and guest favorite/grid/list behavior.
Its listing data is intercepted on a disposable audit server, never written
to production. Type checking, scoped ESLint and production build precede
promotion. Image-to-code kept generation and visual inspection before code;
Impeccable preserves the existing compact hierarchy. Kluster is not available
in this session; no Kluster verification is claimed.

Prepared WebP sizes:

| Asset | 320px | 640px |
|---|---:|---:|
| Water | 18,854 bytes | 52,102 bytes |
| Air | 16,754 bytes | 45,226 bytes |

TypeScript, scoped ESLint, optimized server build and 592 browser/asset
assertions passed before promotion. Screenshot files are preserved beside
the local PNG masters in `screenshots/`.
