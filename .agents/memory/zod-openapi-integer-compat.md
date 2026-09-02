---
name: OpenAPI integer compatibility
description: A compatibility note for generated Zod schemas in this workspace.
---

OpenAPI integer fields currently generate `zod.int()` in the API validation package, while the workspace's pinned Zod runtime may not expose that helper. Prefer numeric OpenAPI fields when integer-specific validation is not essential.

**Why:** Code generation can succeed while the chained shared-library typecheck fails on the generated helper.

**How to apply:** When adding count or identifier fields to the API contract, check generated validation compatibility before relying on `type: integer`.