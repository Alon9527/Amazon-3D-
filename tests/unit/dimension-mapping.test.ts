import { describe, expect, it } from 'vitest'
import { compareDimensions } from '@core/units/dimensionMapping'
import type { AxisMappingCode } from '@shared/analysis'

const expected = { width: 0.396, height: 0.625, depth: 0.269 }

describe('compareDimensions', () => {
  it('passes an identity XYZ mapping within tolerance', () => {
    const result = compareDimensions({ x: 0.396, y: 0.625, z: 0.269 }, expected, 1)

    expect(result.status).toBe('pass')
    expect(result.bestMapping.code).toBe('XYZ')
    expect(result.possibleAxisSwap).toBe(false)
  })

  it('detects a possible X/Z swap as ZYX', () => {
    const result = compareDimensions({ x: 0.269, y: 0.625, z: 0.396 }, expected, 1)

    expect(result.status).toBe('warning')
    expect(result.bestMapping.code).toBe('ZYX')
    expect(result.possibleAxisSwap).toBe(true)
    expect(result.confidence).toBeGreaterThan(99)
  })

  it('evaluates every Width/Height/Depth to XYZ permutation', () => {
    const cases: Array<[{ x: number; y: number; z: number }, AxisMappingCode]> = [
      [{ x: expected.width, y: expected.height, z: expected.depth }, 'XYZ'],
      [{ x: expected.width, y: expected.depth, z: expected.height }, 'XZY'],
      [{ x: expected.height, y: expected.width, z: expected.depth }, 'YXZ'],
      [{ x: expected.depth, y: expected.width, z: expected.height }, 'YZX'],
      [{ x: expected.height, y: expected.depth, z: expected.width }, 'ZXY'],
      [{ x: expected.depth, y: expected.height, z: expected.width }, 'ZYX'],
    ]

    for (const [actual, mapping] of cases) {
      expect(compareDimensions(actual, expected, 1).bestMapping.code).toBe(mapping)
    }
  })

  it('warns when identity is outside tolerance but within twice the tolerance', () => {
    const result = compareDimensions({ x: 0.40194, y: 0.625, z: 0.269 }, expected, 1)

    expect(result.status).toBe('warning')
    expect(result.bestMapping.code).toBe('XYZ')
  })

  it('fails when no permutation is within the warning policy', () => {
    const result = compareDimensions({ x: 1, y: 1, z: 1 }, expected, 1)

    expect(result.status).toBe('fail')
  })

  it('marks a mapping ambiguous when equal dimensions make permutations indistinguishable', () => {
    const result = compareDimensions(
      { x: 0.4, y: 0.6, z: 0.4 },
      { width: 0.4, height: 0.6, depth: 0.4 },
      1,
    )

    expect(result.ambiguous).toBe(true)
    expect(result.confidence).toBe(0)
  })

  it('rejects zero or negative expected dimensions and invalid tolerance', () => {
    expect(() => compareDimensions({ x: 1, y: 1, z: 1 }, { ...expected, width: 0 }, 1)).toThrow(
      'Expected dimensions must be greater than zero',
    )
    expect(() => compareDimensions({ x: 1, y: 1, z: 1 }, expected, 0)).toThrow(
      'Tolerance must be greater than zero',
    )
  })
})
