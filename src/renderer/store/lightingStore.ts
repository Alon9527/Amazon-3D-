import { create } from 'zustand'
import type { HdrPayload } from '@shared/bridge'
import { HDR_PRESETS, type HdrPresetId } from '../viewport/hdrPresets'

export interface LightingSettings {
  intensity: number
  exposureEV: number
  rotation: number
  showBackground: boolean
}
export type HdrSource = { id: string; name: string; url?: string; bytes?: Uint8Array }
export interface HdrStatus { phase: 'loading' | 'ready' | 'error'; activeName: string; error?: string; width?: number; height?: number }
export const DEFAULT_LIGHTING: LightingSettings = { intensity: 1, exposureEV: 0, rotation: 0, showBackground: false }

interface LightingState {
  settings: LightingSettings
  source: HdrSource
  custom: HdrSource | null
  status: HdrStatus
  setSetting<K extends keyof LightingSettings>(key: K, value: LightingSettings[K]): void
  selectPreset(id: HdrPresetId | 'custom'): void
  loadCustom(payload: HdrPayload): void
  setStatus(status: HdrStatus): void
  reset(): void
}

export const useLightingStore = create<LightingState>((set, get) => ({
  settings: { ...DEFAULT_LIGHTING },
  source: HDR_PRESETS[0],
  custom: null,
  status: { phase: 'loading', activeName: '备用中性照明' },
  setSetting: (key, value) => set((state) => ({ settings: { ...state.settings, [key]: value } })),
  selectPreset: (id) => {
    const source = id === 'custom' ? get().custom : HDR_PRESETS.find((preset) => preset.id === id)
    if (source) set({ source })
  },
  loadCustom: (payload) => {
    const custom: HdrSource = { id: 'custom', name: payload.name, bytes: new Uint8Array(payload.bytes) }
    set({ source: custom, custom })
  },
  setStatus: (status) => set({ status }),
  reset: () => set({ source: HDR_PRESETS[0], settings: { ...DEFAULT_LIGHTING } }),
}))
