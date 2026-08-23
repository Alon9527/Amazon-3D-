import { create } from 'zustand'
import type { ProductDimensions, Unit, WorldBounds, ModelAnalysis, VerifiedSceneRepair } from '@shared/analysis'
import type { AssetPayload } from '@shared/bridge'

export interface DisplaySettings {
  grid: boolean
  ground: boolean
  axis: boolean
  bounds: boolean
  dimensions: boolean
  wireframe: boolean
}

export interface RepairSession extends VerifiedSceneRepair {
  boundsIdentical: boolean
}

type Phase = 'empty' | 'loading' | 'ready' | 'repairing' | 'error'

interface InspectorState {
  phase: Phase
  asset: AssetPayload | null
  analysis: ModelAnalysis | null
  bounds: WorldBounds | null
  repair: RepairSession | null
  unit: Unit
  expectedInput: Record<keyof ProductDimensions, string>
  tolerancePercent: number
  display: DisplaySettings
  notice: string | null
  error: string | null
  setSession(asset: AssetPayload): void
  setAnalysis(analysis: ModelAnalysis): void
  setBounds(bounds: WorldBounds): void
  setRepair(repair: RepairSession): void
  setPhase(phase: Phase): void
  setUnit(unit: Unit): void
  setExpectedInput(key: keyof ProductDimensions, value: string): void
  setTolerance(value: number): void
  toggleDisplay(key: keyof DisplaySettings): void
  setNotice(notice: string | null): void
  setError(error: string | null): void
}

export const useInspectorStore = create<InspectorState>((set) => ({
  phase: 'empty',
  asset: null,
  analysis: null,
  bounds: null,
  repair: null,
  unit: 'cm',
  expectedInput: { width: '', height: '', depth: '' },
  tolerancePercent: 1,
  display: { grid: true, ground: true, axis: true, bounds: true, dimensions: true, wireframe: false },
  notice: null,
  error: null,
  setSession: (asset) =>
    set({ asset, analysis: null, bounds: null, repair: null, phase: 'loading', notice: null, error: null }),
  setAnalysis: (analysis) => set({ analysis, phase: 'ready', error: null }),
  setBounds: (bounds) => set({ bounds }),
  setRepair: (repair) => set({ repair, phase: 'ready', error: null }),
  setPhase: (phase) => set({ phase }),
  setUnit: (unit) => set({ unit }),
  setExpectedInput: (key, value) =>
    set((state) => ({ expectedInput: { ...state.expectedInput, [key]: value } })),
  setTolerance: (tolerancePercent) => set({ tolerancePercent }),
  toggleDisplay: (key) => set((state) => ({ display: { ...state.display, [key]: !state.display[key] } })),
  setNotice: (notice) => set({ notice }),
  setError: (error) => set({ error, phase: error ? 'error' : 'ready' }),
}))
