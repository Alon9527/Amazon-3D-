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
    ['grid', 'Grid'],
    ['ground', 'Ground'],
    ['axis', 'Axis'],
    ['bounds', 'Bounding Box'],
    ['dimensions', 'Dimensions'],
    ['wireframe', 'Wireframe'],
  ]
  return (
    <div className="viewport-toolbar">
      <div className="viewport-toolbar__group">
        <button onClick={() => onView('fit')}>Fit</button>
        <button onClick={() => onView('fit')}>Reset</button>
        <button onClick={() => onView('front')}>Front</button>
        <button onClick={() => onView('right')}>Right</button>
        <button onClick={() => onView('top')}>Top</button>
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
