import type { GlbChunk, ParsedGlb } from './parser'

const GLB_MAGIC = 0x46546c67
const JSON_CHUNK_TYPE = 0x4e4f534a
const MAX_UINT32 = 0xffffffff

function paddedJsonBytes(jsonText: string): Uint8Array {
  const encoded = new TextEncoder().encode(jsonText)
  const paddedLength = Math.ceil(encoded.byteLength / 4) * 4
  const result = new Uint8Array(paddedLength)
  result.fill(0x20)
  result.set(encoded)
  return result
}

export function writeGlbWithJsonText(parsed: ParsedGlb, jsonText: string): Uint8Array {
  const replacement = paddedJsonBytes(jsonText)
  const chunks: GlbChunk[] = parsed.chunks.map((chunk, index) =>
    index === parsed.jsonChunkIndex
      ? { type: JSON_CHUNK_TYPE, data: replacement }
      : { type: chunk.type, data: chunk.data },
  )
  const totalLength = 12 + chunks.reduce((sum, chunk) => sum + 8 + chunk.data.byteLength, 0)
  if (totalLength > MAX_UINT32) {
    throw new Error('GLB output exceeds the 32-bit container length limit')
  }

  const output = new Uint8Array(totalLength)
  const view = new DataView(output.buffer)
  view.setUint32(0, GLB_MAGIC, true)
  view.setUint32(4, 2, true)
  view.setUint32(8, totalLength, true)

  let offset = 12
  for (const chunk of chunks) {
    view.setUint32(offset, chunk.data.byteLength, true)
    view.setUint32(offset + 4, chunk.type, true)
    output.set(chunk.data, offset + 8)
    offset += 8 + chunk.data.byteLength
  }

  return output
}
