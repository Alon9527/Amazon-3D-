import { create } from 'zustand'
import type { ProductDimensions, Unit, WorldBounds, ModelAnalysis, VerifiedSceneRepair, VerifiedWarningCleanup } from '@shared/analysis'
import type { AssetPayload } from '@shared/bridge'

export interface DisplaySettings {
  grid: boolean
  ground: boolean
  axis: boolean
  bounds: boolean
  dimensions: boolean
  wireframe: boolean
}

export type RepairStep = VerifiedSceneRepair | VerifiedWarningCleanup

export interface RepairSession {
  fixedBytes: Uint8Array
  before: ModelAnalysis
  after: ModelAnalysis
  steps: RepairStep[]
  checks: { coreChecksPassed: boolean }
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
  setRepair(repair: RepairStep & { boundsIdentical: boolean }): void
  clearRepair(): void
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
  setRepair: (step) => set((state) => ({
    repair: {
      fixedBytes: step.fixedBytes, before: state.repair?.before ?? step.before, after: step.after,
      steps: [...(state.repair?.steps ?? []), step],
      checks: { coreChecksPassed: step.checks.coreChecksPassed && (state.repair?.checks.coreChecksPassed ?? true) },
      boundsIdentical: step.boundsIdentical && (state.repair?.boundsIdentical ?? true),
    }, phase: 'ready', error: null,
  })),
  clearRepair: () => set({ repair: null, phase: 'ready', error: null, notice: null }),
  setPhase: (phase) => set({ phase }),
  setUnit: (unit) => set({ unit }),
  setExpectedInput: (key, value) =>
    set((state) => ({ expectedInput: { ...state.expectedInput, [key]: value } })),
  setTolerance: (tolerancePercent) => set({ tolerancePercent }),
  toggleDisplay: (key) => set((state) => ({ display: { ...state.display, [key]: !state.display[key] } })),
  setNotice: (notice) => set({ notice }),
  setError: (error) => set((state) => ({ error, phase: error ? 'error' : state.phase === 'error' ? 'ready' : state.phase })),
}))
