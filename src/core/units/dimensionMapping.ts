import type {
  AxisDimensions,
  AxisMappingCode,
  AxisMappingResult,
  DimensionComparison,
  ProductDimensions,
} from '@shared/analysis'

const MAPPINGS: ReadonlyArray<{
  code: AxisMappingCode
  axes: [keyof AxisDimensions, keyof AxisDimensions, keyof AxisDimensions]
}> = [
  { code: 'XYZ', axes: ['x', 'y', 'z'] },
  { code: 'XZY', axes: ['x', 'z', 'y'] },
  { code: 'YXZ', axes: ['y', 'x', 'z'] },
  { code: 'YZX', axes: ['y', 'z', 'x'] },
  { code: 'ZXY', axes: ['z', 'x', 'y'] },
  { code: 'ZYX', axes: ['z', 'y', 'x'] },
]

function assertInputs(expected: ProductDimensions, tolerancePercent: number): void {
  if (
    !Number.isFinite(expected.width) ||
    !Number.isFinite(expected.height) ||
    !Number.isFinite(expected.depth) ||
    expected.width <= 0 ||
    expected.height <= 0 ||
    expected.depth <= 0
  ) {
    throw new Error('Expected dimensions must be greater than zero')
  }
  if (!Number.isFinite(tolerancePercent) || tolerancePercent <= 0) {
    throw new Error('Tolerance must be greater than zero')
  }
}

function relativeError(actual: number, expected: number): number {
  return Math.abs(actual - expected) / expected
}

function evaluateMapping(
  actual: AxisDimensions,
  expected: ProductDimensions,
  code: AxisMappingCode,
  axes: [keyof AxisDimensions, keyof AxisDimensions, keyof AxisDimensions],
): AxisMappingResult {
  const relativeErrors = {
    width: relativeError(actual[axes[0]], expected.width),
    height: relativeError(actual[axes[1]], expected.height),
    depth: relativeError(actual[axes[2]], expected.depth),
  }
  const values = [relativeErrors.width, relativeErrors.height, relativeErrors.depth]
  return {
    code,
    widthAxis: axes[0],
    heightAxis: axes[1],
    depthAxis: axes[2],
    relativeErrors,
    meanError: values.reduce((sum, value) => sum + value, 0) / values.length,
    maxError: Math.max(...values),
  }
}

export function compareDimensions(
  actual: AxisDimensions,
  expected: ProductDimensions,
  tolerancePercent: number,
): DimensionComparison {
  assertInputs(expected, tolerancePercent)
  const tolerance = tolerancePercent / 100
  const mappings = MAPPINGS.map(({ code, axes }) => evaluateMapping(actual, expected, code, axes)).sort(
    (left, right) => left.meanError - right.meanError || left.maxError - right.maxError,
  )
  const bestMapping = mappings[0]
  const identityMapping = mappings.find((mapping) => mapping.code === 'XYZ')
  if (!bestMapping || !identityMapping) throw new Error('Dimension mappings are unavailable')

  let status: DimensionComparison['status'] = 'fail'
  if (identityMapping.maxError <= tolerance) {
    status = 'pass'
  } else if (bestMapping.maxError <= tolerance || identityMapping.maxError <= tolerance * 2) {
    status = 'warning'
  }

  const secondMapping = mappings[1]
  const separation = secondMapping ? secondMapping.meanError - bestMapping.meanError : 0
  const ambiguityThreshold = Math.max(tolerance / 10, 1e-9)
  const ambiguous = separation <= ambiguityThreshold
  const fitQuality = Math.max(0, 1 - bestMapping.meanError)
  const uniqueness = ambiguous ? 0 : Math.min(1, separation / tolerance)
  const confidence = Math.round(fitQuality * uniqueness * 1000) / 10

  return {
    status,
    tolerancePercent,
    mappings,
    bestMapping,
    identityMapping,
    confidence,
    ambiguous,
    possibleAxisSwap: bestMapping.code === 'ZYX' && !ambiguous,
  }
}
