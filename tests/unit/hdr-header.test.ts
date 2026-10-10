import { describe, expect, it } from 'vitest'
import { inspectHdrHeader, MAX_HDR_BYTES } from '../../src/core/geometry/hdrHeader'

function header(width = 1024, height = 512): Uint8Array {
  return new TextEncoder().encode(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${height} +X ${width}\npixels`)
}

describe('local HDR safety gate', () => {
  it('accepts Radiance RGBE and CRLF headers before decoding', () => {
    expect(inspectHdrHeader(header())).toMatchObject({ width: 1024, height: 512 })
    const crlf = new TextEncoder().encode(new TextDecoder().decode(header()).replaceAll('\n', '\r\n'))
    expect(inspectHdrHeader(crlf)).toMatchObject({ width: 1024, height: 512 })
  })
  it('rejects oversized inputs, zero dimensions and allocation bombs', () => {
    expect(() => inspectHdrHeader(new Uint8Array(MAX_HDR_BYTES + 1))).toThrow('32 MB')
    expect(() => inspectHdrHeader(header(0, 100))).toThrow('分辨率')
    expect(() => inspectHdrHeader(header(32767, 32767))).toThrow('分辨率')
  })
  it('rejects other formats and missing pixel data', () => {
    expect(() => inspectHdrHeader(new TextEncoder().encode('not HDR'))).toThrow('RGBE')
    const truncated = new TextEncoder().encode('#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y 512 +X 1024\n')
    expect(() => inspectHdrHeader(truncated)).toThrow('图像数据')
  })
})
