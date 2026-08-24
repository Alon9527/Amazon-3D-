# Texture Preview and Simplified Chinese UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore embedded GLB texture rendering in the packaged Electron viewer and present all application-owned UI in Simplified Chinese.

**Architecture:** Keep immutable GLB bytes and the existing Three.js loading path. Add only `blob:` to Electron's `connect-src`, derive a viewer-only texture summary from loaded Three.js materials, and expose that state through the existing React component tree. Localize application-owned strings in place with one shared status-label map; preserve protocol names, rule IDs, filenames, JSON keys, and Khronos raw messages.

**Tech Stack:** Electron 43, React 19, TypeScript, Three.js/React Three Fiber, Vitest, Playwright Electron E2E, electron-builder NSIS.

---

## File map

- Create `src/renderer/viewport/modelTextures.ts`: pure Three.js material texture-slot inspection.
- Create `tests/unit/model-textures.test.ts`: unit coverage for no-texture, ready-texture, shared-texture, and unready-texture cases.
- Modify `tests/fixtures/generated/glbFixture.ts`: generate a minimal UV-mapped GLB with an embedded PNG.
- Modify `tests/e2e/app.spec.ts`: exercise real embedded texture loading and Chinese UI in Electron production mode.
- Modify `src/main/index.ts`: allow local `blob:` fetches in CSP and translate dialogs/errors.
- Modify `src/renderer/viewport/modelLoader.ts`: preserve texture disposal and distinguish texture-load failures.
- Modify `src/renderer/viewport/ModelViewport.tsx`: publish/render texture readiness and Chinese Viewer copy.
- Create `src/renderer/i18n/zhCN.ts`: shared status/source/fix labels.
- Modify `src/renderer/App.tsx`, `components/*.tsx`, `panels/*.tsx`, `index.html`: Chinese application copy.
- Modify `src/config/amazonRules.ts`, `src/core/validator/sceneRules.ts`, `src/core/repair/sceneRepair.ts`: Chinese application-owned validation and repair messages.
- Modify `tests/e2e/installed.spec.ts`: installed-artifact Chinese/texture smoke assertions.
- Modify `README.md`: document embedded texture support and localization boundary.

### Task 1: Reproduce embedded texture failure

**Files:**
- Modify: `tests/fixtures/generated/glbFixture.ts`
- Modify: `tests/e2e/app.spec.ts`

- [ ] **Step 1: Add a generated textured GLB fixture**

Add `createTexturedTriangleGlbFixture()` that packs positions, `TEXCOORD_0`, indices, and a known valid PNG into one BIN chunk. Its JSON must include:

```ts
images: [{ bufferView: 3, mimeType: 'image/png' }],
textures: [{ source: 0 }],
materials: [{
  pbrMetallicRoughness: {
    baseColorTexture: { index: 0 },
    metallicFactor: 0,
    roughnessFactor: 1,
  },
}],
```

- [ ] **Step 2: Write the failing Electron E2E test**

Launch `out/main/index.js` with the textured fixture, collect console/page errors, and assert that the page reports one ready texture:

```ts
await expect(window.getByTestId('texture-status')).toHaveText('贴图已就绪：1 张')
expect(runtimeErrors.filter((message) => message.includes('Content Security Policy'))).toEqual([])
```

- [ ] **Step 3: Run the test and verify RED**

Run: `pnpm build; pnpm exec playwright test tests/e2e/app.spec.ts -g "内嵌贴图"`

Expected: FAIL because the current Viewer has no texture status and the production CSP may block the blob-backed image request. Record the exact console or Viewer error before changing CSP.

- [ ] **Step 4: Commit the reproduction fixture and test**

```powershell
git add -- tests/fixtures/generated/glbFixture.ts tests/e2e/app.spec.ts
git commit -m "test: reproduce embedded GLB texture preview"
```

### Task 2: Fix local texture decoding and expose readiness

