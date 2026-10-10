import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { _electron as electron, expect, test } from '@playwright/test'
import { parseGlb } from '../../src/core/glb/parser'
import { cleanupImageMetadata } from '../../src/core/repair/imageMetadata'
import { createWarningGlbFixture, exifTiff, jpegSegment } from '../fixtures/generated/warningFixture'

// eslint-disable-next-line no-empty-pattern
test('one-click cleanup composes with scene repair, cancellation, revert and verified export', async ({}, testInfo) => {
  test.setTimeout(90_000)
  const root = resolve(import.meta.dirname, '../..')
  const sourcePath = testInfo.outputPath('original.glb')
  const fixedPath = testInfo.outputPath('cleaned.glb')
  const existingPath = testInfo.outputPath('keep-existing.glb')
  await mkdir(dirname(sourcePath), { recursive: true })
  const bytes = createWarningGlbFixture({ sceneDefined: false })
  await writeFile(sourcePath, bytes)
  await writeFile(existingPath, bytes)
  const app = await electron.launch(process.env.INSPECTOR_EXE
    ? { executablePath: process.env.INSPECTOR_EXE, args: [sourcePath], cwd: root }
    : { args: [resolve(root, 'out/main/index.js'), sourcePath], cwd: root })
  try {
    const page = await app.firstWindow()
    await expect(page.getByText('贴图已就绪：2 张', { exact: true })).toBeVisible()
    const cleanup = page.getByRole('button', { name: '一键处理可修复项（4）', exact: true })
    await expect(cleanup).toBeEnabled()
    await cleanup.click()
    const proof = page.getByTestId('repair-proof')
    await expect(proof).toContainText('警告：2 → 0')
    await expect(proof).toContainText('已处理 4 项')
    await expect(proof).toContainText('仅图片区域变更')
    await expect(page.getByRole('button', { name: '修复 scene: 0', exact: true })).toBeEnabled()
    await expect(page.locator('.compatibility-rail')).toContainText('错误')
    await page.getByRole('button', { name: '修复 scene: 0', exact: true }).click()
    await expect(proof).toContainText('scene: 0 已补齐')
    await expect(proof).toContainText('警告：2 → 0')
    await expect(page.getByText('贴图已就绪：2 张', { exact: true })).toBeVisible()
    await app.evaluate(({ dialog }) => { dialog.showSaveDialog = async () => ({ canceled: true, filePath: '' }) })
    await page.getByRole('button', { name: '导出修复文件', exact: true }).click()
    await expect(proof).toBeVisible()
    await app.evaluate(({ dialog }, path) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: path }) }, sourcePath)
    await page.getByRole('button', { name: '导出修复文件', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('不能覆盖原始 GLB')
    expect(await readFile(sourcePath)).toEqual(Buffer.from(bytes))
    await page.getByRole('button', { name: '关闭消息' }).click()
    await app.evaluate(({ dialog }, path) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: path }) }, existingPath)
    await page.getByRole('button', { name: '导出修复文件', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('目标文件已存在')
    expect(await readFile(existingPath)).toEqual(Buffer.from(bytes))
    await page.getByRole('button', { name: '关闭消息' }).click()
    await app.evaluate(({ dialog }, path) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: path }) }, fixedPath)
    await page.getByRole('button', { name: '导出修复文件', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('导出成功')
    expect(parseGlb(new Uint8Array(await readFile(fixedPath))).json.scene).toBe(0)
    expect(await readFile(sourcePath)).toEqual(Buffer.from(bytes))
    await page.screenshot({ path: testInfo.outputPath('cleanup-proof.png') })
    await page.getByRole('button', { name: '撤销修复候选', exact: true }).click()
    await expect(cleanup).toBeEnabled()
    await expect(page.getByRole('button', { name: '导出修复文件', exact: true })).toBeDisabled()
    await app.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }) }, fixedPath)
    await page.getByRole('button', { name: '打开 GLB', exact: true }).click()
    await expect(page.getByText('未发现验证问题', { exact: true })).toBeVisible()
    await expect(page.getByText('贴图已就绪：2 张', { exact: true })).toBeVisible()
  } finally { await app.close() }
})

