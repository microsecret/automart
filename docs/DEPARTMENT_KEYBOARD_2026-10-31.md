# Keyboard navigation for parts departments

Continue frontend refinement in the existing approved design. The department
buttons already expose tab roles but lacked their keyboard interaction.
Preserve the six department names, artwork, real product groups, URL filters,
click/touch selection, API behaviour and existing compact layout.

The selected department is the only tab in the normal Tab sequence.
ArrowLeft/Right move focus and activate the previous/next department with
wrapping. Home/End activate the first/last. Modified browser shortcuts remain
untouched. Tab leaves the strip for the selected department's product buttons.
Stable useId identifiers connect tabs to the current labelled tabpanel.

Focus uses the existing theme ring. Rail padding reserves space for its
outline; product buttons use an inset outline to avoid clipping at mobile
scroll boundaries. Keyboard revelation changes only horizontal rail scroll,
not the document's vertical position. Existing URL replacement keeps its
scroll:false option. Reduced-motion users receive no tile transform.
No new imagery, dependencies, data, layout redesign or API change is added.

The disposable catalogue browser matrix covers three widths and both themes,
all six illustrated departments, keyboard focus/selection, wrapping, Home/End,
tab/panel relationships, visible focused tabs and vertical scroll stability.
Existing catalogue menu, group destination and help-page checks stay enabled.
Screenshots: /tmp/lewheel-department-keyboard-20261031/.

Review the scoped diff before push/deploy; build/typecheck/lint/browser checks
run on the server. Kluster is unavailable and is not claimed as verification.
