# LeWheel: approved visual direction, 20 October 2026

The owner explicitly chose to preserve and unify the current style, not replace
the site's concept: petrol teal, titanium/metal, copper and realistic 3D scenes.
This is a scoped code review and implementation backlog, not a claim that the
entire site has been redrawn or passed a WCAG/visual-regression audit.

## Existing visual authority

| Layer | Authoritative implementation | Preserve |
| --- | --- | --- |
| Palette and components | `src/theme/theme.ts`, `src/app/component-materials.css` | Teal primary controls, copper partner CTA, semantic red for danger, light/dark surfaces |
| Decorative 3D | `src/components/ui/ServiceArtwork.tsx` | Shared 320/640 WebP variants, explicit size, decorative alt, lazy loading |
| Scenic widgets | `src/components/ui/ScenicBanner.tsx`, `src/app/scenic-widgets.css` | Compact rectangles, left text/actions, blended imagery, real HTML controls |
| Navigation | `src/lib/navigation-registry.ts` | Stable labels, URLs and active-state contract shared by site/account/Mini App |
| Navigation icons | `src/components/layout/AppHeader.tsx` | Tabler line icons at functional sizes, not large decorative renders |
| Sidebar widgets | `src/components/sidebar/` | Shared compact density; consistent heading and content hierarchy |

## Findings and next implementation batches

- [x] P2: `scenic-widgets.css` repeats literal scene/foreground/link/copper values
  while `component-materials.css` and Mantine maintain parallel palette tokens.
  Extract semantic scene tokens without recoloring approved artwork or masks.
  Benefit: a controlled palette adjustment no longer leaves old colors in a
  sidebar, banner or helper link. Mask black/transparent values are technical,
  not brand-color defects.
  Implemented through `--lw-scene-*`, `--lw-widget-heading-*` and the stable
  enamel base in the existing material sheet. Server before/after matrix:
  `scripts/verify-scenic-materials.mjs` covers 16 rendered views across home,
  services, garage and subscriptions in both themes and device sizes. This
  checks computed material parity, not pixel-level visual diffs of all pages.
- [ ] P2: document common navigation icon sizes/stroke and CTA density. Header
  maps currently use 14px and 15px icons for different contexts; this is not
  itself an accessibility defect. Verify perceived weight and touch hit areas
  in real desktop/mobile screenshots before changing them.
- [ ] P2: review each shared artwork consumer, then remaining service/account
  panels, for duplicate headings, excess height and cropped subjects. The
  shared banner already has scene-specific focal positions; do not erase
  those corrections with a blanket image-position rule.
- [ ] P2: collect a repeatable screenshot matrix: home, vehicle and part
  catalogue/detail, auction, services, account, partner and Mini App; light and
  dark, desktop and mobile. Compare before/after per shared-component batch.
- [ ] P2: measure contrast and keyboard focus with real computed colors.
  A code-only palette review cannot establish WCAG conformance.
- [ ] P3: harmonize motion through the existing tokens, preserve reduced-motion
  and hover/pointer gates. Animate feedback/state changes, not every row or
  navigation click. Never put large bitmap buttons in place of real controls.

## Verified positives and scope

The shared art component fixes dimensions and uses decorative alt text; the
navigation has a typed central registry; theme-aware material tokens already
exist. The Impeccable mechanical detector returned no findings for
`src/components/layout`, `ServiceArtwork.tsx` and `scenic-widgets.css` in this
pass. That result does not cover every page or prove visual consistency.

No design health score is assigned without rendered contrast/responsive
measurements. Product-wide illustration generation and UI replacement are
still pending. Start with token and component consistency, then redraw only
the asset gaps exposed by the screenshot matrix. This retains the style the
owner approved instead of rebuilding functioning navigation for decoration.
