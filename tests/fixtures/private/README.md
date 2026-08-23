# Private regression fixtures

Place the user-supplied files here without modifying them:

- `original.glb` — has `scenes[0]` but omits top-level `scene`.
- `fixed.glb` — differs semantically only by explicitly selecting `scene: 0`.

Record their SHA-256 values in `sha256.json`. The GLB files are ignored by Git; only this guide and the hash manifest may be committed. Public CI uses generated fixtures and reports private regression tests as skipped when these files are absent.
