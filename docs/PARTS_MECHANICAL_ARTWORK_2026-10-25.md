# Mechanical parts artwork — 2026-10-25

## Delivered scope
Three original category illustrations: transmission, wheels and cooling.
The existing compact parts header is reused without new CSS or larger banners.
The page chooses its decorative identity by the validated part type, so artwork
is independent of whether a category is included in the five-link sidebar.
All eight illustrated category pages retain real HTML text and search links.
The other eight parts categories still use their existing text-only headers.
This is decorative category artwork, never a substitute for sellers' product photos.

## Source assets
Built-in image generation was used, not the fallback CLI.
Masters: `D:/Проекты/Авторынок/output/parts-mechanical-art-20261025/{transmission,wheels,cooling}.png`.
Optimized WebP variants: `public/images/ui/category-v1/{name}-{320,640}.webp`.
Screenshots: `D:/Проекты/Авторынок/output/parts-mechanical-art-20261025/screenshots/`.

## Visual review
The gearbox has a ribbed metal housing and distinct bell opening; the wheel has
a complete rubber tire and five-spoke titanium/teal rim; the radiator has a
finned core and a visible fan assembly. Petrol enamel and restrained copper
match the existing family. All are displayed with contain sizing, not cropping.
No product specifications or technical fitment claims are derived from the drawings.

## Final prompts
### transmission
Use case: stylized-concept. Asset type: original decorative parts category illustration for LeWheel automotive marketplace, visually matching its petrol teal enamel #08535f, brushed titanium and restrained warm copper #d5a27e. Photorealistic premium 3D product render, crisp readable silhouette at 100 pixels, controlled soft studio lighting. Background genuinely transparent alpha, no scene, no floor, no halo, no smoky glow, no words, logos or watermarks. One object fully visible with generous padding, centered in square composition. Subject: a complete compact automotive transmission gearbox assembly, three-quarter front-side view, ribbed cast titanium housing with petrol teal upper casing and a few copper bolts, clearly visible bell housing and output shaft, mechanically plausible, no exploded parts.

### wheels
Use case: stylized-concept. Asset type: original decorative parts category illustration for LeWheel automotive marketplace, visually matching its petrol teal enamel #08535f, brushed titanium and restrained warm copper #d5a27e. Photorealistic premium 3D product render, crisp readable silhouette at 100 pixels, controlled soft studio lighting. Background genuinely transparent alpha, no scene, no floor, no halo, no smoky glow, no words, logos or watermarks. One object fully visible with generous padding, centered in square composition. Subject: one complete upright car wheel, premium dark black rubber road tire with realistic tread and a brushed titanium five-spoke alloy rim. Petrol teal inner spoke surfaces and restrained copper hub bolts. Three-quarter front view so the circular rim and tire depth both read clearly, entire tire circumference visible. No vehicle, no text or molded brand names.

### cooling
Use case: stylized-concept. Asset type: original decorative parts category illustration for LeWheel automotive marketplace, visually matching its petrol teal enamel #08535f, brushed titanium and restrained warm copper #d5a27e. Photorealistic premium 3D product render, crisp readable silhouette at 100 pixels, controlled soft studio lighting. Background genuinely transparent alpha, no scene, no floor, no halo, no smoky glow, no words, logos or watermarks. One object fully visible with generous padding, centered in square composition. Subject: a complete automotive cooling radiator assembly with a rectangular finned titanium core, petrol teal side tanks, copper pipe connectors, a dark cooling fan in a teal shroud behind the core partially visible from a slight three-quarter angle. Entire radiator and connectors visible, mechanically plausible, no other loose components.

## Verification
Server-only asset preparation validates alpha and writes bounded WebP sizes.
TypeScript, scoped ESLint, production build and the extended disposable browser
matrix run before deployment. The browser matrix covers eight parts landing pages
in both themes on mobile and desktop, including heading artwork, overflow,
original subcategory destinations, keyboard search action and correct typed URLs.
The five main sidebar destinations keep their existing active-state checks.
TypeScript, scoped ESLint and production build passed. The disposable matrix
passed all 934 assertions. The new 320px assets are 23,672–29,984 bytes each;
the 640px variants are 67,678–99,748 bytes. Kluster tools were unavailable,
so no Kluster review is claimed.
