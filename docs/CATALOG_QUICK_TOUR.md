# Optional catalog walkthrough

`src/components/home/QuickTour.tsx` owns the four short catalog hints. Its
replay button is in the home hero, rather than hidden at the bottom of the
catalog. The existing `lw-quick-tour-v1` storage key is preserved so returning
visitors are not forced through onboarding again.

- First idle visit: one automatic hint after 1.8 seconds; no focus stealing.
  Pointer, keyboard, wheel or touch activity before the timer cancels it.
  Hidden tabs and focused form fields suppress the automatic opening.
- Manual replay: focus moves to the close control. Escape, close or skip
  dismisses it; focus returns to the launch control when leaving the panel.
- The panel is a non-modal named region, not a blocking dialog. The catalog
  remains interactive. Step text has a polite live announcement.
- Missing responsive targets are skipped when advancing. Highlight classes
  are removed on step changes, dismissal and unmount.
- Scene tokens preserve the approved teal palette. One 180ms opacity/4px
  entrance replaces the old larger movement; reduced-motion removes it.
  Target highlights are static, not endlessly pulsing. Controls are at least
  44px high and the close control is 44px square.
- Publication copy explains moderation instead of promising immediate
  publication to the website and Telegram.

## Server-only verification

Build into `.next-build` without replacing `.next`, then run:

```sh
NEXT_DIST_DIR=.next-build AUTOMART_AUTH_AUDIT_SCRIPT=scripts/verify-quick-tour.mjs bash scripts/run-server-authenticated-audit.sh
```

The runner uses a disposable database and separate port. Browser requests to
external origins are blocked. It checks desktop/mobile, light/dark, reduced
motion on mobile, interruption, focus, replay, completion and viewport bounds.
An additional fresh idle visit checks automatic opening without focus theft.
Screenshots and the JSON report go to `/tmp/lewheel-quick-tour-20261021`.

Verified on the server on 21 October 2026: 64 browser checks passed in the
final matrix. The first rendered inspection found a mobile overlap with the
support launcher; the confirmation pass checks that intersection explicitly.
The old dark-theme navy override was replaced with the approved scene token.
TypeScript passed; scoped ESLint had zero errors and one pre-existing unused
`IconSparkles` import warning in `HomeCatalog.tsx` (not changed by this work).

This is a focused walkthrough check, not a full WCAG audit or a real-device
screen-reader evaluation. The walkthrough does not change filters, user data,
publication requirements or authentication.