**Files:**
- Create: `src/renderer/viewport/modelTextures.ts`
- Create: `tests/unit/model-textures.test.ts`
- Modify: `src/main/index.ts`
- Modify: `src/renderer/viewport/modelLoader.ts`
- Modify: `src/renderer/viewport/ModelViewport.tsx`
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: Write failing unit tests for texture inspection**

Define the desired API:

```ts
export interface TextureLoadSummary {
  referencedSlots: number
  uniqueTextures: number
  readyTextures: number
}

expect(summarizeSceneTextures(sceneWithSharedReadyMap)).toEqual({
  referencedSlots: 2,
  uniqueTextures: 1,
  readyTextures: 1,
})
```

Also assert an empty material returns zeroes and a `Texture` without `image` counts as referenced but not ready.

- [ ] **Step 2: Run unit test and verify RED**

Run: `pnpm exec vitest run tests/unit/model-textures.test.ts`

Expected: FAIL because `modelTextures.ts` does not exist.

- [ ] **Step 3: Implement the pure texture summary**

Traverse each material and inspect standard Three.js texture properties (`map`, `normalMap`, `roughnessMap`, `metalnessMap`, `emissiveMap`, `aoMap`, `alphaMap`, `bumpMap`, `displacementMap`, `lightMap`, `clearcoatMap`, `clearcoatNormalMap`, `clearcoatRoughnessMap`, `sheenColorMap`, `sheenRoughnessMap`, `specularMap`, `specularColorMap`, `specularIntensityMap`, `transmissionMap`, `thicknessMap`, `iridescenceMap`, `iridescenceThicknessMap`). Deduplicate by texture UUID and treat `texture.image` or `texture.source.data` as ready.

- [ ] **Step 4: Apply the minimal CSP fix**

Change only the connection policy:

```ts
const connectPolicy = isDevelopment
  ? "connect-src 'self' blob: ws: http:"
  : "connect-src 'self' blob:"
```

Do not add `https:`, `file:`, or wildcard sources.

- [ ] **Step 5: Publish Viewer texture status**

After `GLTFLoader` resolves, call `summarizeSceneTextures(nextScene)` and publish it through `onTextures`. Render a `data-testid="texture-status"` HUD line with exactly one of:

```ts
'未检测到贴图'
`贴图已就绪：${readyTextures} 张`
`贴图未完全加载：${readyTextures}/${uniqueTextures} 张`
```

Update `disposeScene()` to dispose each unique material texture once before disposing the material.

- [ ] **Step 6: Verify GREEN**

Run:

```powershell
pnpm exec vitest run tests/unit/model-textures.test.ts
pnpm build
pnpm exec playwright test tests/e2e/app.spec.ts -g "内嵌贴图"
```

Expected: unit tests pass; Electron E2E reports one ready texture and no CSP violation.

- [ ] **Step 7: Verify Wireframe recovery**

In E2E, toggle “线框” on and off and assert `texture-status` returns/stays at `贴图已就绪：1 张` without page errors.

- [ ] **Step 8: Commit texture repair**

```powershell
git add -- src/main/index.ts src/renderer/viewport/modelLoader.ts src/renderer/viewport/modelTextures.ts src/renderer/viewport/ModelViewport.tsx src/renderer/App.tsx tests/unit/model-textures.test.ts tests/e2e/app.spec.ts
git commit -m "fix: restore embedded GLB texture preview"
```

### Task 3: Localize application-owned UI

