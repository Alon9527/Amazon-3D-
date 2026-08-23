# Amazon 3D Asset Inspector MVP Design

## Goal

Build a production-oriented Windows desktop application that validates a local GLB before Amazon Seller Central upload, diagnoses dimensions and axis mapping, and safely repairs a missing top-level `scene: 0` without overwriting or changing the source asset.

## Product boundary

- MVP supports single-file GLB 2.0 only.
- All processing stays on the local machine.
- Seller Central acceptance is a separate real-platform gate.
- Only a missing top-level `scene` with an existing `scenes[0]` is a Safe Fix.
- Advanced fixes, multi-file glTF, batch mode, reports, scene graph, texture thumbnails, and readiness scoring are deferred.

## Architecture

Electron owns windows and file dialogs. A context-isolated preload exposes a narrow typed bridge. React renders the application, while Three.js and React Three Fiber provide the viewport. Core parsing, validation, dimension mapping, and repair modules contain no React code.

The GLB repair pipeline parses and validates the container, minimally injects `"scene":0` into the JSON object, repads the JSON chunk, updates declared lengths, and copies every non-JSON chunk byte-for-byte in its original order. A candidate repair is exportable only after it is reopened, validated, and compared with the original.

## Analysis behavior

- World-space dimensions come from a loaded Three.js scene after `updateMatrixWorld(true)` and `Box3.setFromObject`.
- glTF units are meters internally; mm, cm, and decimal inches are display/input conversions.
- Asset geometry counts are derived from glTF mesh primitives.
- Dimension mapping evaluates all six XYZ to Width/Height/Depth permutations.
- PASS requires identity mapping within tolerance. WARNING covers a non-identity match within tolerance or identity within twice the tolerance. Remaining cases FAIL.

## Security and evidence

The renderer has no unrestricted filesystem access. Save As rejects the original path. Rules identify their evidence as Amazon confirmed, Amazon validator observed, glTF standard, best practice, or diagnostic. Unverified guidance is never labeled as an Amazon requirement.

## Acceptance

The MVP must complete open, preview, orbit, fit, bounding-box display, unit conversion, expected-dimension comparison, axis-swap diagnosis, glTF validation, missing-scene repair, before/after comparison, revalidation, and non-destructive export in one application window.
