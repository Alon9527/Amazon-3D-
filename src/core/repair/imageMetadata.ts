export interface ImageCleanup {
  status: 'cleaned' | 'unchanged' | 'skipped'
  bytes: Uint8Array
  removed: string[]
  pixelData: Uint8Array
  reason?: string
}

function join(parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let offset = 0
  for (const part of parts) { result.set(part, offset); offset += part.length }
  return result
}

function text(bytes: Uint8Array): string { return new TextDecoder('ascii').decode(bytes) }

function safeExif(tiff: Uint8Array): boolean {
  if (tiff.length < 8) return false
  const little = tiff[0] === 73 && tiff[1] === 73
  if (!little && !(tiff[0] === 77 && tiff[1] === 77)) return false
  const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength)
  if (view.getUint16(2, little) !== 42) return false
  const ifd = view.getUint32(4, little)
  if (ifd < 8 || ifd + 2 > tiff.length) return false
  const count = view.getUint16(ifd, little)
  if (ifd + 2 + count * 12 + 4 > tiff.length) return false
  for (let index = 0; index < count; index++) {
    const entry = ifd + 2 + index * 12
    if (view.getUint16(entry, little) === 0x112 &&
      (view.getUint16(entry + 2, little) !== 3 || view.getUint32(entry + 4, little) !== 1 || view.getUint16(entry + 8, little) !== 1)) return false
  }
  // Multi-page TIFF cannot be proven to have a single default orientation.
  return view.getUint32(ifd + 2 + count * 12, little) === 0
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function cleanPng(bytes: Uint8Array): ImageCleanup {
  if (![137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte)) throw new Error('PNG 签名无效')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const parts = [bytes.subarray(0, 8)]
  const pixels: Uint8Array[] = []
  const removed: string[] = []
  const metadata = new Set(['cHRM', 'gAMA', 'iCCP', 'sBIT', 'sRGB', 'pHYs', 'eXIf', 'cICP', 'mDCV', 'cLLI', 'tEXt', 'iTXt', 'zTXt'])
  let offset = 8
  let hasHeader = false, hasData = false, ended = false
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) throw new Error('PNG 数据截断')
    const length = view.getUint32(offset)
    const end = offset + 12 + length
    if (end > bytes.length) throw new Error('PNG chunk 越界')
    const type = text(bytes.subarray(offset + 4, offset + 8))
    const data = bytes.subarray(offset + 8, end - 4)
    const chunk = bytes.subarray(offset, end)
    if (crc32(bytes.subarray(offset + 4, end - 4)) !== view.getUint32(end - 4)) throw new Error('PNG CRC 校验失败')
    if (!hasHeader && type !== 'IHDR') throw new Error('PNG 缺少首个 IHDR')
    if (['acTL', 'fcTL', 'fdAT'].includes(type)) throw new Error('动画 PNG 需要人工处理，不自动丢弃动画')
    if (type === 'IHDR') {
      if (hasHeader || length !== 13 || data[8] !== 8 || ![0, 2, 3, 4, 6].includes(data[9])) throw new Error('PNG 编码不在安全清理范围')
      hasHeader = true
    }
    if (type === 'eXIf' && !safeExif(data)) throw new Error('EXIF 含非默认方向或无法确认，保留原图')
    if (['tEXt', 'iTXt', 'zTXt'].includes(type) && /exif/i.test(text(data))) throw new Error('文本内嵌 EXIF 无法安全确认，保留原图')
    if (type === 'IDAT') hasData = true
    if (type === 'IEND') {
      if (length !== 0 || end !== bytes.length) throw new Error('PNG 结束块无效或存在尾部数据')
      ended = true
    }
    if (/^[A-Z]/.test(type) && !['IHDR', 'PLTE', 'IDAT', 'IEND'].includes(type)) throw new Error('未知 PNG 关键 chunk，保留原图')
    if (['IHDR', 'PLTE', 'tRNS', 'IDAT'].includes(type)) pixels.push(chunk)
    if (metadata.has(type)) removed.push(type)
    else parts.push(chunk)
    offset = end
  }
  if (!ended || !hasData) throw new Error('PNG 缺少图像数据或结束块')
  return { status: removed.length ? 'cleaned' : 'unchanged', bytes: removed.length ? join(parts) : bytes, removed, pixelData: join(pixels) }
}

