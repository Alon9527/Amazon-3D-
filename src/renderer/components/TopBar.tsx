import type { Unit } from '@shared/analysis'
import type { ValidationSeverity } from '@shared/types'
import { StatusBadge } from './StatusBadge'

interface TopBarProps {
  unit: Unit
  gltfStatus: ValidationSeverity | 'idle'
  amazon3dStatus: ValidationSeverity | 'idle'
  viyrStatus: ValidationSeverity | 'idle'
  canExport: boolean
  busy: boolean
  onOpen(): void
  onExport(): void
  onUnit(unit: Unit): void
}

export function TopBar(props: TopBarProps) {
  const { unit, gltfStatus, amazon3dStatus, viyrStatus, canExport, busy } = props
  return (
    <header className="topbar">
      <div className="brand-lockup">
        <span className="brand-mark">A3</span>
        <div>
          <h1 data-testid="app-title">Amazon 3D Asset Inspector</h1>
          <p>GLB Validator · Dimension Inspector · VIYR Fixer</p>
        </div>
      </div>

      <div className="compatibility-rail" aria-label="Compatibility summary">
        <div><span>glTF 2.0</span><StatusBadge status={gltfStatus} /></div>
        <div><span>Amazon 3D</span><StatusBadge status={amazon3dStatus} /></div>
        <div><span>Amazon VIYR</span><StatusBadge status={viyrStatus} /></div>
      </div>

      <div className="topbar-actions">
        <div className="unit-switch" aria-label="Display unit">
          {(['mm', 'cm', 'inch'] as const).map((candidate) => (
            <button
              key={candidate}
              className={unit === candidate ? 'is-active' : ''}
              onClick={() => props.onUnit(candidate)}
            >
              {candidate}
            </button>
          ))}
        </div>
        <button className="button button--secondary" onClick={props.onOpen} disabled={busy}>Open GLB</button>
        <button className="button button--primary" onClick={props.onExport} disabled={!canExport || busy}>
          Export Fixed
        </button>
      </div>
    </header>
  )
}
