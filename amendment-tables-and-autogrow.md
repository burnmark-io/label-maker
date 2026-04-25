# label-maker — Amendment (stub): Tables + Auto-Grow Revisited

> Status: open. Not scheduled. This stub captures a problem we've
> deferred so it doesn't get lost.

## Background

`amendment-canvas-sizing.md` §3 dropped auto-grow for continuous labels
in favour of manual drag-to-resize length. Reasoning: canvas length
becoming a side effect of every object move churns history and confuses
undo. The user picks length explicitly; 4:3 starting ratio; drag to
change.

A follow-up question — should tape printers (D1, P-touch) auto-fit
their length to text content, since that's how those printers naturally
work? — was raised and deferred to this stub. It turns out not to be
just a tape concern.

## The bigger problem

Dataset-backed labels combined with table objects make the same
question apply to any continuous medium:

- Nutrition labels: a table of nutrients varies per product.
- Ingredients: list length varies per product.
- Box contents: depends on what's in the box.

When the source is a CSV/dataset, **every row in a batch can produce a
label of a different length**. A batch of 50 product stickers might
range from 40mm to 200mm. Tape printers handle this natively — the
printer cuts at the end of content. Rolls behave the same physically.
Sheets don't fit (fixed slots) and are out of scope.

The auto-grow we dropped for predictability re-enters as a *requirement*
when length is no longer a design decision but a render output.

## What this amendment should answer

- **Length-mode field on `CanvasState`** — a value meaning "compute
  from content, not user-set." Naming TBD (`auto-fit`,
  `content-driven`, `dynamic`). Triggers TBD: tape default? user
  toggle? auto when the doc contains dataset-bound table objects?
- **Table primitive in `@burnmark-io/designer-core`** — first-class
  `TableObject` with row template + dataset binding, vs. composed
  text objects laid out by a template. First is heavier; second
  leaks layout logic into the document. Pick one.
- **Per-row dimensions in batch** — does the print pipeline emit a
  stream of differently-sized bitmaps in one job? `DECISIONS.md` D47
  says drivers accept arbitrary bitmap dims; "arbitrary *and varying*
  mid-job" is a stronger contract that needs per-driver
  re-verification.
- **Batch preview grid** — uniform cells with virtual padding around
  short labels, or honest variable-size cells? Affects layout
  scanning.
- **History/undo for content-driven length** — don't store it,
  recompute on demand. Object edits enter history; length follows.
  Same trick that would resolve the tape case.
- **Sheet templates with table objects** — graceful failure path
  when a bound dataset row would overflow a fixed slot. Truncate?
  Auto-shrink (via the text-overflow amendment)? Refuse the bind?

## Out of scope until this is picked up

- Shipping tape auto-fit standalone. It would commit us to a
  length-mode field this amendment may rename or reshape.
- Re-opening `amendment-canvas-sizing.md` §3. Manual-only length
  stands until we land here.
- Table UI / dataset-binding affordances. Those are upstream of the
  length-mode question and deserve their own design pass.

## Pointers

- `amendment-canvas-sizing.md` §3 — current manual-only length model
- `amendment-side-panel-and-data.md` — datasets and CSV batch
- `amendment-text-overflow.md` — auto-shrink as a fallback for fixed
  slots when content doesn't fit
- `DECISIONS.md` D47 — driver bitmap acceptance contract
