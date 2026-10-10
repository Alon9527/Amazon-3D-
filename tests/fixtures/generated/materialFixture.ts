import { BoxGeometry } from 'three'
import { createGlbFixture } from './glbFixture'

/** Three unchanged PBR swatches for visual lighting checks: cream, metal, dark plastic. */
export function createMaterialGlbFixture(): Uint8Array {
  const geometry = new BoxGeometry(0.7, 1, 0.7)
  const positions = new Float32Array(geometry.attributes.position.array)
  const normals = new Float32Array(geometry.attributes.normal.array)
  const indices = new Uint16Array(geometry.index!.array)
  const normalOffset = positions.byteLength
  const indexOffset = normalOffset + normals.byteLength
  const bin = new Uint8Array(indexOffset + indices.byteLength)
  bin.set(new Uint8Array(positions.buffer))
  bin.set(new Uint8Array(normals.buffer), normalOffset)
  bin.set(new Uint8Array(indices.buffer), indexOffset)
  geometry.dispose()
  return createGlbFixture({
    asset: { version: '2.0', generator: 'Inspector material lighting fixture' },
    scene: 0, scenes: [{ nodes: [0, 1, 2] }],
    nodes: [{ mesh: 0, translation: [-0.95, 0.5, 0] }, { mesh: 1, translation: [0, 0.5, 0] }, { mesh: 2, translation: [0.95, 0.5, 0] }],
    meshes: [0, 1, 2].map((material) => ({ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material }] })),
    accessors: [
      { bufferView: 0, componentType: 5126, count: positions.length / 3, type: 'VEC3', min: [-0.35, -0.5, -0.35], max: [0.35, 0.5, 0.35] },
      { bufferView: 1, componentType: 5126, count: normals.length / 3, type: 'VEC3' },
      { bufferView: 2, componentType: 5123, count: indices.length, type: 'SCALAR' },
    ],
    bufferViews: [{ buffer: 0, byteLength: positions.byteLength, target: 34962 }, { buffer: 0, byteOffset: normalOffset, byteLength: normals.byteLength, target: 34962 }, { buffer: 0, byteOffset: indexOffset, byteLength: indices.byteLength, target: 34963 }],
    buffers: [{ byteLength: bin.byteLength }],
    materials: [
      { pbrMetallicRoughness: { baseColorFactor: [0.64, 0.59, 0.48, 1], metallicFactor: 0, roughnessFactor: 0.45 } },
      { pbrMetallicRoughness: { baseColorFactor: [0.7, 0.7, 0.7, 1], metallicFactor: 1, roughnessFactor: 0.25 } },
      { pbrMetallicRoughness: { baseColorFactor: [0.025, 0.025, 0.025, 1], metallicFactor: 0, roughnessFactor: 0.5 } },
    ],
  }, bin)
}
