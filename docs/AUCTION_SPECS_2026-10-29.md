# Source specifications and release review

Source facts now use AuctionSourceSpecs: a semantic definition list with bounded
label/value columns, theme-token rules and a single column on phones. At 360px
the label stacks above its value. Long numbers and descriptions wrap without
ellipsis. An existing decorative documents illustration identifies the section;
the heading retains h2 semantics at a compact explicit font size.

Canonical data, source links, missing-value wording and calculations remain
owned by their existing modules. No API, permissions, database schema or package
dependencies changed. Explicit zero mileage remains a known value; missing
power stays "Не опубликовано источником".

## Self-review

Reviewed the scoped diff for data ownership, rendering safety, semantics,
responsive edge cases and regression risk. This is self-review, not an
independent review. React text rendering retains escaping; the presentation
component accepts readonly canonical rows and performs no parsing or mutation.
The new audit is allowlisted in the existing disposable-database runner.

Visual review found one defect: h2 inherited an oversized heading style.
Corrected it with an explicit compact font size. No unresolved material
correctness or security findings were identified in the scoped self-review.

Server type check, scoped ESLint and production build passed. Initial browser
audit: 96 checks; after the heading fix: 104 checks across 360/390/820/1560px,
both themes. Covers zero, absent and long values, pair semantics, collision and
overflow checks, artwork decode and the actual source URL. Uses only a
disposable fixture record. Screenshots/report:
/tmp/lewheel-auction-specs-20261029/.

The user's continuing review-before-push/deploy preference is saved in AGENTS.md.
Kluster tools unavailable; no Kluster review claimed.
