# Amazon 3D Asset Inspector

Windows desktop inspector for locally validating GLB 2.0 assets before Amazon 3D / View in Your Room submission. The MVP previews world-space dimensions, compares all six axis mappings, runs Khronos glTF Validator, and safely repairs an omitted top-level `scene: 0`.

## Supported MVP workflow

1. Open or drop one `.glb` file.
2. Inspect the Three.js preview, world-space Bounding Box, dimensions, and asset counts.
3. Enter Width / Height / Depth and select a tolerance.
4. Review glTF and evidence-labeled Amazon VIYR issues.
5. Apply the Safe Fix only when `scenes[0]` exists and top-level `scene` is missing.
6. Export a newly named GLB after BIN/chunk hashes, geometry statistics, Bounding Box, and Validator checks pass.

The original file is never overwritten. Multi-file `.gltf`, Advanced Fixes, batch mode, reports, texture thumbnails, and Seller Central automation are outside this MVP.

## Development

Prerequisites: Windows 10/11 x64, Node.js 24+, pnpm 11+.

```powershell
pnpm install --ignore-scripts
pnpm setup:electron
pnpm dev
```

The project-level `.npmrc` pins the npm official registry. Dependency overrides patch known build-chain advisories without changing runtime packages.

Quality gates:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm package:win
```

## Evidence boundary

- `AMZ-VIYR-SCENE-001` is labeled `amazon-validator-observed`, based on supplied Amazon feedback and a user-confirmed accepted repair.
- Diagnostic or best-practice findings are never presented as Amazon requirements.
- Local validation cannot prove Seller Central acceptance. Real Amazon upload remains a separate acceptance step.
- Real C4D regression assets belong in `tests/fixtures/private` and are intentionally excluded from Git.
