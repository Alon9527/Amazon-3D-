import { describe, expect, it } from 'vitest'
import { normalizeValidatorReport, validateGltfBytes } from '@core/validator/gltfValidator'
import { createGlbFixture } from '../fixtures/generated/glbFixture'

describe('Khronos glTF Validator integration', () => {
  it('validates a minimal GLB 2.0 with zero errors', async () => {
    const source = createGlbFixture({
      asset: { version: '2.0', generator: 'Inspector test fixture' },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{}],
    })

    const summary = await validateGltfBytes(source, 'minimal.glb')

    expect(summary.errorCount).toBe(0)
    expect(summary.validatorVersion.length).toBeGreaterThan(0)
  })

  it('normalizes validator severities and locations into ValidationIssue', () => {
    const summary = normalizeValidatorReport(
      {
        uri: 'invalid.glb',
        validatorVersion: '2.0.0-test',
        issues: {
          numErrors: 1,
          numWarnings: 1,
          numInfos: 0,
          numHints: 0,
          messages: [
            { code: 'UNEXPECTED_PROPERTY', message: 'Unexpected property.', severity: 0, pointer: '/bad' },
            { code: 'UNUSED_OBJECT', message: 'Object is unused.', severity: 1, pointer: '/nodes/0' },
          ],
        },
      },
      '2.0.0-test',
    )

    expect(summary.errorCount).toBe(1)
    expect(summary.warningCount).toBe(1)
    expect(summary.issues).toEqual([
      expect.objectContaining({ id: 'GLTF-UNEXPECTED_PROPERTY', severity: 'error', actual: '/bad' }),
      expect.objectContaining({ id: 'GLTF-UNUSED_OBJECT', severity: 'warning', actual: '/nodes/0' }),
    ])
  })
})
