import { access, mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { _electron as electron, expect, test } from '@playwright/test'
import { createTriangleGlbFixture } from '../fixtures/generated/glbFixture'

const installedExecutable = process.env.INSPECTOR_EXE

// eslint-disable-next-line no-empty-pattern
test('installed Windows application opens and analyzes a GLB', async ({}, testInfo) => {
  test.skip(!installedExecutable, 'Set INSPECTOR_EXE to run the installed-artifact smoke test')
  await access(installedExecutable!)

  const sourcePath = testInfo.outputPath('installed-smoke.glb')
  await mkdir(dirname(sourcePath), { recursive: true })
  await writeFile(sourcePath, createTriangleGlbFixture({ sceneDefined: false }))

  const app = await electron.launch({
    executablePath: installedExecutable,
    args: [sourcePath],
  })

  try {
    const window = await app.firstWindow()
    await expect(window.getByTestId('app-title')).toHaveText('Amazon 3D Asset Inspector')
    await expect(window.getByRole('heading', { name: 'installed-smoke.glb' })).toBeVisible()
    await expect(window.getByText('AMZ-VIYR-SCENE-001', { exact: true })).toBeVisible()
  } finally {
    await app.close()
  }
})
