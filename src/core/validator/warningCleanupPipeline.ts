import type { VerifiedWarningCleanup } from '@shared/analysis'
import { analyzeGlbBytes } from './analysisPipeline'
import { parseGlb } from '@core/glb/parser'
import { applyWarningCleanup, embeddedImage } from '@core/repair/warningCleanup'
import { cleanupImageMetadata } from '@core/repair/imageMetadata'

function equal(left: Uint8Array, right: Uint8Array): boolean { return left.length === right.length && left.every((byte, index) => byte === right[index]) }

export async function createVerifiedWarningCleanup(source: Uint8Array, fileName: string): Promise<VerifiedWarningCleanup> {
  const before = await analyzeGlbBytes(source, fileName)
  if (before.gltfValidation.errorCount > 0) throw new Error('文件存在 glTF 错误，不能执行安全清理')
  const original = parseGlb(source)
  const plan = before.cleanupPlan!
  const applied = plan.fixableCount > 0 ? applyWarningCleanup(original, plan) : { fixedBytes: source.slice(), items: plan.items, regions: [] }
  const fixed = parseGlb(applied.fixedBytes)
  const after = await analyzeGlbBytes(applied.fixedBytes, `${fileName.replace(/\.glb$/i, '')}_Amazon-cleaned.glb`)
  const beforeBin = original.chunks.find((chunk) => chunk.type === 0x004e4942)?.data ?? new Uint8Array()
  const afterBin = fixed.chunks.find((chunk) => chunk.type === 0x004e4942)?.data ?? new Uint8Array()
  const regions = [...applied.regions].sort((left, right) => left.offset - right.offset)
  let geometryBytesIdentical = beforeBin.length === afterBin.length
  let previousEnd = 0
  for (const region of regions) {
    geometryBytesIdentical &&= equal(beforeBin.subarray(previousEnd, region.offset), afterBin.subarray(previousEnd, region.offset))
    previousEnd = region.offset + region.length
  }
  geometryBytesIdentical &&= equal(beforeBin.subarray(previousEnd), afterBin.subarray(previousEnd))
  geometryBytesIdentical &&= original.chunks.length === fixed.chunks.length && original.chunks.every((chunk, index) => index === original.jsonChunkIndex || chunk.type === 0x004e4942 || (chunk.type === fixed.chunks[index].type && equal(chunk.data, fixed.chunks[index].data)))
  const imagePayloadsIdentical = regions.every((region) => {
    const left = embeddedImage(original, region.imageIndex), right = embeddedImage(fixed, region.imageIndex)
    const originalPixels = cleanupImageMetadata(left.bytes, left.mime), fixedPixels = cleanupImageMetadata(right.bytes, right.mime)
    return originalPixels.status !== 'skipped' && fixedPixels.status !== 'skipped' && equal(originalPixels.pixelData, fixedPixels.pixelData)
  })
  const materialJsonIdentical = JSON.stringify(original.json.materials) === JSON.stringify(fixed.json.materials)
  const geometryStatsIdentical = JSON.stringify(before.stats) === JSON.stringify(after.stats)
  const gltfErrorFree = after.gltfValidation.errorCount === 0
  const targetsResolved = applied.items.filter((item) => item.status === 'fixed').every((item) => !after.gltfValidation.issues.some((issue) => issue.id === item.issueId && issue.actual === item.pointer))
  const coreChecksPassed = plan.fixableCount > 0 && geometryBytesIdentical && imagePayloadsIdentical && materialJsonIdentical && geometryStatsIdentical && gltfErrorFree && targetsResolved
  return { kind: 'warning-cleanup', before, after, fixedBytes: applied.fixedBytes, items: applied.items, changedImageCount: regions.length, checks: { geometryBytesIdentical, imagePayloadsIdentical, materialJsonIdentical, geometryStatsIdentical, gltfErrorFree, targetsResolved, coreChecksPassed } }
}
