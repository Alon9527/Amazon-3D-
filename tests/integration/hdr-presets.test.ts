import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseHdrTexture } from '../../src/core/geometry/hdrTexture'
import { createHash } from 'node:crypto'

const manifest = JSON.parse(readFileSync(resolve('tasks/20261010-HDR环境选择-8bc88217/hdr-downloads.json'), 'utf8').replace(/^\uFEFF/, '')) as { id: string; sha256: string }[]

describe('bundled real HDR assets', () => {
  for (const asset of manifest) {
    it(`decodes and verifies ${asset.id}`, () => {
      const bytes = readFileSync(resolve(`src/renderer/assets/hdr/${asset.id}_1k.hdr`))
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(asset.sha256)
      const texture = parseHdrTexture(bytes)
      expect(texture.image.width).toBe(1024)
      expect(texture.image.height).toBe(512)
      expect(texture.image.data?.length).toBe(1024 * 512 * 4)
      texture.dispose()
      expect(() => parseHdrTexture(bytes.subarray(0, bytes.length - 100))).toThrow('截断')
    })
  }
})
