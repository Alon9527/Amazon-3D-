import { describe, expect, it } from 'vitest'
import { analyzeGlbBytes, createVerifiedSceneRepair } from '@core/validator/analysisPipeline'
import { createTriangleGlbFixture } from '../fixtures/generated/glbFixture'

describe('GLB analysis and repair transaction', () => {
  it('combines file metadata, geometry statistics, glTF validation, and Amazon rules', async () => {
    const source = createTriangleGlbFixture({ sceneDefined: false })

    const analysis = await analyzeGlbBytes(source, 'triangle.glb')

    expect(analysis.file).toMatchObject({ name: 'triangle.glb', size: source.byteLength, glbVersion: 2 })
    expect(analysis.stats).toMatchObject({ triangleCount: 1, vertexCount: 3, materialCount: 1 })
    expect(analysis.gltfValidation.errorCount).toBe(0)
    expect(analysis.amazonIssues.map((issue) => issue.id)).toContain('AMZ-VIYR-SCENE-001')
  })

  it('revalidates a repair and proves non-JSON bytes and geometry statistics are unchanged', async () => {
    const source = createTriangleGlbFixture({ sceneDefined: false })

    const result = await createVerifiedSceneRepair(source, 'triangle.glb')

    expect(result.after.stats.defaultScene).toBe(0)
    expect(result.checks).toMatchObject({
      nonJsonChunksIdentical: true,
      geometryStatsIdentical: true,
      gltfErrorFree: true,
      sceneIssueResolved: true,
      coreChecksPassed: true,
    })
    expect(result.nonJsonChunkHashes.before).toEqual(result.nonJsonChunkHashes.after)
    expect(result.before.stats).toMatchObject({ triangleCount: 1, vertexCount: 3 })
    expect(result.after.stats).toMatchObject({ triangleCount: 1, vertexCount: 3 })
  })
})
