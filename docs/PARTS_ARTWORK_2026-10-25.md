# Parts category artwork — 2026-10-25

## Scope
Five main parts categories now share compact illustrated headings and 28px sidebar identities.
The engine reuses the original dedicated engine illustration; brakes, suspension,
electrical and lighting have new original transparent artwork. The shared
`PartCategoryArtwork` component owns only decoration; HTML owns headings,
destinations, counts and keyboard interaction. Other categories remain unchanged.
Sidebar active state now recognizes canonical category paths and typed search URLs.
The category search action uses the shared enamel material, a 44px touch target
and a visible keyboard focus ring instead of default browser link styling.

## Assets and visual analysis
Built-in image generation was used, not the CLI. Four separate assets were generated.
The first lighting image received one background-extraction edit before selection.
A brake rotor/caliper, coilover, battery and headlamp use petrol enamel, brushed
titanium and restrained copper. Each subject is fully contained, not cropped.
The headlamp retains soft edge lighting; it is decorative, not a factual product photo.
No logo, seller photo or listing data is replaced.
Masters: `D:/Проекты/Авторынок/output/parts-art-20261025/{brakes,suspension,electrical,lighting}.png`.
Public assets: `public/images/ui/category-v1/{name}-{320,640}.webp`.
Engine: existing `parts-320.webp`. Browser screenshots:
`D:/Проекты/Авторынок/output/parts-art-20261025/screenshots/`.

## Final prompt set
### brakes
Use case: stylized-concept. Asset: original decorative automotive parts category illustration for LeWheel website, readable at small sizes. Photorealistic premium 3D product render, petrol teal enamel #08535f, brushed titanium, restrained warm copper #d5a27e fasteners. Genuinely transparent background, no floor, no plate, no scene, no lettering, no brands, no watermark, no glow. One coherent object centered, three-quarter view, fully contained with 10 percent transparent padding, controlled soft studio reflections, crisp silhouette. Subject: one complete automotive ventilated brake rotor with a petrol-teal fixed caliper hugging its right edge; realistic circular machined steel friction surface, drilled bolt holes and subtle copper hardware. Rotor face towards viewer, slight perspective, entire assembly visible.

### suspension
Use case: stylized-concept. Asset: original decorative automotive parts category illustration for LeWheel website, readable at small sizes. Photorealistic premium 3D product render, petrol teal enamel #08535f, brushed titanium, restrained warm copper #d5a27e fasteners. Genuinely transparent background, no floor, no plate, no scene, no lettering, no brands, no watermark, no glow. One coherent object centered, three-quarter view, fully contained with 10 percent transparent padding, controlled soft studio reflections, crisp silhouette. Subject: one automotive coilover shock absorber diagonally tilted from lower left to upper right, titanium damper cylinder, petrol-teal coil spring with clearly separated coils, copper adjustment collar, both mounting ends fully visible. No other parts.

### electrical
Use case: stylized-concept. Asset: original decorative automotive parts category illustration for LeWheel website, readable at small sizes. Photorealistic premium 3D product render, petrol teal enamel #08535f, brushed titanium, restrained warm copper #d5a27e fasteners. Genuinely transparent background, no floor, no plate, no scene, no lettering, no brands, no watermark, no glow. One coherent object centered, three-quarter view, fully contained with 10 percent transparent padding, controlled soft studio reflections, crisp silhouette. Subject: one automotive starter battery, dark petrol-teal casing, brushed titanium top handle and two clearly separated metal terminal posts with restrained copper collars. Realistic chunky battery proportions, no labels or symbols, full battery visible, three-quarter front view.

### lighting
Use case: stylized-concept. Asset: original decorative automotive parts category illustration for LeWheel website, readable at small sizes. Photorealistic premium 3D product render, petrol teal enamel #08535f, brushed titanium, restrained warm copper #d5a27e fasteners. Genuinely transparent background, no floor, no plate, no scene, no lettering, no brands, no watermark, no glow. One coherent object centered, three-quarter view, fully contained with 10 percent transparent padding, controlled soft studio reflections, crisp silhouette. Subject: one modern automotive LED headlamp assembly with clear glass cover, intricate titanium projector lenses and reflectors inside a petrol-teal housing, restrained copper fasteners. Full asymmetrical horizontal headlight visible, front three-quarter view; lights switched off so lenses remain detailed, no light beams.

### Lighting extraction edit
Background extraction: preserve this complete automotive headlight, its glass, metallic details, teal housing and copper fasteners exactly. Remove ALL backdrop and ALL smoky gray glow surrounding the headlight. Output a clean object cutout on genuinely transparent background, including every mounting bracket. No replacement floor, no shadow, no halo, no new text or logos.

## Verification
Server-only TypeScript, scoped ESLint and production build precede deployment.
The existing category browser matrix now also covers all five parts landing pages
on mobile/desktop, light/dark: loaded transparent artwork, compact headings,
no horizontal overflow, original subcategory links, sidebar selection,
keyboard access and the actual transition to the typed search URL.
It uses a disposable audit database, never production account or listing writes.
TypeScript and the production build passed. Scoped ESLint had zero errors and
one pre-existing unused `roleColor` warning in the account shell.
The first pass cleared 800 browser/asset assertions; the final pass cleared 820,
including action material and touch-size checks. The 320px new files are 13,820–23,230
bytes. Kluster tools were unavailable; no Kluster review is claimed.
