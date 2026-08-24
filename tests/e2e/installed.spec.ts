import { access, mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { _electron as electron, expect, test } from '@playwright/test'
import { createTexturedTriangleGlbFixture } from '../fixtures/generated/glbFixture'

const installedExecutable = process.env.INSPECTOR_EXE

// eslint-disable-next-line no-empty-pattern
test('installed Windows application opens and analyzes a GLB', async ({}, testInfo) => {
  test.skip(!installedExecutable, 'Set INSPECTOR_EXE to run the installed-artifact smoke test')
  await access(installedExecutable!)

  const sourcePath = testInfo.outputPath('installed-smoke.glb')
  await mkdir(dirname(sourcePath), { recursive: true })
  await writeFile(sourcePath, createTexturedTriangleGlbFixture())

  const app = await electron.launch({
    executablePath: installedExecutable,
    args: [sourcePath],
  })

  try {
    const window = await app.firstWindow()
    await expect(window.getByTestId('app-title')).toHaveText('Amazon 3D 资产检查器')
    await expect(window.getByRole('heading', { name: 'installed-smoke.glb' })).toBeVisible()
    await expect(window.getByRole('button', { name: '打开 GLB' })).toBeVisible()
    await expect(window.getByTestId('texture-status')).toHaveText('贴图已就绪：1 张')
  } finally {
    await app.close()
  }
})
