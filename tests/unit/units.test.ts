import { describe, expect, it } from 'vitest'
import { metresToUnit, unitToMetres } from '@core/units/convert'

describe('unit conversion', () => {
  it('converts metres to millimetres, centimetres, and decimal inches', () => {
    expect(metresToUnit(0.396, 'mm')).toBeCloseTo(396)
    expect(metresToUnit(0.625, 'cm')).toBeCloseTo(62.5)
    expect(metresToUnit(0.269, 'inch')).toBeCloseTo(10.590551, 6)
  })

  it('round-trips all supported units through metres', () => {
    expect(unitToMetres(396, 'mm')).toBeCloseTo(0.396)
    expect(unitToMetres(62.5, 'cm')).toBeCloseTo(0.625)
    expect(unitToMetres(14.69, 'inch')).toBeCloseTo(0.373126)
  })
})
