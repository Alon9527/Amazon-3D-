import { describe, expect, it } from 'vitest'
import { analyzeGltfJson } from '@core/geometry/gltfStats'

describe('analyzeGltfJson', () => {
  it('counts triangles for TRIANGLES, TRIANGLE_STRIP, and TRIANGLE_FAN primitives', () => {
    const result = analyzeGltfJson({
      asset: { version: '2.0', generator: 'Cinema 4D' },
      accessors: [{ count: 12 }, { count: 8 }, { count: 5 }, { count: 6 }],
      meshes: [
        {
          primitives: [
            { attributes: { POSITION: 0 }, indices: 1 },
            { attributes: { POSITION: 0 }, indices: 2, mode: 5 },
            { attributes: { POSITION: 0 }, indices: 3, mode: 6 },
          ],
        },
      ],
    })

    expect(result.triangleCount).toBe(9)
    expect(result.vertexCount).toBe(36)
    expect(result.primitiveCount).toBe(3)
    expect(result.drawCallEstimate).toBe(3)
  })

  it('reports model resource counts and punctual lights', () => {
    const result = analyzeGltfJson({
      asset: { version: '2.0', generator: 'Cinema 4D 2026' },
      scene: 0,
      scenes: [{}],
      nodes: [{}, {}],
      meshes: [{ primitives: [] }],
      materials: [{}, {}],
      textures: [{}, {}, {}],
      images: [{}],
      animations: [{}],
      cameras: [{}],
      skins: [{}],
      extensions: { KHR_lights_punctual: { lights: [{}, {}] } },
    })

    expect(result).toMatchObject({
      gltfVersion: '2.0',
      generator: 'Cinema 4D 2026',
      sceneCount: 1,
      defaultScene: 0,
      nodeCount: 2,
      meshCount: 1,
      materialCount: 2,
      textureCount: 3,
      imageCount: 1,
      animationCount: 1,
      cameraCount: 1,
      lightCount: 2,
      skinCount: 1,
    })
  })
})
