# LeWheel catalog artwork

## Visual references

ImageGen produced two separate section references. The parts reference puts
a daylight product photo above a readable Cyrillic title, a compact part
selection hint and a directional control. The home reference shows seven
photo links, with the passenger-car tile spanning two rows at desktop widths.
The site retains its existing typography and navigation. The cards use petrol
teal and restrained copper accents with a matte caption surface.

## Production asset briefs

The product set shows each entire item on a clean service bench, with diffuse
daylight, realistic metal and rubber, petrol teal accents and clear crop
margins. The photograph carries no lettering. The ten subjects are a starter
battery, disc brake pads, a disc brake rotor, a spin-on oil filter, an engine
air filter, a cabin filter, an inline fuel filter, spark plugs, a coilover and
shock absorber, and a timing belt with tensioner pulleys. Responsive outputs
are stored in `public/images/ui/product-scenes-v2/` at 384 and 640 pixels.

The related search illustrations use the same workshop art direction for a
cylinder head, pistons, crankshaft, brake caliper, suspension control arm,
alternator and rear lamp. The other search links retain compact category art.
Overview thumbnails use right-side crops of the existing engine, brakes,
suspension, electrical and lighting banners. Outputs are stored in
`public/images/ui/part-query-scenes-v2/`.

Four new directional photographs show a compact excavator, leisure motorboat,
civilian light aircraft and turbocharger. The brief keeps the object to the
right with open space for the title to the left. Cars, motorcycles and trucks
use the existing approved photographs. Outputs are stored in
`public/images/ui/catalog-directions-v2/`; the three new transport banners
are in `public/images/ui/catalog-daylight-v1/`.

The browser audits validate decoded artwork, proportional media frames,
accessible names, original filter and link targets, and mobile overflow.
## Transport panorama and part icon follow-up

- Built-in ImageGen transport brief. Full-bleed panoramic editorial daylight photography, a continuous photographed setting across the left third for the title, a large subject center-right, enough margin to show the complete silhouette, teal, copper and stone. Subjects are a sedan and crossover at a glass pavilion, an adventure motorcycle at a mountain overlook, a truck and van at a freight terminal, an excavator in a gravel yard, a cabin boat on a lake, and a propeller plane on a runway.
- Built-in ImageGen part brief. Each category is a row-major sprite atlas of isolated three-dimensional automotive parts on transparent backgrounds. Center each part in its own cell with a clear gutter, consistent lighting and scale, using teal, brushed metal and copper. The order and search labels are in `src/components/parts/part-icon-source.ts`. Rim sizes share a rim icon.
- Exported panoramas to 840, 1320 and 2080px WebP in `public/images/ui/transport-panorama-v1/`. Exported 144px translucent card icons to `public/images/ui/part-icons-v1/`. Related category cards reuse representative part icons.

## Workshop banners and icon motion

The built-in ImageGen workshop brief uses a continuous daylight service bay, an open left third for the heading, and complete parts with room between their edges and the frame. The 16 category subjects follow `PART_TYPES`. The catalog overview groups a complete motor, brake rotor and filters. The responsive 840, 960 and 1600px WebP assets live in `public/images/ui/parts-panorama-v1/`. Phones put the title below the image so it leaves the whole subject visible.

Parts navigation uses each icon's alpha for a 680ms highlight. It starts on its own once per viewport visit and plays one card at a time. The crankshaft rolls around its long axis. Two 24-frame WebP strips animate drive pulleys and links from the existing belt and chain textures. Rebuild them with `node scripts/prepare-part-motion-sprites.mjs`. The strips are decoded on demand. The controller pauses in background tabs, offscreen and when reduced motion is active.
