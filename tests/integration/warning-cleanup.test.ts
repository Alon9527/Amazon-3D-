import { describe, expect, it } from 'vitest'
import { parseGlb } from '../../src/core/glb/parser'
import { analyzeGlbBytes, createVerifiedSceneRepair } from '../../src/core/validator/analysisPipeline'
import { createVerifiedWarningCleanup } from '../../src/core/validator/warningCleanupPipeline'
import { createWarningGlbFixture } from '../fixtures/generated/warningFixture'
import { createGlbFixture } from '../fixtures/generated/glbFixture'

describe('verified one-click warning cleanup', () => {
  it('actually resolves two unused UVs and two image warnings, preserving geometry and pixel payloads', async () => {
    const source = createWarningGlbFixture()
    const snapshot = source.slice()
    const result = await createVerifiedWarningCleanup(source, 'product.glb')
    expect(result.items.filter((item) => item.status === 'fixed')).toHaveLength(4)
    expect(result.before.gltfValidation.warningCount).toBe(2)
    expect(result.after.gltfValidation.warningCount).toBe(0)
    expect(result.after.gltfValidation.issues.filter((issue) => issue.id === 'GLTF-UNUSED_OBJECT')).toHaveLength(0)
    expect(result.checks.coreChecksPassed).toBe(true)
    expect(result.checks.geometryBytesIdentical).toBe(true)
    expect(result.checks.imagePayloadsIdentical).toBe(true)
    expect(parseGlb(result.fixedBytes).chunks[1].data.subarray(0, 68)).toEqual(parseGlb(source).chunks[1].data.subarray(0, 68))
    expect(result.after.stats).toEqual(result.before.stats)
    expect(source).toEqual(snapshot)
  })
  it('retains used UVs and skips animated images and unknown extension UV usage', async () => {
    const result = await createVerifiedWarningCleanup(createWarningGlbFixture({ animation: true, extensions: true }), 'animated.glb')
    expect(result.items.every((item) => item.status === 'skipped')).toBe(true)
    expect(result.checks.coreChecksPassed).toBe(false)
    expect(result.fixedBytes).toEqual(createWarningGlbFixture({ animation: true, extensions: true }))
  })
  it('skips shared image buffers and retains the used UV attribute', async () => {
    const result = await createVerifiedWarningCleanup(createWarningGlbFixture({ shared: true }), 'shared.glb')
    expect(result.items.some((item) => item.kind === 'image' && item.status === 'skipped')).toBe(true)
    const meshes = parseGlb(result.fixedBytes).json.meshes as { primitives: { attributes: Record<string, number> }[] }[]
    expect(meshes[0].primitives[0].attributes.TEXCOORD_0).toBe(1)
    expect(meshes[1].primitives[0].attributes.TEXCOORD_0).toBeUndefined()
  })
  it('composes with scene:0 repair in both orders without losing prior cleanup', async () => {
    const source = createWarningGlbFixture({ sceneDefined: false })
    const clean = await createVerifiedWarningCleanup(source, 'product.glb')
    expect(clean.after.amazonIssues.some((issue) => issue.id === 'AMZ-VIYR-SCENE-001')).toBe(true)
    const scene = await createVerifiedSceneRepair(clean.fixedBytes, 'product.glb')
    expect(scene.after.gltfValidation.warningCount).toBe(0)
    expect(scene.checks.nonJsonChunksIdentical).toBe(true)
    const reversed = await createVerifiedWarningCleanup((await createVerifiedSceneRepair(source, 'product.glb')).fixedBytes, 'product.glb')
    expect(reversed.after.stats.defaultScene).toBe(0)
    expect((await analyzeGlbBytes(reversed.fixedBytes, 'reopened.glb')).gltfValidation.warningCount).toBe(0)
  })
  it('does not modify image byte ranges potentially referenced by unknown extensions', async () => {
    const parsed = parseGlb(createWarningGlbFixture({ extensions: true }))
    parsed.json.extensions = { UNKNOWN_test: { buffer: 0, byteOffset: 68, byteLength: 100 } }
    const source = createGlbFixture(parsed.json, new Uint8Array(parsed.chunks[1].data))
    const result = await createVerifiedWarningCleanup(source, 'unknown.glb')
    expect(result.fixedBytes).toEqual(source)
    expect(result.changedImageCount).toBe(0)
    expect(result.checks.coreChecksPassed).toBe(false)
  })
  it('prunes a newly orphaned UV accessor/view and remaps remaining indices without moving BIN', async () => {
    const parsed = parseGlb(createWarningGlbFixture())
    const accessors = parsed.json.accessors as { bufferView: number }[]
    const views = parsed.json.bufferViews as Record<string, unknown>[]
    const meshes = parsed.json.meshes as { primitives: { attributes: Record<string, number>; indices: number }[] }[]
    const images = parsed.json.images as { bufferView: number }[]
    for (const accessor of accessors) if (accessor.bufferView >= 1) accessor.bufferView++
    views.splice(1, 0, structuredClone(views[1]))
    accessors.splice(1, 0, { ...accessors[1], bufferView: 1 })
    for (const mesh of meshes) for (const primitive of mesh.primitives) {
      primitive.indices++
      primitive.attributes.TEXCOORD_0++
    }
    meshes[1].primitives[0].attributes.TEXCOORD_0 = 1
    meshes[2].primitives[0].attributes.TEXCOORD_0 = 1
    for (const image of images) image.bufferView++
    const result = await createVerifiedWarningCleanup(createGlbFixture(parsed.json, new Uint8Array(parsed.chunks[1].data)), 'prune.glb')
    expect(result.checks.coreChecksPassed).toBe(true)
    expect(parseGlb(result.fixedBytes).json.accessors).toHaveLength(3)
    expect(parseGlb(result.fixedBytes).json.bufferViews).toHaveLength(5)
    expect(result.after.gltfValidation.infoCount).toBe(0)
  })
})
