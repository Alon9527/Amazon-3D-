import { app, BrowserWindow, dialog, ipcMain, session, type SaveDialogOptions } from 'electron'
import { existsSync } from 'node:fs'
import { readFile, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AssetPayload, SaveFixedRequest, SaveFixedResult } from '@shared/bridge'

const currentDirectory = dirname(fileURLToPath(import.meta.url))
const isDevelopment = Boolean(process.env.ELECTRON_RENDERER_URL)

function assertGlbPath(filePath: string): void {
  if (extname(filePath).toLowerCase() !== '.glb') {
    throw new Error('Only single-file GLB assets are supported in this MVP')
  }
}

async function readAsset(filePath: string): Promise<AssetPayload> {
  assertGlbPath(filePath)
  const details = await stat(filePath)
  if (!details.isFile()) throw new Error('Selected GLB path is not a file')
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
  ipcMain.handle('inspector:open-glb', async (): Promise<AssetPayload | null> => {
    const result = await dialog.showOpenDialog({
      title: 'Open GLB',
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
        throw new Error('Invalid fixed GLB payload')
      }
      const sourceDirectory = request.sourcePath ? dirname(request.sourcePath) : app.getPath('documents')
      const defaultPath = resolve(sourceDirectory, safeSuggestedName(request.suggestedName))
      const owner = BrowserWindow.fromWebContents(event.sender)
      const options: SaveDialogOptions = {
        title: 'Export Fixed GLB',
        defaultPath,
        filters: [{ name: 'GLB 2.0', extensions: ['glb'] }],
      }
      const result = owner
        ? await dialog.showSaveDialog(owner, options)
        : await dialog.showSaveDialog(options)
      if (result.canceled || !result.filePath) return { status: 'cancelled' }
      assertGlbPath(result.filePath)
      if (request.sourcePath && samePath(result.filePath, request.sourcePath)) {
        throw new Error('The original GLB cannot be overwritten. Choose a new file name.')
      }

      await writeFile(result.filePath, request.bytes)
      const written = await readFile(result.filePath)
      if (!written.equals(Buffer.from(request.bytes))) {
        throw new Error('Export verification failed: saved bytes do not match the validated candidate')
      }
      return { status: 'saved', path: result.filePath, size: written.byteLength }
    },
  )
}

function installContentSecurityPolicy(): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const scriptPolicy = isDevelopment ? "script-src 'self' 'unsafe-eval'" : "script-src 'self'"
    const connectPolicy = isDevelopment ? "connect-src 'self' ws: http:" : "connect-src 'self'"
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
    title: 'Amazon 3D Asset Inspector',
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
