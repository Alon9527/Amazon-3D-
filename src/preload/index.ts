import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { InspectorBridge, SaveFixedRequest } from '@shared/bridge'

const bridge: InspectorBridge = {
  openGlb: () => ipcRenderer.invoke('inspector:open-glb'),
  getLaunchAsset: () => ipcRenderer.invoke('inspector:get-launch-asset'),
  getPathForFile: (file) => webUtils.getPathForFile(file as File),
  saveFixed: (request: SaveFixedRequest) => ipcRenderer.invoke('inspector:save-fixed', request),
}

contextBridge.exposeInMainWorld('inspector', bridge)
