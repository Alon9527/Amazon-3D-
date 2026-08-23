import type { Unit } from '@shared/analysis'

const METRES_PER_UNIT: Record<Unit, number> = {
  mm: 0.001,
  cm: 0.01,
  inch: 0.0254,
}

function assertFinite(value: number): void {
  if (!Number.isFinite(value)) throw new Error('Dimension value must be finite')
}

export function metresToUnit(value: number, unit: Unit): number {
  assertFinite(value)
  return value / METRES_PER_UNIT[unit]
}

export function unitToMetres(value: number, unit: Unit): number {
  assertFinite(value)
  return value * METRES_PER_UNIT[unit]
}
