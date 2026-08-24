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
          <h1 data-testid="app-title">Amazon 3D 资产检查器</h1>
          <p>GLB 标准验证 · 尺寸检查 · VIYR 安全修复</p>
        </div>
      </div>

      <div className="compatibility-rail" aria-label="兼容性摘要">
        <div><span>glTF 2.0</span><StatusBadge status={gltfStatus} /></div>
        <div><span>Amazon 3D</span><StatusBadge status={amazon3dStatus} /></div>
        <div><span>Amazon VIYR</span><StatusBadge status={viyrStatus} /></div>
      </div>

      <div className="topbar-actions">
        <div className="unit-switch" aria-label="显示单位">
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
        <button className="button button--secondary" onClick={props.onOpen} disabled={busy}>打开 GLB</button>
        <button className="button button--primary" onClick={props.onExport} disabled={!canExport || busy}>
          导出修复文件
        </button>
      </div>
    </header>
  )
}