function cleanJpeg(bytes: Uint8Array): ImageCleanup {
  if (bytes[0] !== 255 || bytes[1] !== 216) throw new Error('JPEG 签名无效')
  const parts = [bytes.subarray(0, 2)]
  const pixels = [bytes.subarray(0, 2)]
  const removed: string[] = []
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 2, hasFrame = false, hasScan = false, ended = false
  while (offset < bytes.length) {
    const start = offset
    if (bytes[offset++] !== 255) throw new Error('JPEG marker 无效')
    while (bytes[offset] === 255) offset++
    const marker = bytes[offset++]
    if (marker === 0xdc) throw new Error('JPEG DNL 编码需要人工处理')
    if (marker === 0xd9) {
      if (offset !== bytes.length) throw new Error('JPEG 存在尾部数据')
      parts.push(bytes.subarray(start, offset)); pixels.push(bytes.subarray(start, offset)); ended = true; break
    }
    if (marker === undefined || marker === 0 || marker === 0xd8 || marker === 1 || marker >= 0xd0 && marker <= 0xd7) throw new Error('JPEG marker 不受支持')
    if (offset + 2 > bytes.length) throw new Error('JPEG 数据截断')
    const length = view.getUint16(offset)
    const end = offset + length
    if (length < 2 || end > bytes.length) throw new Error('JPEG segment 越界')
    const data = bytes.subarray(offset + 2, end)
    let segment = bytes.subarray(start, end)
    let isMetadata = false, remove = false
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      if (![0xc0, 0xc1, 0xc2].includes(marker) || data.length < 6 || data[0] !== 8 || ![1, 3].includes(data[5])) throw new Error('JPEG 编码/CMYK 需要人工处理')
      hasFrame = true
    }
    if (marker === 0xe1 && text(data.subarray(0, 6)) === 'Exif\0\0') {
      if (!safeExif(data.subarray(6))) throw new Error('EXIF 含非默认方向或无法确认，保留原图')
      removed.push('EXIF'); isMetadata = true; remove = true
    }
    if (marker === 0xe2 && text(data.subarray(0, 12)) === 'ICC_PROFILE\0') {
      removed.push('ICC_PROFILE'); isMetadata = true; remove = true
    }
    if (marker === 0xe0 && text(data.subarray(0, 5)) === 'JFIF\0') {
      if (data.length < 14) throw new Error('JFIF 头部截断')
      isMetadata = true
      if (data[8] !== data[10] || data[9] !== data[11]) {
        segment = segment.slice()
        const dataStart = offset + 2 - start
        segment[dataStart + 10] = data[8]
        segment[dataStart + 11] = data[9]
        removed.push('JFIF 像素比例')
      }
    }
    if (!remove) parts.push(segment)
    if (!isMetadata) pixels.push(segment)
    offset = end
    if (marker === 0xda) {
      if (!hasFrame) throw new Error('JPEG 缺少帧定义')
      hasScan = true
      const scanStart = offset
      while (offset < bytes.length) {
        if (bytes[offset] === 255) {
          const next = bytes[offset + 1]
          if (next === 0 || next >= 0xd0 && next <= 0xd7) { offset += 2; continue }
          break
        }
        offset++
      }
      parts.push(bytes.subarray(scanStart, offset)); pixels.push(bytes.subarray(scanStart, offset))
    }
  }
  if (!ended || !hasFrame || !hasScan) throw new Error('JPEG 缺少帧、扫描数据或结束标记')
  return { status: removed.length ? 'cleaned' : 'unchanged', bytes: removed.length ? join(parts) : bytes, removed, pixelData: join(pixels) }
}

export function cleanupImageMetadata(bytes: Uint8Array, mimeType: string): ImageCleanup {
  try {
    if (mimeType === 'image/png') return cleanPng(bytes)
    if (mimeType === 'image/jpeg') return cleanJpeg(bytes)
    throw new Error('仅自动处理内嵌静态 PNG/JPEG')
  } catch (error) {
    return { status: 'skipped', bytes, removed: [], pixelData: new Uint8Array(), reason: error instanceof Error ? error.message : '图片无法安全清理' }
  }
}
