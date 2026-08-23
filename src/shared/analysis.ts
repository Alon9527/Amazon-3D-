export type Unit = 'mm' | 'cm' | 'inch'
export type AxisMappingCode = 'XYZ' | 'XZY' | 'YXZ' | 'YZX' | 'ZXY' | 'ZYX'
export type DimensionStatus = 'pass' | 'warning' | 'fail'

export interface AxisDimensions {
  x: number
  y: number
  z: number
}

export interface ProductDimensions {
  width: number
  height: number
  depth: number
}

export interface AxisMappingResult {
  code: AxisMappingCode
  widthAxis: keyof AxisDimensions
  heightAxis: keyof AxisDimensions
  depthAxis: keyof AxisDimensions
  relativeErrors: ProductDimensions
  meanError: number
  maxError: number
}

export interface DimensionComparison {
  status: DimensionStatus
  tolerancePercent: number
  mappings: AxisMappingResult[]
  bestMapping: AxisMappingResult
  identityMapping: AxisMappingResult
  confidence: number
  ambiguous: boolean
  possibleAxisSwap: boolean
}

export interface Vector3Value {
  x: number
  y: number
  z: number
}

export interface WorldBounds {
  min: Vector3Value
  max: Vector3Value
  size: AxisDimensions
  center: Vector3Value
}

export interface ModelStats {
  gltfVersion: string
  generator?: string
  sceneCount: number
  defaultScene: number | null
  nodeCount: number
  meshCount: number
  primitiveCount: number
  vertexCount: number
  triangleCount: number
  drawCallEstimate: number
  materialCount: number
  textureCount: number
  imageCount: number
  animationCount: number
  cameraCount: number
  lightCount: number
  skinCount: number
}

export interface GltfValidationSummary {
  validatorVersion: string
  errorCount: number
  warningCount: number
  infoCount: number
  hintCount: number
  issues: import('./types').ValidationIssue[]
}

export interface FileMetadata {
  name: string
  size: number
  glbVersion: 2
}

export interface ModelAnalysis {
  file: FileMetadata
  stats: ModelStats
  gltfValidation: GltfValidationSummary
  amazonIssues: import('./types').ValidationIssue[]
}

export interface RepairChecks {
  nonJsonChunksIdentical: boolean
  geometryStatsIdentical: boolean
  gltfErrorFree: boolean
  sceneIssueResolved: boolean
  coreChecksPassed: boolean
}

export interface VerifiedSceneRepair {
  fixedBytes: Uint8Array
  before: ModelAnalysis
  after: ModelAnalysis
  checks: RepairChecks
  nonJsonChunkHashes: {
    before: string[]
    after: string[]
  }
}
