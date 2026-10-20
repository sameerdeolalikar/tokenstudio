# TokenStudio roadmap

These are planned enhancements, not implemented features. Estimates are provisional engineering effort, including tests and documentation; they are not a claim of hours already worked. Priorities can change after practical use.

## Theme modes and semantic roles, 12–16 hours

Add light/dark modes and role mapping with alias validation across modes, backwards-compatible imports and independent previews.

## Component gallery, 10–14 hours

Add navigation, dialogs, tables and form states. Support viewport presets and keyboard-operable preview controls without altering editor styles.

## Revision review, 8–12 hours

Implement named snapshots, richer visual diffs, selective restore and explicit behavior when an old revision is no longer retained.

## Interchange, 10–14 hours

Add a documented adapter for a selected design-token format and import diagnostics; round-trip valid fixtures without silent data loss.

## Accessibility and workflow, 8–12 hours

Add non-text contrast checks, explanatory failures, project duplication and recovery from interrupted imports. Verify focus and mobile workflows.

## Reviewable implementation work

Each milestone can become a focused issue with reproducible input, observable UI behavior and automated checks. Review visual hierarchy, interaction clarity, keyboard behavior, data correctness, regression coverage and maintainability together. The application itself does not run or benchmark AI models.
