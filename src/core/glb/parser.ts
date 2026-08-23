export interface GlbChunk {
  type: number
  data: Uint8Array
}

export interface ParsedGlb {
  version: 2
  declaredLength: number
  chunks: GlbChunk[]
  json: Record<string, unknown>
  jsonChunkIndex: number
  jsonText: string
}

const GLB_MAGIC = 0x46546c67
const JSON_CHUNK_TYPE = 0x4e4f534a

function toBytes(input: Uint8Array | ArrayBuffer): Uint8Array {
  return input instanceof Uint8Array ? input : new Uint8Array(input)
}

function parseJsonChunk(data: Uint8Array): { json: Record<string, unknown>; jsonText: string } {
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(data)
  } catch {
    throw new Error('GLB JSON chunk is not valid UTF-8')
  }

  const jsonText = text.trimEnd()
  let value: unknown
  try {
    value = JSON.parse(jsonText)
  } catch {
    throw new Error('GLB JSON chunk is not valid JSON')
  }

  if (value === null || Array.isArray(value) || typeof value !== 'object') {
    throw new Error('GLB JSON root must be an object')
  }

  return { json: value as Record<string, unknown>, jsonText }
}

export function parseGlb(input: Uint8Array | ArrayBuffer): ParsedGlb {
  const bytes = toBytes(input)
  if (bytes.byteLength < 12) {
    throw new Error('GLB header is truncated')
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (view.getUint32(0, true) !== GLB_MAGIC) {
    throw new Error('Invalid GLB magic')
  }

  const version = view.getUint32(4, true)
  if (version !== 2) {
    throw new Error(`Unsupported GLB version: ${version}`)
  }

  const declaredLength = view.getUint32(8, true)
  if (declaredLength !== bytes.byteLength) {
    throw new Error('GLB declared length does not match file size')
  }

  const chunks: GlbChunk[] = []
  let offset = 12
  while (offset < bytes.byteLength) {
    if (offset + 8 > bytes.byteLength) {
      throw new Error('GLB chunk header is truncated')
    }

    const chunkLength = view.getUint32(offset, true)
    const chunkType = view.getUint32(offset + 4, true)
    if (chunkLength % 4 !== 0) {
      throw new Error('GLB chunk length must be 4-byte aligned')
    }

    const dataStart = offset + 8
    const dataEnd = dataStart + chunkLength
    if (dataEnd > bytes.byteLength) {
      throw new Error('GLB chunk exceeds file boundary')
    }

    chunks.push({ type: chunkType, data: bytes.slice(dataStart, dataEnd) })
    offset = dataEnd
  }

  const jsonIndexes = chunks
    .map((chunk, index) => (chunk.type === JSON_CHUNK_TYPE ? index : -1))
    .filter((index) => index >= 0)
  if (jsonIndexes.length !== 1) {
    throw new Error('GLB must contain exactly one JSON chunk')
  }

  const jsonChunkIndex = jsonIndexes[0] as number
  if (jsonChunkIndex !== 0) {
    throw new Error('GLB JSON chunk must be first')
  }

  const jsonChunk = chunks[jsonChunkIndex]
  if (!jsonChunk) {
    throw new Error('GLB JSON chunk is missing')
  }
  const { json, jsonText } = parseJsonChunk(jsonChunk.data)

  return {
    version: 2,
    declaredLength,
    chunks,
    json,
    jsonChunkIndex,
    jsonText,
  }
}
