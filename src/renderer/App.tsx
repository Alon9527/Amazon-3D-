import { useCallback, useEffect, useMemo, useState } from 'react'
import { metresToUnit, unitToMetres } from '@core/units/convert'
import type { TextureLoadSummary } from '@core/geometry/modelTextures'
import type { Unit, WorldBounds } from '@shared/analysis'
import type { AssetPayload } from '@shared/bridge'
import type { ValidationSeverity } from '@shared/types'
import { TopBar } from './components/TopBar'
import { ViewportToolbar } from './components/ViewportToolbar'
import { ModelPanel } from './panels/ModelPanel'
import { ValidationPanel } from './panels/ValidationPanel'
import { useInspectorStore } from './store/inspectorStore'
import { ModelViewport, type ViewKind } from './viewport/ModelViewport'
import { boundsEqual, loadWorldBounds } from './viewport/modelLoader'
import { analyzeInWorker, repairInWorker } from './workers/analysisClient'

function severityForErrors(errors: number, warnings: number): ValidationSeverity {
  if (errors > 0) return 'error'
  if (warnings > 0) return 'warning'
  return 'pass'
}

function normalizeAsset(payload: AssetPayload): AssetPayload {
  return { ...payload, bytes: new Uint8Array(payload.bytes) }
}

function formatConvertedInput(value: number): string {
  return value.toFixed(4).replace(/\.?0+$/, '')
}