**Files:**
- Create: `src/renderer/i18n/zhCN.ts`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/components/StatusBadge.tsx`
- Modify: `src/renderer/components/TopBar.tsx`
- Modify: `src/renderer/components/ViewportToolbar.tsx`
- Modify: `src/renderer/panels/ModelPanel.tsx`
- Modify: `src/renderer/panels/ValidationPanel.tsx`
- Modify: `src/renderer/viewport/ModelViewport.tsx`
- Modify: `src/renderer/index.html`
- Modify: `src/main/index.ts`
- Modify: `src/config/amazonRules.ts`
- Modify: `src/core/validator/sceneRules.ts`
- Modify: `src/core/repair/sceneRepair.ts`
- Modify: `tests/e2e/app.spec.ts`
- Modify: `tests/e2e/installed.spec.ts`

- [ ] **Step 1: Add failing Chinese UI assertions**

Assert the loaded application exposes these controls and statuses:

```ts
await expect(window.getByRole('button', { name: '打开 GLB' })).toBeVisible()
await expect(window.getByRole('button', { name: '修复 scene: 0' })).toBeVisible()
await expect(window.getByText('模型信息')).toBeVisible()
await expect(window.getByText('验证结果')).toBeVisible()
await expect(window.getByText('分析完成')).toBeVisible()
await expect(window.getByRole('button', { name: 'Open GLB' })).toHaveCount(0)
```

- [ ] **Step 2: Run E2E and verify RED**

Run: `pnpm build; pnpm exec playwright test tests/e2e/app.spec.ts`

Expected: FAIL on the existing English labels.

- [ ] **Step 3: Add shared Chinese status mappings**

Create:

```ts
export const severityLabels = {
  idle: '未检查',
  pass: '通过',
  warning: '警告',
  error: '错误',
} as const
```

Add source/fix labels for app-owned issue metadata. Keep rule IDs and Khronos messages unchanged.

- [ ] **Step 4: Translate all application-owned visible strings**

Use consistent verbs: “打开 GLB”, “导出修复文件”, “修复 scene: 0”, “适应窗口”, “重置视图”, “正视图”, “右视图”, “顶视图”. Use “宽度/高度/深度”, “网格/材质/贴图/三角面”, and status terms from `severityLabels`.

Set `<html lang="zh-CN">` and title to `Amazon 3D 资产检查器`.

- [ ] **Step 5: Translate application errors and dialogs**

Translate main/preload/renderer/repair-owned errors and dialog titles. Preserve `.glb`, `scene`, `scenes[0]`, SHA-256, GLB/glTF and rule IDs verbatim.

- [ ] **Step 6: Verify Chinese E2E GREEN**

Run: `pnpm build; pnpm exec playwright test tests/e2e/app.spec.ts`

Expected: all workflow, texture and Chinese UI assertions pass.

- [ ] **Step 7: Scan for residual visible English**

Run:

```powershell
rg -n 'Open GLB|Export Fixed|Validation|Expected product size|Axis mapping|Wireframe|Operation blocked|LOCAL PROCESSING|No validation issues' src/main src/renderer
```

Expected: no visible application copy matches. Technical variable/type names are allowed.

- [ ] **Step 8: Commit localization**

```powershell
git add -- src tests/e2e
git commit -m "feat: localize inspector interface in Chinese"
```

### Task 4: Full verification and Windows artifact

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document support boundary**

State that embedded PNG/JPEG textures in GLB are previewed locally; external `.gltf` resources remain outside MVP; Khronos raw messages remain untranslated technical evidence.

- [ ] **Step 2: Run all source gates**

Run independently and require exit code 0:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm audit --registry=https://registry.npmjs.org/ --json
```

- [ ] **Step 3: Visually inspect the textured fixture**

Launch the built app with the textured fixture, capture a screenshot under `test-results`, and verify the triangle is textured, the HUD reports one ready texture, and all primary controls are Chinese.

- [ ] **Step 4: Build and install the Windows artifact**

Run:

```powershell
pnpm package:win
```

Install the generated NSIS artifact to the existing project-local `installed-test` directory with `/S`, require installer exit code 0, then run:

```powershell
$env:INSPECTOR_EXE = 'F:\Codex\Work\amazon-3d-asset-inspector\installed-test\Amazon 3D Asset Inspector.exe'
pnpm test:installed
```

- [ ] **Step 5: Record artifact evidence**

Record exact installer path, size, SHA-256, Authenticode status, Windows build, test counts, and the remaining real-C4D/Seller Central acceptance boundary.

- [ ] **Step 6: Commit documentation**

```powershell
git add -- README.md
git commit -m "docs: document textured Chinese inspector build"
```
