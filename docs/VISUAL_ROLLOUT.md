# LeWheel unified visual rollout — 21 October 2026

## Approved visual contract

Preserve the petrol enamel / titanium / copper family and existing realistic
automotive scenes. Do not introduce a second design system or replace real
HTML controls with raster screenshots. The original LeWheel logo, real seller
photos, listing photographs, actual account facts and routes remain intact.
Generated reference text and sample identity data are illustrative, not data
to copy into real user accounts.

- Primary actions: existing teal enamel, 10px control radius.
- Partnership action: existing copper, not a competing blue/purple variant.
- Neutral borders/fields: a titanium/petrol undertone in both themes; values
  live in `component-materials.css`, not per-page copies.
- Navigation: consistent 16px sidebar icons, 1.8 stroke, one accent family.
  Counters, warnings, destructive actions and verification semantics retain
  their own meaningful colours. Brand logos are not navigation icons.
- Identity: teal enamel, copper rim and light, legible monogram text. Existing uploaded
  portraits remain images. First consumers: header, account sidebar, profile
  summary and avatar-upload preview.
- Existing compact scenic rectangles, image focal positions and accessible
  real text/actions are retained, not reset by a universal background rule.

## Completion checklist

- [x] Generate readable navigation/search and identity material references.
- [x] Consolidate shared neutral field/border/focus material tokens.
- [x] Unify sidebar functional icon tone/stroke without recolouring badges.
- [x] Apply shared identity frame to the four initial avatar consumers.
- [x] Retain existing enamel/copper button treatment and real controls.
- [x] Verify the first common-shell batch: final server matrix passed 120
  assertions across 16 views. Release installation is recorded in its log.
- [ ] Review every remaining account page and dialog, including populated,
  loading, empty, validation and failure states, not just headings.
- [ ] Unify seller cards, message participants, forum identities and reviews
  using the same avatar component contract after reviewing those consumers.
- [ ] Review vehicle/part/auction listing cards and detail pages together.
- [ ] Redraw missing service illustrations as original scene-specific assets.
- [ ] Review partner/store tools and all administrator workspaces.
- [ ] Review Mini App and all mobile navigation/drawers/forms on real devices.
- [ ] Remove remaining obsolete literal colour/style overrides by consumer.
- [ ] Complete product-wide accessibility and visual-regression coverage.

These unchecked items are required to call the WHOLE site unified. A common
token change or a few generated mockups do not complete that work.

## Verification and artifacts

`scripts/verify-shell-materials.mjs` uses a disposable audit database, a real
authenticated test user and installed Chromium. It visits home, auctions,
profile and services in light/dark and desktop/mobile (16 views), tests the
material tokens, layout bounds, navigation consistency, avatar treatment and
search focus. External browser requests are blocked. No production users or
listings are changed. This is not a full WCAG conformance claim.

Generated reference images and prompt provenance are saved outside public
assets under `D:/Проекты/Авторынок/output/unified-style-2026-10-21/`.
The interface is implemented in CSS/React; these mockups are not shipped as
page backgrounds or clickable image maps. Actual browser artifacts are under
`/tmp/lewheel-shell-materials-20261021` on the server.

The initial render matrix passed 88 assertions. An added contrast probe then
exposed insufficient contrast for copper letters on the lightest dark-theme
enamel stop. The final version keeps copper on the rim, uses light letters,
and verifies both gradient stops at 4.5:1. Avatar radius was also unified to
50%. Final screenshots were inspected on desktop and mobile. TypeScript
passed; scoped ESLint had no errors and one pre-existing unused `roleColor`
argument warning in the account shell.
