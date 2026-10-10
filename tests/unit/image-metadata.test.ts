import { describe, expect, it } from 'vitest'
import { cleanupImageMetadata } from '../../src/core/repair/imageMetadata'
import { fixturePng, fixtureJpeg, pngChunk, exifTiff, jpegSegment } from '../fixtures/generated/warningFixture'

describe('lossless image metadata cleanup', () => {
  it('removes PNG non-square pixel metadata without touching compressed samples', () => {
    const source = fixturePng()
    const result = cleanupImageMetadata(source, 'image/png')
    expect(result.status).toBe('cleaned')
    expect(result.removed).toEqual(['pHYs'])
    expect(result.bytes.length).toBeLessThan(source.length)
    expect(cleanupImageMetadata(result.bytes, 'image/png').pixelData).toEqual(result.pixelData)
    expect(source).toEqual(fixturePng())
  })
  it('preserves APNG and non-default EXIF orientation rather than flattening them', () => {
    const animated = fixturePng(pngChunk('acTL', new Uint8Array(8)))
    expect(cleanupImageMetadata(animated, 'image/png')).toMatchObject({ status: 'skipped', bytes: animated })
    expect(cleanupImageMetadata(fixturePng(pngChunk('eXIf', exifTiff(6))), 'image/png').status).toBe('skipped')
    expect(cleanupImageMetadata(fixtureJpeg(6), 'image/jpeg').status).toBe('skipped')
  })
  it('removes JPEG ICC and safe EXIF but preserves stuffed bytes and restart markers', () => {
    const result = cleanupImageMetadata(fixtureJpeg(), 'image/jpeg')
    expect(result.status).toBe('cleaned')
    expect(result.removed).toEqual(['EXIF', 'ICC_PROFILE'])
    expect(cleanupImageMetadata(result.bytes, 'image/jpeg').pixelData).toEqual(result.pixelData)
    expect([...result.bytes]).toEqual(expect.arrayContaining([11, 22, 33]))
  })
  it('rejects truncated, corrupt or unsupported images without modifying bytes', () => {
    const bad = fixturePng().slice(0, -3)
    expect(cleanupImageMetadata(bad, 'image/png')).toMatchObject({ status: 'skipped', bytes: bad })
    const crcBad = fixturePng(); crcBad[40] ^= 1
    expect(cleanupImageMetadata(crcBad, 'image/png').status).toBe('skipped')
    expect(cleanupImageMetadata(fixturePng(), 'image/webp').status).toBe('skipped')
  })
  it('retains multiple JPEG scan payloads and rejects unsupported DNL coding', () => {
    const first = fixtureJpeg().slice(0, -2)
    const second = jpegSegment(0xda, new Uint8Array([1, 1, 0, 0, 63, 0]))
    const multi = new Uint8Array([...first, ...second, 7, 8, 255, 0, 9, 255, 217])
    const clean = cleanupImageMetadata(multi, 'image/jpeg')
    expect(clean.status).toBe('cleaned')
    expect(cleanupImageMetadata(clean.bytes, 'image/jpeg').pixelData).toEqual(clean.pixelData)
    const dnl = new Uint8Array([...first, ...jpegSegment(0xdc, new Uint8Array([0, 1])), 255, 217])
    expect(cleanupImageMetadata(dnl, 'image/jpeg')).toMatchObject({ status: 'skipped', bytes: dnl })
  })
})