export function App() {
  const state = useInspectorStore()
  const {
    setSession,
    setAnalysis,
    setBounds,
    setError,
  } = state
  const [viewRequest, setViewRequest] = useState({ kind: 'fit' as ViewKind, token: 0 })
  const [dragActive, setDragActive] = useState(false)
  const [textureSummary, setTextureSummary] = useState<TextureLoadSummary | null>(null)

  const loadAsset = useCallback(
    async (payload: AssetPayload) => {
      const asset = normalizeAsset(payload)
      setTextureSummary(null)
      setSession(asset)
      try {
        const analysis = await analyzeInWorker(asset.bytes, asset.name)
        setAnalysis(analysis)
      } catch (error) {
        setError(error instanceof Error ? error.message : 'GLB analysis failed')
      }
    },
    [setAnalysis, setError, setSession],
  )

  useEffect(() => {
    void window.inspector.getLaunchAsset().then((asset) => {
      if (asset) void loadAsset(asset)
    })
  }, [loadAsset])

  const handleOpen = useCallback(async () => {
    try {
      const asset = await window.inspector.openGlb()
      if (asset) await loadAsset(asset)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Open GLB failed')
    }
  }, [loadAsset, setError])

  const handleDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault()
      setDragActive(false)
      const files = [...event.dataTransfer.files]
      if (files.length !== 1 || !files[0]?.name.toLowerCase().endsWith('.glb')) {
        setError('Drop exactly one .glb file. Multi-file glTF is outside this MVP.')
        return
      }
      const file = files[0]
      try {
        await loadAsset({
          name: file.name,
          path: window.inspector.getPathForFile(file),
          bytes: new Uint8Array(await file.arrayBuffer()),
        })
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Dropped GLB could not be read')
      }
    },
    [loadAsset, setError],
  )

  const handleBounds = useCallback(
    (nextBounds: WorldBounds) => {
      setBounds(nextBounds)
    },
    [setBounds],
  )

  const handleViewerError = useCallback(
    (message: string) => setError(`3D preview failed: ${message}`),
    [setError],
  )

  const handleView = useCallback((kind: ViewKind) => {
    setViewRequest((current) => ({ kind, token: current.token + 1 }))
  }, [])

  const handleFix = useCallback(async () => {
    if (!state.asset || !state.bounds) return
    state.setPhase('repairing')
    state.setNotice(null)
    try {
      const repair = await repairInWorker(state.asset.bytes, state.asset.name)
      const fixedBounds = await loadWorldBounds(repair.fixedBytes)
      const boundsIdentical = boundsEqual(state.bounds, fixedBounds)
      if (!repair.checks.coreChecksPassed || !boundsIdentical) {
        throw new Error('Repair candidate failed before/after consistency checks')
      }
      state.setRepair({ ...repair, boundsIdentical })
      state.setNotice('修复候选已通过核心检查')
    } catch (error) {
      state.setError(error instanceof Error ? error.message : 'Safe Fix failed')
    }
  }, [state])

  const handleExport = useCallback(async () => {
    if (!state.asset || !state.repair || !state.repair.boundsIdentical) return
    try {
      const result = await window.inspector.saveFixed({
        sourcePath: state.asset.path,
        suggestedName: state.repair.after.file.name,
        bytes: state.repair.fixedBytes,
      })
      if (result.status === 'saved') state.setNotice('Export Successful')
    } catch (error) {
      state.setError(error instanceof Error ? error.message : 'Export failed')
    }
  }, [state])

  const handleUnit = useCallback(
    (nextUnit: Unit) => {
      if (nextUnit === state.unit) return
      ;(['width', 'height', 'depth'] as const).forEach((key) => {
        const value = Number(state.expectedInput[key])
        if (Number.isFinite(value) && value > 0) {
          state.setExpectedInput(key, formatConvertedInput(metresToUnit(unitToMetres(value, state.unit), nextUnit)))
        }
      })
      state.setUnit(nextUnit)
    },
    [state],
  )

  const gltfStatus = state.analysis
    ? severityForErrors(state.analysis.gltfValidation.errorCount, state.analysis.gltfValidation.warningCount)
    : 'idle'
  const viyrErrors = state.analysis?.amazonIssues.filter((issue) => issue.severity === 'error').length ?? 0
  const viyrWarnings = state.analysis?.amazonIssues.filter((issue) => issue.severity === 'warning').length ?? 0
  const viyrStatus = state.analysis ? severityForErrors(viyrErrors, viyrWarnings) : 'idle'
  const canFix = Boolean(
    state.bounds &&
      !state.repair &&
      state.analysis?.amazonIssues.some((issue) => issue.id === 'AMZ-VIYR-SCENE-001' && issue.autoFixable),
  )
  const canExport = Boolean(state.repair?.checks.coreChecksPassed && state.repair.boundsIdentical)
  const displayBytes = state.repair?.fixedBytes ?? state.asset?.bytes ?? null
  const activeAnalysis = state.repair?.after ?? state.analysis
  const busy = state.phase === 'loading' || state.phase === 'repairing'

  const statusText = useMemo(() => {
    if (state.phase === 'loading') return 'ANALYZING LOCAL ASSET'
    if (state.phase === 'repairing') return 'BUILDING AND REVALIDATING CANDIDATE'
    if (state.error) return 'ACTION REQUIRED'
    if (state.analysis) return 'ANALYSIS COMPLETE'
    return 'READY FOR LOCAL GLB'
  }, [state.analysis, state.error, state.phase])

  return (
    <div
      className={`app-shell ${dragActive ? 'is-dragging' : ''}`}
      onDragEnter={(event) => { event.preventDefault(); setDragActive(true) }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setDragActive(false)
      }}
      onDrop={handleDrop}
    >
      <TopBar
        unit={state.unit}
        gltfStatus={gltfStatus}
        amazon3dStatus={gltfStatus}
        viyrStatus={state.repair ? 'pass' : viyrStatus}
        canExport={canExport}
        busy={busy}
        onOpen={handleOpen}
        onExport={handleExport}
        onUnit={handleUnit}
      />

      <main className="workspace-grid">
        <ModelPanel
          analysis={activeAnalysis}
          bounds={state.bounds}
          unit={state.unit}
          expectedInput={state.expectedInput}
          tolerancePercent={state.tolerancePercent}
          onExpected={state.setExpectedInput}
          onTolerance={state.setTolerance}
        />

        <div className="viewport-column">
          <ModelViewport
            bytes={displayBytes}
            analysis={activeAnalysis}
            bounds={state.bounds}
            unit={state.unit}
            display={state.display}
            textureSummary={textureSummary}
            viewRequest={viewRequest}
            onBounds={handleBounds}
            onTextures={setTextureSummary}
            onLoadError={handleViewerError}
            onView={handleView}
          />
          <ViewportToolbar display={state.display} onToggle={state.toggleDisplay} onView={handleView} />
        </div>

        <ValidationPanel
          analysis={activeAnalysis}
          canFix={canFix}
          repairing={state.phase === 'repairing'}
          repairReady={canExport}
          boundsIdentical={state.repair?.boundsIdentical ?? null}
          onFix={handleFix}
        />
      </main>

      <footer className="statusbar">
        <span className={`status-dot ${state.error ? 'status-dot--error' : busy ? 'status-dot--busy' : ''}`} />
        <strong>{statusText}</strong>
        {state.bounds && (
          <div className="statusbar-dimensions">
            <span>X {metresToUnit(state.bounds.size.x, state.unit).toFixed(2)}</span>
            <span>Y {metresToUnit(state.bounds.size.y, state.unit).toFixed(2)}</span>
            <span>Z {metresToUnit(state.bounds.size.z, state.unit).toFixed(2)}</span>
            <small>{state.unit}</small>
          </div>
        )}
        <span className="statusbar-spacer" />
        <span>LOCAL PROCESSING</span>
      </footer>

      {(state.notice || state.error) && (
        <div className={`toast ${state.error ? 'toast--error' : ''}`} role="status">
          <strong>{state.error ? 'Operation blocked' : state.notice}</strong>
          <span>{state.error ?? (state.notice === 'Export Successful' ? 'Saved bytes match the validated candidate.' : 'Geometry, BIN and validation gates passed.')}</span>
          <button onClick={() => { state.setNotice(null); state.setError(null) }} aria-label="Dismiss message">×</button>
        </div>
      )}

      {dragActive && <div className="drop-overlay"><strong>DROP GLB TO INSPECT</strong><span>Single-file GLB 2.0 only</span></div>}
    </div>
  )
}
