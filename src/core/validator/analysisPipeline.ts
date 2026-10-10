import type { ModelAnalysis, VerifiedSceneRepair } from '@shared/analysis'
import { analyzeGltfJson } from '@core/geometry/gltfStats'
import { parseGlb, type GlbChunk, type ParsedGlb } from '@core/glb/parser'
import { repairMissingDefaultScene } from '@core/repair/sceneRepair'
import { validateGltfBytes } from '@core/validator/gltfValidator'
import { validateSceneRules } from '@core/validator/sceneRules'
import { planWarningCleanup } from '@core/repair/warningCleanup'

function fixedFileName(fileName: string): string {
  return fileName.toLowerCase().endsWith('.glb')
    ? `${fileName.slice(0, -4)}_Amazon-fixed.glb`
    : `${fileName}_Amazon-fixed.glb`
}

async function hashChunk(chunk: GlbChunk): Promise<string> {
  const bytes = new Uint8Array(chunk.data)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes.buffer)
  const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${chunk.type.toString(16).padStart(8, '0')}:${hash}`
}

async function nonJsonHashes(parsed: ParsedGlb): Promise<string[]> {
  return Promise.all(
    parsed.chunks
    .filter((_, index) => index !== parsed.jsonChunkIndex)
      .map((chunk) => hashChunk(chunk)),
  )
}

function equalHashes(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function geometryStatsEqual(before: ModelAnalysis, after: ModelAnalysis): boolean {
  const keys = [
    'meshCount',
    'primitiveCount',
    'vertexCount',
    'triangleCount',
    'materialCount',
    'textureCount',
    'imageCount',
  ] as const
  return keys.every((key) => before.stats[key] === after.stats[key])
}

export async function analyzeGlbBytes(
  source: Uint8Array,
  fileName: string,
): Promise<ModelAnalysis> {
  const parsed = parseGlb(source)
  const [gltfValidation] = await Promise.all([validateGltfBytes(source, fileName)])
  const cleanupPlan = planWarningCleanup(parsed, gltfValidation.issues)
  return {
    file: {
      name: fileName,
      size: source.byteLength,
      glbVersion: parsed.version,
    },
    stats: analyzeGltfJson(parsed.json),
    gltfValidation,
    amazonIssues: validateSceneRules(parsed.json),
    cleanupPlan,
  }
}

export async function createVerifiedSceneRepair(
  source: Uint8Array,
  fileName: string,
): Promise<VerifiedSceneRepair> {
  const beforeParsed = parseGlb(source)
  const before = await analyzeGlbBytes(source, fileName)
  const fixedBytes = repairMissingDefaultScene(source)
  const afterParsed = parseGlb(fixedBytes)
  const after = await analyzeGlbBytes(fixedBytes, fixedFileName(fileName))
  const [beforeHashes, afterHashes] = await Promise.all([
    nonJsonHashes(beforeParsed),
    nonJsonHashes(afterParsed),
  ])
  const nonJsonChunksIdentical = equalHashes(beforeHashes, afterHashes)
  const geometryStatsIdentical = geometryStatsEqual(before, after)
  const gltfErrorFree = after.gltfValidation.errorCount === 0
  const sceneIssueResolved = !after.amazonIssues.some(
    (issue) => issue.id === 'AMZ-VIYR-SCENE-001',
  )

  return {
    kind: 'scene',
    fixedBytes,
    before,
    after,
    checks: {
      nonJsonChunksIdentical,
      geometryStatsIdentical,
      gltfErrorFree,
      sceneIssueResolved,
      coreChecksPassed:
        nonJsonChunksIdentical && geometryStatsIdentical && gltfErrorFree && sceneIssueResolved,
    },
    nonJsonChunkHashes: {
      before: beforeHashes,
      after: afterHashes,
    },
  }
}
