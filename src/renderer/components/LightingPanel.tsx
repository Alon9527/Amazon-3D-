import { useState } from 'react'
import { useLightingStore } from '../store/lightingStore'
import { HDR_PRESETS, type HdrPresetId } from '../viewport/hdrPresets'
import { parseHdrTexture } from '../viewport/hdrTexture'

export function LightingPanel() {
  const [expanded, setExpanded] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const { source, custom, settings, status, setSetting, selectPreset, loadCustom, reset } = useLightingStore()
  const preset = HDR_PRESETS.find((item) => item.id === source.id)

  async function openCustomHdr() {
    setImporting(true)
    setImportError(null)
    try {
      const payload = await window.inspector.openHdr()
      if (payload) {
        // Decode before committing selection so malformed input preserves the active environment.
        const texture = parseHdrTexture(new Uint8Array(payload.bytes))
        texture.dispose()
        loadCustom(payload)
      }
    } catch (error) {
      setImportError(error instanceof Error ? error.message : '无法加载 HDR。')
    } finally {
      setImporting(false)
    }
  }

  return (
    <aside className={`lighting-panel ${expanded ? 'lighting-panel--expanded' : ''}`} aria-label="环境与照明">
      <button className="lighting-panel__toggle" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-controls="lighting-controls">
        <span>环境与照明</span><span className="lighting-panel__indicator">HDR {expanded ? '−' : '+'}</span>
      </button>
      {expanded && (
        <div id="lighting-controls" className="lighting-panel__body">
          <label className="lighting-field">HDR 环境
            <select aria-label="HDR 环境" value={source.id} onChange={(event) => { setImportError(null); selectPreset(event.target.value as HdrPresetId | 'custom') }}>
              {HDR_PRESETS.map((item, index) => <option key={item.id} value={item.id}>{String(index + 1).padStart(2, '0')} · {item.name}{index === 0 ? '（默认）' : ''}</option>)}
              {custom && <option value="custom">本地 · {custom.name}</option>}
            </select>
          </label>
          <p className="lighting-description">{preset?.description ?? '自定义本地 HDR · 仅用于当前预览'}</p>
          <button className="lighting-import" disabled={importing} onClick={() => void openCustomHdr()}>{importing ? '正在读取…' : '加载本地 HDR…'}</button>
          <span className="lighting-limit">Radiance .hdr · ≤32 MB · ≤8 百万像素</span>
          <div className="lighting-divider" />
          <label className="lighting-slider"><span>环境强度 <output data-testid="hdr-intensity">{settings.intensity.toFixed(2)}×</output></span>
            <input aria-label="环境强度" type="range" min="0" max="3" step="0.05" value={settings.intensity} onChange={(event) => setSetting('intensity', Number(event.target.value))} />
          </label>
          <label className="lighting-slider"><span>曝光 <output data-testid="hdr-exposure">{settings.exposureEV > 0 ? '+' : ''}{settings.exposureEV.toFixed(1)} EV</output></span>
            <input aria-label="曝光" type="range" min="-3" max="3" step="0.1" value={settings.exposureEV} onChange={(event) => setSetting('exposureEV', Number(event.target.value))} />
          </label>
          <label className="lighting-slider"><span>环境旋转 <output data-testid="hdr-rotation">{settings.rotation}°</output></span>
            <input aria-label="环境旋转" type="range" min="0" max="360" step="1" value={settings.rotation} onChange={(event) => setSetting('rotation', Number(event.target.value))} />
          </label>
          <label className="lighting-background"><input type="checkbox" checked={settings.showBackground} onChange={(event) => setSetting('showBackground', event.target.checked)} />显示 HDR 背景</label>
          <p className="lighting-status" data-testid="hdr-status" role="status">{status.phase === 'loading' ? '正在加载环境…' : `当前：${status.activeName}`}{status.phase === 'ready' && ` · ${status.width} × ${status.height}`}</p>
          {(importError || status.error) && <p className="lighting-error" role="alert">{importError ?? status.error} 已保留原环境，可重新选择。</p>}
          <button className="lighting-reset" onClick={() => { setImportError(null); reset() }}>恢复默认照明</button>
          <p className="lighting-note">默认为电商中性参考，非 Amazon 官方指定 HDR。调整只影响预览，不修改 GLB。</p>
          <span className="lighting-credit">内置 HDR：Poly Haven · CC0 · 本地离线</span>
        </div>
      )}
    </aside>
  )
}
