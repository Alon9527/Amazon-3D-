# Amazon 3D Asset Inspector MVP Implementation Plan

> **For agentic workers:** Execute task-by-task with TDD. Do not modify or export real private fixtures.

**Goal:** Deliver a Windows 10/11 x64 Electron application that locally inspects GLB 2.0 assets and safely fixes an omitted top-level `scene: 0`.

**Architecture:** Electron main/preload isolate filesystem capabilities from the renderer. Pure TypeScript core modules own GLB parsing, rules, repairs, unit conversion, and dimension mapping; Three.js owns world-space visual analysis.

**Tech Stack:** Electron, electron-vite, React, TypeScript, Three.js, React Three Fiber, Zustand, Khronos gltf-validator, Tailwind CSS, Vitest, Playwright, electron-builder, pnpm.

---

## Tasks

1. Scaffold the secure Electron/Vite/React project with pinned dependencies and quality commands.
2. Write failing GLB fixture/parser tests, then implement strict container parsing.
3. Write failing scene-rule and repair tests, then implement minimal scene injection and byte-preservation gates.
4. Write failing unit, geometry-statistics, and six-permutation dimension tests, then implement the analysis modules.
5. Integrate Khronos glTF Validator and normalize its messages into `ValidationIssue`.
6. Build the React shell, Three.js viewport, model HUD, controls, dimension form, validation panel, and Fix Center.
7. Connect Open, drag/drop, repair, before/after validation, and non-destructive Save As through typed IPC.
8. Add Electron E2E coverage, run quality gates, build the NSIS x64 package, and record the remaining real-fixture and Seller Central gates.

## Required verification

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm build`
- `pnpm package:win`

Public generated fixtures must cover malformed containers, padding, all scene states, all dimension permutations, and triangle modes. Private C4D fixtures live under `tests/fixtures/private` and are ignored by Git.
