import { app, BrowserWindow, dialog, ipcMain, session, type SaveDialogOptions } from 'electron'
import { existsSync } from 'node:fs'
import { readFile, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AssetPayload, HdrPayload, SaveFixedRequest, SaveFixedResult } from '@shared/bridge'
import { inspectHdrHeader, MAX_HDR_BYTES } from '@core/geometry/hdrHeader'

const currentDirectory = dirname(fileURLToPath(import.meta.url))
const isDevelopment = Boolean(process.env.ELECTRON_RENDERER_URL)

function assertGlbPath(filePath: string): void {
  if (extname(filePath).toLowerCase() !== '.glb') {
    throw new Error('当前 MVP 仅支持单文件 GLB 资产')
  }
}

async function readAsset(filePath: string): Promise<AssetPayload> {
  assertGlbPath(filePath)
  const details = await stat(filePath)
  if (!details.isFile()) throw new Error('选择的 GLB 路径不是文件')
  const bytes = await readFile(filePath)
  return {
    name: basename(filePath),
    path: resolve(filePath),
    bytes: new Uint8Array(bytes),
  }
}

function launchAssetPath(): string | null {
  const candidate = process.argv.find(
    (argument, index) => index > 0 && extname(argument).toLowerCase() === '.glb' && existsSync(argument),
  )
  return candidate ? resolve(candidate) : null
}

function safeSuggestedName(value: string): string {
  const name = basename(value).replace(/[<>:"/\\|?*]/g, '_')
  return name.toLowerCase().endsWith('.glb') ? name : `${name}.glb`
}

function samePath(left: string, right: string): boolean {
  return resolve(left).toLocaleLowerCase() === resolve(right).toLocaleLowerCase()
}

function registerIpc(): void {
  ipcMain.handle('inspector:open-hdr', async (event): Promise<HdrPayload | null> => {
    const owner = BrowserWindow.fromWebContents(event.sender)
    const options = {
      title: '加载本地 HDR 环境（不上传）',
      properties: ['openFile' as const],
      filters: [{ name: 'Radiance HDR', extensions: ['hdr'] }],
    }
    const result = owner ? await dialog.showOpenDialog(owner, options) : await dialog.showOpenDialog(options)
    if (result.canceled || !result.filePaths[0]) return null
    const filePath = result.filePaths[0]
    if (extname(filePath).toLowerCase() !== '.hdr') throw new Error('请选择 .hdr 文件；暂不支持 EXR。')
    const details = await stat(filePath)
    if (!details.isFile()) throw new Error('选择的 HDR 路径不是文件。')
    if (details.size > MAX_HDR_BYTES) throw new Error('HDR 文件超过 32 MB，请使用较低分辨率版本。')
    const bytes = new Uint8Array(await readFile(filePath))
    inspectHdrHeader(bytes)
    return { name: basename(filePath), bytes }
  })

  ipcMain.handle('inspector:open-glb', async (): Promise<AssetPayload | null> => {
    const result = await dialog.showOpenDialog({
      title: '打开 GLB',
      properties: ['openFile'],
      filters: [{ name: 'GLB 2.0', extensions: ['glb'] }],
    })
    if (result.canceled || !result.filePaths[0]) return null
    return readAsset(result.filePaths[0])
  })

  ipcMain.handle('inspector:get-launch-asset', async (): Promise<AssetPayload | null> => {
    const filePath = launchAssetPath()
    return filePath ? readAsset(filePath) : null
  })

  ipcMain.handle(
    'inspector:save-fixed',
    async (event, request: SaveFixedRequest): Promise<SaveFixedResult> => {
      if (!request || !(request.bytes instanceof Uint8Array)) {
        throw new Error('修复后的 GLB 数据无效')
      }
      const sourceDirectory = request.sourcePath ? dirname(request.sourcePath) : app.getPath('documents')
      const defaultPath = resolve(sourceDirectory, safeSuggestedName(request.suggestedName))
      const owner = BrowserWindow.fromWebContents(event.sender)
      const options: SaveDialogOptions = {
        title: '导出修复后的 GLB',
        defaultPath,
        filters: [{ name: 'GLB 2.0', extensions: ['glb'] }],
      }
      const result = owner
        ? await dialog.showSaveDialog(owner, options)
        : await dialog.showSaveDialog(options)
      if (result.canceled || !result.filePath) return { status: 'cancelled' }
      assertGlbPath(result.filePath)
      if (request.sourcePath && samePath(result.filePath, request.sourcePath)) {
        throw new Error('不能覆盖原始 GLB，请选择新的文件名。')
      }

      // Exclusive creation also protects originals reachable through a hard link or symlink.
      try {
        await writeFile(result.filePath, request.bytes, { flag: 'wx' })
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST') throw new Error('目标文件已存在，不覆盖已有文件；请选择新的文件名。', { cause: error })
        throw error
      }
      const written = await readFile(result.filePath)
      if (!written.equals(Buffer.from(request.bytes))) {
        throw new Error('导出复检失败：保存的字节与已验证候选不一致')
      }
      return { status: 'saved', path: result.filePath, size: written.byteLength }
    },
  )
}

function installContentSecurityPolicy(): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const scriptPolicy = isDevelopment ? "script-src 'self' 'unsafe-eval'" : "script-src 'self'"
    const connectPolicy = isDevelopment
      ? "connect-src 'self' blob: ws: http:"
      : "connect-src 'self' blob:"
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          `default-src 'self'; ${scriptPolicy}; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; worker-src 'self' blob:; ${connectPolicy}`,
        ],
      },
    })
  })
}

async function createWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 1600,
    height: 980,
    minWidth: 1180,
    minHeight: 720,
    backgroundColor: '#0d0f10',
    title: 'Amazon 3D 资产检查器',
    show: false,
    webPreferences: {
      preload: resolve(currentDirectory, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event, url) => {
    const allowed = isDevelopment && url.startsWith(process.env.ELECTRON_RENDERER_URL ?? '')
    if (!allowed) event.preventDefault()
  })
  window.once('ready-to-show', () => window.show())

  if (process.env.ELECTRON_RENDERER_URL) {
    await window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    await window.loadFile(resolve(currentDirectory, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  app.setAppUserModelId('com.localtools.amazon3dassetinspector')
  installContentSecurityPolicy()
  registerIpc()
  await createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
