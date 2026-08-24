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
  const dimensionLabels = { width: '宽度', height: '高度', depth: '深度' } as const

  return (
    <aside className="panel model-panel">
      <div className="panel-heading"><span>模型信息</span><small>本地资产</small></div>
      {analysis ? (
        <>
          <section className="panel-section file-summary">
            <h2>{analysis.file.name}</h2>
            <p>{analysis.stats.generator ?? '未声明生成工具'}</p>
            {countRow('GLB 版本', `${analysis.file.glbVersion}.0`)}
            {countRow('网格', analysis.stats.meshCount)}
            {countRow('图元', analysis.stats.primitiveCount)}
            {countRow('顶点', analysis.stats.vertexCount.toLocaleString())}
            {countRow('三角面', analysis.stats.triangleCount.toLocaleString())}
            {countRow('材质', analysis.stats.materialCount)}
            {countRow('贴图', analysis.stats.textureCount)}
          </section>

          <section className="panel-section dimension-form">
            <div className="section-title">
              <h3>预期商品尺寸</h3>
              <span>{unit === 'inch' ? '十进制英寸' : unit}</span>
            </div>
            {(['width', 'height', 'depth'] as const).map((key) => (
              <label key={key}>
                <span>{dimensionLabels[key]}</span>
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
              <span>容差</span>
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
                <h3>轴向映射</h3>
                {comparison && (
                  <StatusBadge status={comparison.status === 'fail' ? 'error' : comparison.status} />
                )}
              </div>
            {comparison ? (
              <>
                <div className="mapping-code">{comparison.bestMapping.code}</div>
                <p>
                  X / Y / Z 最佳匹配 · {comparison.ambiguous ? '映射不唯一' : `置信度 ${comparison.confidence.toFixed(1)}%`}
                </p>
                <div className="mapping-grid">
                  <span>宽度</span><strong>{comparison.bestMapping.widthAxis.toUpperCase()}</strong>
                  <span>高度</span><strong>{comparison.bestMapping.heightAxis.toUpperCase()}</strong>
                  <span>深度</span><strong>{comparison.bestMapping.depthAxis.toUpperCase()}</strong>
                </div>
                {comparison.possibleAxisSwap && <div className="diagnostic-callout">可能存在 X / Z 轴互换</div>}
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
