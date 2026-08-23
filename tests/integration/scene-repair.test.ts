import { describe, expect, it } from 'vitest'
import { parseGlb } from '@core/glb/parser'
import { repairMissingDefaultScene } from '@core/repair/sceneRepair'
import { validateSceneRules } from '@core/validator/sceneRules'
import { createGlbFixture, glbConstants } from '../fixtures/generated/glbFixture'

describe('Amazon scene validation and Safe Fix', () => {
  it('reports AMZ-VIYR-SCENE-001 when scenes[0] exists but scene is omitted', () => {
    const source = createGlbFixture({
      asset: { version: '2.0' },
      scenes: [{ nodes: [0] }],
      nodes: [{}],
    })

    const issues = validateSceneRules(parseGlb(source).json)

    expect(issues).toContainEqual(
      expect.objectContaining({
        id: 'AMZ-VIYR-SCENE-001',
        severity: 'error',
        source: 'amazon-validator-observed',
        autoFixable: true,
        fixType: 'safe',
      }),
    )
  })

  it('adds scene 0 while preserving every non-JSON chunk and the input bytes', () => {
    const bin = Uint8Array.from([7, 11, 13, 17])
    const unknown = Uint8Array.from([19, 23, 29, 31])
    const source = createGlbFixture(
      { asset: { version: '2.0' }, scenes: [{ nodes: [0] }], nodes: [{}] },
      bin,
      [{ type: 0x12345678, data: unknown }],
    )
    const originalSnapshot = source.slice()

    const fixed = repairMissingDefaultScene(source)
    const before = parseGlb(source)
    const after = parseGlb(fixed)

    expect(after.json.scene).toBe(0)
    expect(after.json.scenes).toEqual(before.json.scenes)
    expect(after.chunks.slice(1)).toEqual(before.chunks.slice(1))
    expect(after.chunks[1]?.type).toBe(glbConstants.binChunkType)
    expect(after.chunks[1]?.data).toEqual(bin)
    expect(after.chunks[2]?.data).toEqual(unknown)
    expect(source).toEqual(originalSnapshot)
    expect(validateSceneRules(after.json).map((issue) => issue.id)).not.toContain(
      'AMZ-VIYR-SCENE-001',
    )
  })

  it('rejects Safe Fix when the selected default scene is not scene 0', () => {
    const source = createGlbFixture({
      asset: { version: '2.0' },
      scene: 1,
      scenes: [{ nodes: [0] }, { nodes: [1] }],
      nodes: [{}, {}],
    })

    expect(validateSceneRules(parseGlb(source).json)).toContainEqual(
      expect.objectContaining({ id: 'AMZ-VIYR-SCENE-002', autoFixable: false }),
    )
    expect(() => repairMissingDefaultScene(source)).toThrowError(
      'Safe Fix requires a missing scene and an existing valid scenes[0]',
    )
  })

  it('reports missing scenes and returns detected root nodes', () => {
    const source = createGlbFixture({
      asset: { version: '2.0' },
      nodes: [{ children: [1] }, {}, {}, { children: [2] }],
    })

    const issue = validateSceneRules(parseGlb(source).json).find(
      (candidate) => candidate.id === 'AMZ-VIYR-SCENE-003',
    )

    expect(issue).toMatchObject({ severity: 'error', autoFixable: false, actual: [0, 3] })
    expect(() => repairMissingDefaultScene(source)).toThrowError(
      'Safe Fix requires a missing scene and an existing valid scenes[0]',
    )
  })

  it('rejects scene nodes that are children of another node', () => {
    const source = createGlbFixture({
      asset: { version: '2.0' },
      scenes: [{ nodes: [1] }],
      nodes: [{ children: [1] }, {}],
    })

    const issues = validateSceneRules(parseGlb(source).json)

    expect(issues).toContainEqual(
      expect.objectContaining({ id: 'GLTF-SCENE-ROOT-001', actual: [1], autoFixable: false }),
    )
    expect(() => repairMissingDefaultScene(source)).toThrowError(
      'Safe Fix requires scene 0 to reference root nodes only',
    )
  })
})
