import type { ValidationSeverity } from '@shared/types'
import { severityLabels } from '../i18n/zhCN'

export function StatusBadge({ status, label }: { status: ValidationSeverity | 'idle'; label?: string }) {
  return <span className={`status-badge status-badge--${status}`}>{label ?? severityLabels[status]}</span>
}
