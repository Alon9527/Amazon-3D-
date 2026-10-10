export const MAX_HDR_BYTES = 32 * 1024 * 1024
export const MAX_HDR_PIXELS = 4096 * 2048

/** Check dimensions before the decoder allocates memory. Only Radiance RGBE is supported. */
export function inspectHdrHeader(bytes: Uint8Array): { width: number; height: number; dataOffset: number } {
  if (bytes.byteLength > MAX_HDR_BYTES) throw new Error('HDR 文件超过 32 MB，请使用较低分辨率版本。')
  const header = new TextDecoder('ascii').decode(bytes.subarray(0, 16 * 1024))
  if (!/^#\?(RADIANCE|RGBE)\r?\n/.test(header) || !/^FORMAT=32-bit_rle_rgbe\r?$/m.test(header)) {
    throw new Error('文件不是支持的 Radiance RGBE HDR；当前不支持 EXR。')
  }
  const match = /^-Y\s+(\d+)\s+\+X\s+(\d+)\r?$/m.exec(header)
  if (!match) throw new Error('HDR 头部缺失尺寸或方向不受支持（需要 -Y +X）。')
  const height = Number(match[1])
  const width = Number(match[2])
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || width > 4096 || height > 4096 || width * height > MAX_HDR_PIXELS) {
    throw new Error('HDR 分辨率过大或无效；最多 4096 × 2048 像素（约 8 百万像素）。')
  }
  const dataOffset = (match.index + match[0].length + 1)
  if (bytes.byteLength <= dataOffset) throw new Error('HDR 缺少图像数据。')
  return { width, height, dataOffset }
}

/** Reject truncated RLE streams that some decoders silently pad with black pixels. */
export function validateHdrPixels(bytes: Uint8Array): void {
  const { width, height, dataOffset } = inspectHdrHeader(bytes)
  let offset = dataOffset
  const incomplete = () => { throw new Error('HDR 图像数据截断或扫描线无效。') }
  if (width < 8 || bytes[offset] !== 2 || bytes[offset + 1] !== 2 || (bytes[offset + 2] & 0x80)) {
    if (bytes.length - offset < width * height * 4) incomplete()
    return
  }
  for (let row = 0; row < height; row++) {
    if (offset + 4 > bytes.length || bytes[offset] !== 2 || bytes[offset + 1] !== 2 || (bytes[offset + 2] * 256 + bytes[offset + 3]) !== width) incomplete()
    offset += 4
    for (let channel = 0; channel < 4; channel++) {
      let count = 0
      while (count < width) {
        if (offset >= bytes.length) incomplete()
        const run = bytes[offset++]
        const length = run > 128 ? run - 128 : run
        if (length === 0 || count + length > width) incomplete()
        offset += run > 128 ? 1 : length
        if (offset > bytes.length) incomplete()
        count += length
      }
    }
  }
}
