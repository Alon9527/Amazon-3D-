import { parseGlb } from '../../../src/core/glb/parser'
import { createGlbFixture, createTexturedTriangleGlbFixture } from './glbFixture'

export function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(data.length + 12)
  const view = new DataView(bytes.buffer)
  view.setUint32(0, data.length)
  bytes.set(new TextEncoder().encode(type), 4)
  bytes.set(data, 8)
  let crc = 0xffffffff
  for (const byte of bytes.subarray(4, bytes.length - 4)) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
  }
  view.setUint32(bytes.length - 4, (crc ^ 0xffffffff) >>> 0)
  return bytes
}

export function fixturePng(extra?: Uint8Array): Uint8Array {
  const original = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGP4z8DwHwwZGP7//w9kAABHygj4/BTyWgAAAABJRU5ErkJggg==', 'base64'))
  const density = new Uint8Array(9)
  new DataView(density.buffer).setUint32(0, 4000)
  new DataView(density.buffer).setUint32(4, 8000)
  density[8] = 1
  const metadata = extra ?? pngChunk('pHYs', density)
  const bytes = new Uint8Array(original.length + metadata.length)
  bytes.set(original.subarray(0, 33))
  bytes.set(metadata, 33)
  bytes.set(original.subarray(33), 33 + metadata.length)
  return bytes
}

export function exifTiff(orientation = 1): Uint8Array {
  const bytes = new Uint8Array(26)
  bytes.set([0x49, 0x49, 42, 0, 8, 0, 0, 0])
  const view = new DataView(bytes.buffer)
  view.setUint16(8, 1, true)
  view.setUint16(10, 0x112, true)
  view.setUint16(12, 3, true)
  view.setUint32(14, 1, true)
  view.setUint16(18, orientation, true)
  return bytes
}

export function jpegSegment(marker: number, data: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(data.length + 4)
  bytes.set([255, marker])
  new DataView(bytes.buffer).setUint16(2, data.length + 2)
  bytes.set(data, 4)
  return bytes
}

export function fixtureJpeg(orientation = 1): Uint8Array {
  const exif = new Uint8Array(32)
  exif.set(new TextEncoder().encode('Exif\0\0'))
  exif.set(exifTiff(orientation), 6)
  const chunks = [new Uint8Array([255, 216]), jpegSegment(0xe1, exif), jpegSegment(0xe2, new TextEncoder().encode('ICC_PROFILE\0\x01\x01profile')), jpegSegment(0xc0, new Uint8Array([8, 0, 1, 0, 1, 3, 1, 0x11, 0, 2, 0x11, 0, 3, 0x11, 0])), jpegSegment(0xda, new Uint8Array([3, 1, 0, 2, 0, 3, 0, 0, 63, 0])), new Uint8Array([11, 255, 0, 22, 255, 208, 33, 255, 217])]
  const bytes = new Uint8Array(chunks.reduce((sum, part) => sum + part.length, 0))
  let offset = 0
  for (const part of chunks) { bytes.set(part, offset); offset += part.length }
  return bytes
}

export function createWarningGlbFixture(options: { sceneDefined?: boolean; animation?: boolean; extensions?: boolean; shared?: boolean; imageBytes?: Uint8Array; mimeType?: string } = {}): Uint8Array {
  const base = parseGlb(createTexturedTriangleGlbFixture())
  const json = base.json
  const image = options.imageBytes ?? fixturePng(options.animation ? pngChunk('acTL', new Uint8Array([0, 0, 0, 1, 0, 0, 0, 0])) : undefined)
  const geometry = base.chunks[1].data.subarray(0, 68)
  const paddedImage = Math.ceil(image.length / 4) * 4
  const bin = new Uint8Array(68 + paddedImage * 2)
  bin.set(geometry)
  bin.set(image, 68)
  bin.set(image, 68 + paddedImage)
  const primitive = { attributes: { POSITION: 0, TEXCOORD_0: 1 }, indices: 2, material: 1 }
  ;(json.meshes as unknown[]).push({ primitives: [structuredClone(primitive)] }, { primitives: [structuredClone(primitive)] })
  ;(json.nodes as unknown[]).push({ mesh: 1 }, { mesh: 2 })
  json.scenes = [{ nodes: [0, 1, 2] }]
  json.materials = [...(json.materials as unknown[]), { pbrMetallicRoughness: { metallicFactor: 0 } }]
  ;(json.bufferViews as unknown[])[3] = { buffer: 0, byteOffset: 68, byteLength: image.length }
  ;(json.bufferViews as unknown[]).push({ buffer: 0, byteOffset: 68 + paddedImage, byteLength: image.length })
  json.images = [{ bufferView: 3, mimeType: options.mimeType ?? 'image/png' }, { bufferView: options.shared ? 3 : 4, mimeType: options.mimeType ?? 'image/png' }]
  json.textures = [{ source: 0 }, { source: 1 }]
  json.materials = [...(json.materials as unknown[]), { pbrMetallicRoughness: { baseColorTexture: { index: 1 }, metallicFactor: 0 } }]
  ;(json.meshes as unknown[]).push({ primitives: [{ attributes: { POSITION: 0, TEXCOORD_0: 1 }, indices: 2, material: 2 }] })
  ;(json.nodes as unknown[]).push({ mesh: 3 })
  json.scenes = [{ nodes: [0, 1, 2, 3] }]
  json.buffers = [{ byteLength: bin.length }]
  if (options.sceneDefined === false) delete json.scene
  if (options.extensions) json.extensionsUsed = ['UNKNOWN_test']
  return createGlbFixture(json, bin)
}
