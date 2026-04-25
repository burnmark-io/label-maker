# label-maker — Blockers

Genuinely blocking issues that need human input. Each entry: what was tried,
what's needed, what was worked around in the meantime.

## (soft) designer-core ships a Node-aware bundle

`@burnmark-io/designer-core@0.1.0` imports `node:crypto`, `node:url`,
`node:path`, and dynamically `@napi-rs/canvas`. Browser builds need
shims to satisfy the bundler. **Not blocking** — see D1 in DECISIONS.md
for the alias-to-shim workaround. A future designer-core release should
expose a `./browser` export that doesn't touch the Node modules; once
available, drop the shims and the vite aliases.

## (soft) `LabelObjectInput` distributes Omit over the union

The exposed `add()` method's parameter type loses subtype-specific
fields. We wrapped it (D2) so consumers can pass typed discriminated
inputs. **Not blocking.**

