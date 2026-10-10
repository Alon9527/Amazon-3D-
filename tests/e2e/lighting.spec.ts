import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { _electron as electron, expect, test } from '@playwright/test'
import { createHdrFixture } from '../fixtures/generated/hdrFixture'
import { createMaterialGlbFixture } from '../fixtures/generated/materialFixture'

// eslint-disable-next-line no-empty-pattern
test('offline HDR presets, adjustments, local import and error recovery preserve GLB', async ({}, testInfo) => {
  test.setTimeout(90_000)
  const root = resolve(import.meta.dirname, '../..')
  const glbPath = testInfo.outputPath('pbr-swatches.glb')
  const hdrPath = testInfo.outputPath('custom.hdr')
  const badPath = testInfo.outputPath('broken.hdr')
  await mkdir(dirname(glbPath), { recursive: true })
  const glbBytes = createMaterialGlbFixture()
  await writeFile(glbPath, glbBytes)
  await writeFile(hdrPath, createHdrFixture())
  await writeFile(badPath, '#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y 4 +X 4\nshort')
  const packagedExecutable = process.env.INSPECTOR_EXE
  const app = await electron.launch(packagedExecutable
    ? { executablePath: packagedExecutable, args: [glbPath], cwd: root }
    : { args: [resolve(root, 'out/main/index.js'), glbPath], cwd: root })
  try {
    const page = await app.firstWindow()
    const errors: string[] = []
    const remoteRequests: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
    page.on('request', (request) => { if (/^https?:/.test(request.url())) remoteRequests.push(request.url()) })
    await page.reload()
    await expect(page.getByText('分析完成', { exact: true })).toBeVisible()
    const statsBefore = await page.locator('.file-summary').textContent()
    await page.getByRole('button', { name: '环境与照明' }).click()
    const select = page.getByRole('combobox', { name: 'HDR 环境' })
    await expect(select.locator('option')).toHaveCount(5)
    await expect(page.getByTestId('hdr-status')).toContainText('当前：电商中性参考 · 1024 × 512')
    await page.screenshot({ path: testInfo.outputPath('hdr-default.png') })
    const viewport = page.locator('.viewport-shell canvas')
    const neutralImage = await viewport.screenshot()
    for (const [id, name] of [['soft', '柔光摄影棚'], ['contrast', '对比摄影棚'], ['room', '室内自然光'], ['sky', '室外阴天']]) {
      await select.selectOption(id)
      await expect(page.getByTestId('hdr-status')).toContainText(`当前：${name} · 1024 × 512`)
    }
    await select.selectOption('neutral')
    await select.selectOption('contrast')
    await select.selectOption('soft')
    await expect(page.getByTestId('hdr-status')).toContainText('当前：柔光摄影棚')
    const intensity = page.getByRole('slider', { name: '环境强度' })
    await intensity.focus()
    await intensity.press('End')
    await expect(page.getByTestId('hdr-intensity')).toHaveText('3.00×')
    const exposure = page.getByRole('slider', { name: '曝光' })
    await exposure.focus()
    await exposure.press('End')
    await expect(page.getByTestId('hdr-exposure')).toHaveText('+3.0 EV')
    const rotation = page.getByRole('slider', { name: '环境旋转' })
    await rotation.focus()
    await rotation.press('ArrowRight')
    await expect(page.getByTestId('hdr-rotation')).toHaveText('1°')
    await page.getByRole('checkbox', { name: '显示 HDR 背景' }).check()
    expect(await viewport.screenshot()).not.toEqual(neutralImage)
    await page.getByRole('button', { name: '恢复默认照明' }).click()
    await expect(page.getByTestId('hdr-status')).toContainText('当前：电商中性参考')
    await expect(page.getByTestId('hdr-intensity')).toHaveText('1.00×')
    await expect(page.getByTestId('hdr-exposure')).toHaveText('0.0 EV')
    await expect(page.getByTestId('hdr-rotation')).toHaveText('0°')
    await expect(page.getByRole('checkbox', { name: '显示 HDR 背景' })).not.toBeChecked()
    await app.evaluate(({ dialog }) => { dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] }) })
    await page.getByRole('button', { name: '加载本地 HDR…' }).click()
    await expect(select).toHaveValue('neutral')
    await app.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }) }, badPath)
    await page.getByRole('button', { name: '加载本地 HDR…' }).click()
    await expect(page.getByRole('alert')).toContainText('已保留原环境')
    await expect(select).toHaveValue('neutral')
    await expect(page.getByText('分析完成', { exact: true })).toBeVisible()
    await app.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }) }, hdrPath)
    await page.getByRole('button', { name: '加载本地 HDR…' }).click()
    await expect(select).toHaveValue('custom')
    await expect(page.getByTestId('hdr-status')).toContainText('当前：custom.hdr · 4 × 4')
    await expect(page.getByRole('alert')).toHaveCount(0)
    await select.selectOption('neutral')
    await expect(page.getByTestId('hdr-status')).toContainText('当前：电商中性参考')
    expect(await page.locator('.file-summary').textContent()).toEqual(statsBefore)
    expect(await readFile(glbPath)).toEqual(Buffer.from(glbBytes))
    expect(remoteRequests).toEqual([])
    expect(errors).toEqual([])
    await page.screenshot({ path: testInfo.outputPath('hdr-panel-verified.png') })
  } finally {
    await app.close()
  }
})
