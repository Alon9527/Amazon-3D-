import type { ValidationSeverity } from '@shared/types'

export function StatusBadge({ status, label }: { status: ValidationSeverity | 'idle'; label?: string }) {
  return <span className={`status-badge status-badge--${status}`}>{label ?? status.toUpperCase()}</span>
}
