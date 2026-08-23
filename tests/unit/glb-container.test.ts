import { describe, expect, it } from 'vitest'
import { parseGlb } from '@core/glb/parser'
import { createGlbFixture, glbConstants } from '../fixtures/generated/glbFixture'

describe('parseGlb', () => {
  it('parses GLB 2.0 JSON and preserves non-JSON chunk bytes', () => {
    const bin = Uint8Array.from([1, 2, 3, 4])
    const source = createGlbFixture({ asset: { version: '2.0' }, scenes: [{ nodes: [0] }] }, bin)

    const parsed = parseGlb(source)

    expect(parsed.version).toBe(2)
    expect(parsed.json).toMatchObject({ scenes: [{ nodes: [0] }] })
    expect(parsed.chunks).toHaveLength(2)
    expect(parsed.chunks[1]?.type).toBe(glbConstants.binChunkType)
    expect(parsed.chunks[1]?.data).toEqual(bin)
  })

  it('rejects an invalid magic value', () => {
    const source = createGlbFixture({ asset: { version: '2.0' } })
    new DataView(source.buffer).setUint32(0, 0, true)

    expect(() => parseGlb(source)).toThrowError('Invalid GLB magic')
  })

  it('rejects a declared length that does not match the file', () => {
    const source = createGlbFixture({ asset: { version: '2.0' } })
    new DataView(source.buffer).setUint32(8, source.byteLength + 4, true)

    expect(() => parseGlb(source)).toThrowError('GLB declared length does not match file size')
  })

  it('rejects a truncated chunk payload', () => {
    const source = createGlbFixture({ asset: { version: '2.0' } })
    const truncated = source.slice(0, -2)
    new DataView(truncated.buffer).setUint32(8, truncated.byteLength, true)

    expect(() => parseGlb(truncated)).toThrowError('GLB chunk exceeds file boundary')
  })

  it('rejects duplicate JSON chunks', () => {
    const duplicateJson = new TextEncoder().encode('{"scene":0}')
    const source = createGlbFixture(
      { asset: { version: '2.0' } },
      new Uint8Array(),
      [{ type: glbConstants.jsonChunkType, data: duplicateJson, paddingByte: 0x20 }],
    )

    expect(() => parseGlb(source)).toThrowError('GLB must contain exactly one JSON chunk')
  })
})
