import type { ModelAnalysis, VerifiedSceneRepair } from './analysis'

export interface AssetPayload {
  name: string
  path: string
  bytes: Uint8Array
}

export interface SaveFixedRequest {
  sourcePath: string
  suggestedName: string
  bytes: Uint8Array
}

export type SaveFixedResult =
  | { status: 'cancelled' }
  | { status: 'saved'; path: string; size: number }

export interface InspectorBridge {
  openGlb(): Promise<AssetPayload | null>
  getLaunchAsset(): Promise<AssetPayload | null>
  getPathForFile(file: unknown): string
  saveFixed(request: SaveFixedRequest): Promise<SaveFixedResult>
}

export type AnalysisWorkerRequest =
  | { id: number; type: 'analyze'; bytes: Uint8Array; fileName: string }
  | { id: number; type: 'repair'; bytes: Uint8Array; fileName: string }

export type AnalysisWorkerResponse =
  | { id: number; ok: true; type: 'analyze'; result: ModelAnalysis }
  | { id: number; ok: true; type: 'repair'; result: VerifiedSceneRepair }
  | { id: number; ok: false; error: string }
