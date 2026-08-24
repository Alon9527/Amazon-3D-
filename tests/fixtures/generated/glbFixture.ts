const GLB_MAGIC = 0x46546c67
const JSON_CHUNK_TYPE = 0x4e4f534a
const BIN_CHUNK_TYPE = 0x004e4942

export interface FixtureChunk {
  type: number
  data: Uint8Array
  paddingByte?: number
}

function pad(data: Uint8Array, byte: number): Uint8Array {
  const paddedLength = Math.ceil(data.byteLength / 4) * 4
  const result = new Uint8Array(paddedLength)
  result.fill(byte)
  result.set(data)
  return result
}

export function createGlbFixture(
  json: Record<string, unknown>,
  bin = new Uint8Array(),
  extraChunks: FixtureChunk[] = [],
): Uint8Array {
  const encoder = new TextEncoder()
  const chunks: FixtureChunk[] = [
    { type: JSON_CHUNK_TYPE, data: encoder.encode(JSON.stringify(json)), paddingByte: 0x20 },
  ]

  if (bin.byteLength > 0) {
    chunks.push({ type: BIN_CHUNK_TYPE, data: bin })
  }
  chunks.push(...extraChunks)

  const paddedChunks = chunks.map((chunk) => ({
    type: chunk.type,
    data: pad(chunk.data, chunk.paddingByte ?? 0),
  }))
  const totalLength = 12 + paddedChunks.reduce((sum, chunk) => sum + 8 + chunk.data.byteLength, 0)
  const result = new Uint8Array(totalLength)
  const view = new DataView(result.buffer)
  view.setUint32(0, GLB_MAGIC, true)
  view.setUint32(4, 2, true)
  view.setUint32(8, totalLength, true)

  let offset = 12
  for (const chunk of paddedChunks) {
    view.setUint32(offset, chunk.data.byteLength, true)
    view.setUint32(offset + 4, chunk.type, true)
    result.set(chunk.data, offset + 8)
    offset += 8 + chunk.data.byteLength
  }

  return result
}

export const glbConstants = {
  magic: GLB_MAGIC,
  jsonChunkType: JSON_CHUNK_TYPE,
  binChunkType: BIN_CHUNK_TYPE,
}

export function createTriangleGlbFixture(options: { sceneDefined: boolean }): Uint8Array {
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0])
  const indices = new Uint16Array([0, 1, 2])
  const bin = new Uint8Array(42)
  bin.set(new Uint8Array(positions.buffer), 0)
  bin.set(new Uint8Array(indices.buffer), 36)
  const json: Record<string, unknown> = {
    asset: { version: '2.0', generator: 'Inspector generated fixture' },
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: 'VEC3',
        min: [0, 0, 0],
        max: [1, 1, 0],
      },
      { bufferView: 1, componentType: 5123, count: 3, type: 'SCALAR' },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36, target: 34962 },
      { buffer: 0, byteOffset: 36, byteLength: 6, target: 34963 },
    ],
    buffers: [{ byteLength: 42 }],
    materials: [{}],
  }
  if (options.sceneDefined) json.scene = 0
  return createGlbFixture(json, bin)
}

export function createTexturedTriangleGlbFixture(): Uint8Array {
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0])
  const textureCoordinates = new Float32Array([0, 0, 1, 0, 0, 1])
  const indices = new Uint16Array([0, 1, 2])
  const png = Uint8Array.from(
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    ),
  )
  const imageOffset = 68
  const bin = new Uint8Array(imageOffset + png.byteLength)
  bin.set(new Uint8Array(positions.buffer), 0)
  bin.set(new Uint8Array(textureCoordinates.buffer), 36)
  bin.set(new Uint8Array(indices.buffer), 60)
  bin.set(png, imageOffset)

  return createGlbFixture(
    {
      asset: { version: '2.0', generator: 'Inspector textured fixture' },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ mesh: 0 }],
      meshes: [
        {
          primitives: [
            {
              attributes: { POSITION: 0, TEXCOORD_0: 1 },
              indices: 2,
              material: 0,
            },
          ],
        },
      ],
      accessors: [
        {
          bufferView: 0,
          componentType: 5126,
          count: 3,
          type: 'VEC3',
          min: [0, 0, 0],
          max: [1, 1, 0],
        },
        { bufferView: 1, componentType: 5126, count: 3, type: 'VEC2' },
        { bufferView: 2, componentType: 5123, count: 3, type: 'SCALAR' },
      ],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: 36, target: 34962 },
        { buffer: 0, byteOffset: 36, byteLength: 24, target: 34962 },
        { buffer: 0, byteOffset: 60, byteLength: 6, target: 34963 },
        { buffer: 0, byteOffset: imageOffset, byteLength: png.byteLength },
      ],
      buffers: [{ byteLength: bin.byteLength }],
      images: [{ bufferView: 3, mimeType: 'image/png' }],
      textures: [{ source: 0 }],
      materials: [
        {
          pbrMetallicRoughness: {
            baseColorTexture: { index: 0 },
            metallicFactor: 0,
            roughnessFactor: 1,
          },
        },
      ],
    },
    bin,
  )
}
