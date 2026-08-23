import type { GltfValidationSummary } from '@shared/analysis'
import type { ValidationIssue, ValidationSeverity } from '@shared/types'
import { validateBytes, version } from 'gltf-validator'

type JsonObject = Record<string, unknown>

function object(value: unknown): JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : {}
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
}

function severity(value: unknown): ValidationSeverity {
  if (value === 0) return 'error'
  if (value === 1) return 'warning'
  return 'info'
}

function titleFromCode(code: string): string {
  return code
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function normalizeValidatorReport(
  report: unknown,
  validatorVersion: string,
): GltfValidationSummary {
  const issueReport = object(object(report).issues)
  const messages = Array.isArray(issueReport.messages) ? issueReport.messages : []
  const issues: ValidationIssue[] = messages.map((rawMessage) => {
    const message = object(rawMessage)
    const code = typeof message.code === 'string' ? message.code : 'UNKNOWN'
    const pointer = typeof message.pointer === 'string' ? message.pointer : undefined
    return {
      id: `GLTF-${code}`,
      category: 'gltf',
      severity: severity(message.severity),
      title: titleFromCode(code),
      description:
        typeof message.message === 'string' ? message.message : 'The glTF Validator reported an issue.',
      ...(pointer ? { actual: pointer } : {}),
      source: 'gltf-standard',
      autoFixable: false,
      fixType: 'manual',
    }
  })

  return {
    validatorVersion,
    errorCount: count(issueReport.numErrors),
    warningCount: count(issueReport.numWarnings),
    infoCount: count(issueReport.numInfos),
    hintCount: count(issueReport.numHints),
    issues,
  }
}

export async function validateGltfBytes(
  source: Uint8Array,
  fileName: string,
): Promise<GltfValidationSummary> {
  const validatorVersion = version()
  const report = await validateBytes(source, {
    uri: fileName,
    maxIssues: 10_000,
  })
  return normalizeValidatorReport(report, validatorVersion)
}