// eslint-disable-next-line no-empty-pattern
test('real JPEG codec preserves decoded pixels; unused UVs and skipped reasons work in Electron', async ({}, testInfo) => {
  test.setTimeout(90_000)
  const root = resolve(import.meta.dirname, '../..')
  const sourcePath = testInfo.outputPath('jpeg.glb')
  const skippedPath = testInfo.outputPath('unknown.glb')
  const fixedPath = testInfo.outputPath('jpeg-cleaned.glb')
  await mkdir(dirname(sourcePath), { recursive: true })
  const app = await electron.launch(process.env.INSPECTOR_EXE
    ? { executablePath: process.env.INSPECTOR_EXE, args: [], cwd: root }
    : { args: [resolve(root, 'out/main/index.js')], cwd: root })
  try {
    const page = await app.firstWindow()
    const encoded = await page.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = 8; canvas.height = 8
      const context = canvas.getContext('2d')!
      context.fillStyle = '#da3d26'; context.fillRect(0, 0, 8, 8)
      context.fillStyle = '#2699cd'; context.fillRect(0, 0, 4, 4)
      return canvas.toDataURL('image/jpeg', 0.95).split(',')[1]
    })
    const jpeg = new Uint8Array(Buffer.from(encoded, 'base64'))
    const jfif = Buffer.from(jpeg).indexOf('JFIF\0')
    expect(jfif).toBeGreaterThan(0)
    jpeg[jfif + 10] = 0; jpeg[jfif + 11] = 2 // non-square metadata; never change encoded samples
    const exif = new Uint8Array([...new TextEncoder().encode('Exif\0\0'), ...exifTiff()])
    const icc = jpegSegment(0xe2, new TextEncoder().encode('ICC_PROFILE\0\x01\x01profile'))
    const image = new Uint8Array([...jpeg.subarray(0, 2), ...jpegSegment(0xe1, exif), ...icc, ...jpeg.subarray(2)])
    const normalized = cleanupImageMetadata(image, 'image/jpeg')
    expect(normalized.status).toBe('cleaned')
    const source = createWarningGlbFixture({ imageBytes: image, mimeType: 'image/jpeg' })
    await writeFile(sourcePath, source)
    await app.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }) }, sourcePath)
    await page.getByRole('button', { name: '打开 GLB', exact: true }).click()
    await expect(page.getByText('贴图已就绪：2 张', { exact: true })).toBeVisible()
    // This Validator version stops JPEG inspection at SOF; it does not flag its ICC/JFIF metadata.
    // Do not invent warnings or modify images not targeted by the report. Exercise UV-only cleanup.
    await page.getByRole('button', { name: '一键处理可修复项（2）', exact: true }).click()
    await expect(page.getByTestId('repair-proof')).toContainText('警告：0 → 0')
    await expect(page.getByTestId('repair-proof')).toContainText('BIN：全部字节未变化')
    await expect(page.getByTestId('repair-proof')).toContainText('图片压缩像素载荷与材质定义未变化')
    await app.evaluate(({ dialog }, path) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: path }) }, fixedPath)
    await page.getByRole('button', { name: '导出修复文件', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('导出成功')
    const parsed = parseGlb(new Uint8Array(await readFile(fixedPath)))
    const imageInfo = (parsed.json.images as { bufferView: number }[])[0]
    const view = (parsed.json.bufferViews as { byteOffset: number; byteLength: number }[])[imageInfo.bufferView]
    const cleaned = parsed.chunks[1].data.subarray(view.byteOffset, view.byteOffset + view.byteLength)
    expect(cleaned).toEqual(image)
    const pixels = await page.evaluate(async ([before, after]) => {
      const decode = async (bytes: number[]) => {
        const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' }))
        const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height
        const context = canvas.getContext('2d')!; context.drawImage(bitmap, 0, 0); bitmap.close()
        return { width: canvas.width, height: canvas.height, rgba: [...context.getImageData(0, 0, canvas.width, canvas.height).data] }
      }
      return Promise.all([decode(before), decode(after)])
    }, [[...image], [...normalized.bytes]])
    expect(pixels[0]).toEqual(pixels[1])
    expect(await readFile(sourcePath)).toEqual(Buffer.from(source))
    await writeFile(skippedPath, createWarningGlbFixture({ extensions: true, sceneDefined: false }))
    await app.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }) }, skippedPath)
    await page.getByRole('button', { name: '打开 GLB', exact: true }).click()
    await expect(page.getByRole('button', { name: '一键处理可修复项（0）', exact: true })).toBeDisabled()
    await expect(page.getByText('保留原因：存在未覆盖的扩展，无法证明图片范围独占，保留原图').first()).toBeVisible()
    await page.getByRole('button', { name: '修复 scene: 0', exact: true }).click()
    await expect(page.getByTestId('repair-proof')).toBeVisible()
    await page.getByRole('button', { name: '导出修复文件', exact: true }).click()
    await expect(page.getByRole('dialog', { name: '保留警告导出' })).toContainText('2 个 glTF 警告')
    await page.getByRole('button', { name: '取消导出', exact: true }).click()
    await expect(page.getByTestId('repair-proof')).toBeVisible()
  } finally { await app.close() }
})
