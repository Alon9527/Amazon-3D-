import type { DisplaySettings } from '../store/inspectorStore'
import type { ViewKind } from '../viewport/ModelViewport'

export function ViewportToolbar({
  display,
  onToggle,
  onView,
}: {
  display: DisplaySettings
  onToggle(key: keyof DisplaySettings): void
  onView(kind: ViewKind): void
}) {
  const controls: Array<[keyof DisplaySettings, string]> = [
    ['grid', '网格'],
    ['ground', '地面'],
    ['axis', '坐标轴'],
    ['bounds', '包围盒'],
    ['dimensions', '尺寸标注'],
    ['wireframe', '线框'],
  ]
  return (
    <div className="viewport-toolbar">
      <div className="viewport-toolbar__group">
        <button onClick={() => onView('fit')}>适应窗口</button>
        <button onClick={() => onView('fit')}>重置视图</button>
        <button onClick={() => onView('front')}>正视图</button>
        <button onClick={() => onView('right')}>右视图</button>
        <button onClick={() => onView('top')}>顶视图</button>
      </div>
      <div className="viewport-toolbar__group viewport-toolbar__group--display">
        {controls.map(([key, label]) => (
          <button key={key} className={display[key] ? 'is-active' : ''} onClick={() => onToggle(key)}>
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
