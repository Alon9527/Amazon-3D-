/** Small valid RGBE environment with a colored horizontal gradient. */
export function createHdrFixture(): Uint8Array {
  const header = new TextEncoder().encode('#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y 4 +X 4\n')
  const bytes = new Uint8Array(header.length + 4 * 4 * 4)
  bytes.set(header)
  for (let pixel = 0; pixel < 16; pixel++) bytes.set([40 + (pixel % 4) * 40, 100, 150, 129], header.length + pixel * 4)
  return bytes
}
