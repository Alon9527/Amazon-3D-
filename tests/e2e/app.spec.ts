import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { _electron as electron, expect, test } from '@playwright/test'
import { parseGlb } from '../../src/core/glb/parser'
import { createTriangleGlbFixture } from '../fixtures/generated/glbFixture'

// eslint-disable-next-line no-empty-pattern
test('opens, analyzes, safely fixes, and exports a GLB without overwriting the source', async ({}, testInfo) => {
  const projectRoot = resolve(import.meta.dirname, '../..')
  const sourcePath = testInfo.outputPath('original.glb')
  const fixedPath = testInfo.outputPath('original_Amazon-fixed.glb')
  await mkdir(dirname(sourcePath), { recursive: true })
  const sourceBytes = createTriangleGlbFixture({ sceneDefined: false })
  await writeFile(sourcePath, sourceBytes)

  const app = await electron.launch({
    args: [resolve(projectRoot, 'out/main/index.js'), sourcePath],
    cwd: projectRoot,
  })

  try {
    const window = await app.firstWindow()
    await expect(window.getByTestId('app-title')).toHaveText('Amazon 3D Asset Inspector')
    await expect(window.getByRole('heading', { name: 'original.glb' })).toBeVisible()
    await expect(window.getByText('AMZ-VIYR-SCENE-001', { exact: true })).toBeVisible()

    await window.getByRole('button', { name: 'Fix scene: 0' }).click()
    await expect(window.getByRole('main').getByText('修复候选已通过核心检查')).toBeVisible()
    await expect(window.getByRole('button', { name: 'Export Fixed' })).toBeEnabled()

    await app.evaluate(
      async ({ dialog }, outputPath) => {
        dialog.showSaveDialog = async () => ({ canceled: false, filePath: outputPath })
      },
      fixedPath,
    )
    await window.getByRole('button', { name: 'Export Fixed' }).click()
    await expect(window.getByText('Export Successful')).toBeVisible()

    const [sourceAfter, fixedAfter] = await Promise.all([readFile(sourcePath), readFile(fixedPath)])
    expect(sourceAfter).toEqual(Buffer.from(sourceBytes))
    expect(parseGlb(fixedAfter).json.scene).toBe(0)
  } finally {
    await app.close()
  }
})
