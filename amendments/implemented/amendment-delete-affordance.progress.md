# Object Delete Affordance — Implementation Progress

Companion to `amendment-delete-affordance.md`. Tracks step status,
decisions made during implementation, and any blockers discovered.

---

## Pre-flight findings (codebase reality vs. amendment text)

- **`deleteSelection` is a local closure inside `useKeyboardShortcuts.ts:52`.**
  Nothing else imports it. The amendment's "factor to a shared composable"
  step is the first task — no context-menu amendment got there first.
- **InlineTextEditor commits per keystroke.** `InlineTextEditor.vue` emits
  `update:content` on every input event, so by the time the Properties-tab
  Delete button is clicked, the latest text is already in the store.
  Clicking the button blurs the contenteditable → emits `finish` → the
  canvas dismisses the editor → the delete proceeds. The §5.3 "commits any
  pending edit then deletes" requirement falls out for free; no explicit
  commit wiring needed.
- **Properties panel structure (post properties-content amendment).**
  Body is a flex column inside `.properties-panel__body` with type-specific
  → Appearance → Position & Size (collapsible). Delete button slots in at
  the bottom of `__body`, after the last section, with a top border for
  visual separation.
- **Design tokens.** No `--color-danger`; the destructive token is
  `--color-error` (`variables.css:30`). `useConfirm` / `ConfirmDialog`
  already paint danger buttons as `background: var(--color-error)` with
  white text. The Delete button here is borderless red text rather than a
  fill — it sits inside the panel, not as a primary action; danger fill
  would dominate the panel visually.
- **i18n locales: en, nl** — both updated for new keys.

---

## Decisions

- **JS truncation at 30 chars + `title` tooltip for single-object label**,
  matching the amendment text literally. CSS ellipsis on a max-width
  container would also work and would adapt better to locale-driven
  label growth ("Verwijderen…" longer than "Delete"); deliberately
  going with the literal spec for predictable visible output across
  locales. Easy to switch later.
- **Borderless red text, no fill.** The button sits at the bottom of
  the Properties panel and is one of several controls. A full red fill
  would dominate the panel; borderless red text reads as destructive
  but doesn't hijack visual hierarchy. Hover lifts background to a
  subtle red wash so the affordance is still strong.
- **No special group label.** Amendment §5.4 lets us pick `"Delete Group 3"`
  over `"Delete N items in group"`. Going with `"Delete {name}"` for
  groups (same path as any single object).
- **Group children count toward N for multi-select?** When a group is
  one of the items in a multi-select, the label still counts the group
  as one item ("Delete 3 items" for [text, group, image]). Counting
  group children separately would be misleading — the user sees three
  selectable rows in the Object list, not N+children.
- **Auto-switch fall-through.** §5.5 — after delete, selection clears.
  IA amendment's auto-switch (already shipped) handles tab restoration.
  Nothing to wire here.

---

## Step status

- [x] Step 1 — `useObjectActions` composable with shared `deleteSelection`
- [x] Step 2 — Wire keyboard shortcut to use the shared composable
- [x] Step 3 — i18n keys (en + nl)
- [x] Step 4 — Delete button rendered in PropertiesPanel
- [x] Step 5 — Tests (PropertiesPanel render + composable)
- [x] Step 6 — Gate (typecheck, lint, tests) and commit

---
