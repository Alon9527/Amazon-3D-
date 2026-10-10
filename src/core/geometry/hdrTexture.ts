import { DataTexture, EquirectangularReflectionMapping, HalfFloatType, LinearFilter, LinearSRGBColorSpace, RGBAFormat } from 'three'
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'
import { inspectHdrHeader, validateHdrPixels } from './hdrHeader'

export function parseHdrTexture(bytes: Uint8Array): DataTexture {
  const { width, height } = inspectHdrHeader(bytes)
  validateHdrPixels(bytes)
  const parsed = new HDRLoader().parse(new Uint8Array(bytes).buffer)
  if (!parsed.data || parsed.data.length !== width * height * 4) throw new Error('HDR 图像数据不完整。')
  const texture = new DataTexture(parsed.data, width, height, RGBAFormat, HalfFloatType)
  texture.colorSpace = LinearSRGBColorSpace
  texture.mapping = EquirectangularReflectionMapping
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  texture.generateMipmaps = false
  texture.flipY = true
  texture.needsUpdate = true
  return texture
}
