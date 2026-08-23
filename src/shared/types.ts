export type ValidationSeverity = 'pass' | 'info' | 'warning' | 'error'
export type ValidationSource =
  | 'amazon-confirmed'
  | 'amazon-validator-observed'
  | 'gltf-standard'
  | 'best-practice'
  | 'diagnostic'
export type FixType = 'safe' | 'advanced' | 'manual'

export interface ValidationIssue {
  id: string
  category: string
  severity: ValidationSeverity
  title: string
  description: string
  actual?: unknown
  expected?: unknown
  source: ValidationSource
  autoFixable: boolean
  fixType?: FixType
}

export interface AmazonRuleDefinition {
  id: string
  name: string
  category: string
  appliesTo: Array<'amazon-3d' | 'viyr'>
  severity: ValidationSeverity
  description: string
  source: ValidationSource
  sourceUrl?: string
  lastVerified: string
  confidence: 'confirmed' | 'confirmed-observed' | 'unverified'
  autoFixable: boolean
  fixType?: FixType
}
