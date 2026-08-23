import { compareDimensions } from '@core/units/dimensionMapping'
import { unitToMetres } from '@core/units/convert'
import type { ModelAnalysis, ProductDimensions, Unit, WorldBounds } from '@shared/analysis'
import { StatusBadge } from '../components/StatusBadge'

interface ModelPanelProps {
  analysis: ModelAnalysis | null
  bounds: WorldBounds | null
  unit: Unit
  expectedInput: Record<keyof ProductDimensions, string>
  tolerancePercent: number
  onExpected(key: keyof ProductDimensions, value: string): void
  onTolerance(value: number): void
}

function countRow(label: string, value: string | number) {
  return <div className="data-row"><span>{label}</span><strong>{value}</strong></div>
}

export function ModelPanel(props: ModelPanelProps) {
  const { analysis, bounds, unit, expectedInput, tolerancePercent } = props
  const parsed = {
    width: Number(expectedInput.width),
    height: Number(expectedInput.height),
    depth: Number(expectedInput.depth),
  }
  const canCompare = bounds && Object.values(parsed).every((value) => Number.isFinite(value) && value > 0)
  const comparison = canCompare
    ? compareDimensions(
        bounds.size,
        {
          width: unitToMetres(parsed.width, unit),
          height: unitToMetres(parsed.height, unit),
          depth: unitToMetres(parsed.depth, unit),
        },
        tolerancePercent,
      )
    : null

  return (
    <aside className="panel model-panel">
      <div className="panel-heading"><span>MODEL</span><small>LOCAL ASSET</small></div>
      {analysis ? (
        <>
          <section className="panel-section file-summary">
            <h2>{analysis.file.name}</h2>
            <p>{analysis.stats.generator ?? 'Generator not declared'}</p>
            {countRow('GLB version', `${analysis.file.glbVersion}.0`)}
            {countRow('Meshes', analysis.stats.meshCount)}
            {countRow('Primitives', analysis.stats.primitiveCount)}
            {countRow('Vertices', analysis.stats.vertexCount.toLocaleString())}
            {countRow('Triangles', analysis.stats.triangleCount.toLocaleString())}
            {countRow('Materials', analysis.stats.materialCount)}
            {countRow('Textures', analysis.stats.textureCount)}
          </section>

          <section className="panel-section dimension-form">
            <div className="section-title">
              <h3>Expected product size</h3>
              <span>{unit === 'inch' ? 'decimal inch' : unit}</span>
            </div>
            {(['width', 'height', 'depth'] as const).map((key) => (
              <label key={key}>
                <span>{key.charAt(0).toUpperCase() + key.slice(1)}</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  value={expectedInput[key]}
                  placeholder="0.00"
                  onChange={(event) => props.onExpected(key, event.target.value)}
                />
                <small>{unit}</small>
              </label>
            ))}
            <div className="tolerance-row">
              <span>Tolerance</span>
              <select value={tolerancePercent} onChange={(event) => props.onTolerance(Number(event.target.value))}>
                <option value="0.1">±0.1%</option>
                <option value="0.5">±0.5%</option>
                <option value="1">±1%</option>
                <option value="2">±2%</option>
              </select>
            </div>
          </section>

          <section className="panel-section mapping-result">
              <div className="section-title">
                <h3>Axis mapping</h3>
                {comparison && (
                  <StatusBadge status={comparison.status === 'fail' ? 'error' : comparison.status} />
                )}
              </div>
            {comparison ? (
              <>
                <div className="mapping-code">{comparison.bestMapping.code}</div>
                <p>
                  X / Y / Z best match · {comparison.ambiguous ? 'Mapping is not unique' : `${comparison.confidence.toFixed(1)}% confidence`}
                </p>
                <div className="mapping-grid">
                  <span>Width</span><strong>{comparison.bestMapping.widthAxis.toUpperCase()}</strong>
                  <span>Height</span><strong>{comparison.bestMapping.heightAxis.toUpperCase()}</strong>
                  <span>Depth</span><strong>{comparison.bestMapping.depthAxis.toUpperCase()}</strong>
                </div>
                {comparison.possibleAxisSwap && <div className="diagnostic-callout">Possible X / Z Axis Swap</div>}
              </>
            ) : (
              <p className="empty-copy">输入真实尺寸后，将检查全部 6 种轴映射。</p>
            )}
          </section>
        </>
      ) : (
        <div className="panel-empty">打开 GLB 后显示模型结构与尺寸诊断。</div>
      )}
    </aside>
  )
}
