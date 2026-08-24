import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { _electron as electron, expect, test } from '@playwright/test'
import { parseGlb } from '../../src/core/glb/parser'
import { createTexturedTriangleGlbFixture, createTriangleGlbFixture } from '../fixtures/generated/glbFixture'

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
    await expect(window.getByTestId('app-title')).toHaveText('Amazon 3D 资产检查器')
    await expect(window.getByRole('heading', { name: 'original.glb' })).toBeVisible()
    await expect(window.getByText('模型信息', { exact: true })).toBeVisible()
    await expect(window.getByText('验证结果', { exact: true })).toBeVisible()
    await expect(window.getByText('分析完成', { exact: true })).toBeVisible()
    await expect(window.getByRole('button', { name: '打开 GLB' })).toBeVisible()
    await expect(window.getByRole('button', { name: 'Open GLB' })).toHaveCount(0)
    await expect(window.getByText('AMZ-VIYR-SCENE-001', { exact: true })).toBeVisible()

    await window.getByRole('button', { name: '修复 scene: 0' }).click()
    await expect(window.getByRole('main').getByText('修复候选已通过核心检查')).toBeVisible()
    await expect(window.getByRole('button', { name: '导出修复文件' })).toBeEnabled()

    await app.evaluate(
      async ({ dialog }, outputPath) => {
        dialog.showSaveDialog = async () => ({ canceled: false, filePath: outputPath })
      },
      fixedPath,
    )
    await window.getByRole('button', { name: '导出修复文件' }).click()
    await expect(window.getByText('导出成功')).toBeVisible()

    const [sourceAfter, fixedAfter] = await Promise.all([readFile(sourcePath), readFile(fixedPath)])
    expect(sourceAfter).toEqual(Buffer.from(sourceBytes))
    expect(parseGlb(fixedAfter).json.scene).toBe(0)
  } finally {
    await app.close()
  }
})

// eslint-disable-next-line no-empty-pattern
test('loads an embedded GLB texture without a CSP violation', async ({}, testInfo) => {
  const projectRoot = resolve(import.meta.dirname, '../..')
  const sourcePath = testInfo.outputPath('textured.glb')
  await mkdir(dirname(sourcePath), { recursive: true })
  await writeFile(sourcePath, createTexturedTriangleGlbFixture())

  const app = await electron.launch({
    args: [resolve(projectRoot, 'out/main/index.js'), sourcePath],
    cwd: projectRoot,
  })

  try {
    const window = await app.firstWindow()
    const runtimeErrors: string[] = []
    const runtimeMessages: string[] = []
    window.on('console', (message) => {
      runtimeMessages.push(message.text())
      if (message.type() === 'error') runtimeErrors.push(message.text())
    })
    window.on('pageerror', (error) => runtimeErrors.push(error.message))

    await window.reload()
    await expect(window.getByRole('heading', { name: 'textured.glb' })).toBeVisible()
    await window.waitForTimeout(500)
    expect(
      runtimeErrors.filter(
        (message) => message.includes('Content Security Policy') || message.includes("Couldn't load texture"),
      ),
      runtimeErrors.join('\n'),
    ).toEqual([])
    await expect(window.getByTestId('texture-status'), runtimeMessages.join('\n')).toHaveText('贴图已就绪：1 张')
    await window.getByRole('button', { name: '线框' }).click()
    await window.getByRole('button', { name: '线框' }).click()
    await expect(window.getByTestId('texture-status')).toHaveText('贴图已就绪：1 张')
    await window.screenshot({ path: testInfo.outputPath('textured-zh-cn.png') })
  } finally {
    await app.close()
  }
})
