import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { analyzeInWorker, cleanupInWorker, repairInWorker } from './workers/analysisClient'

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
  const [exportWarning, setExportWarning] = useState(false)
  const [exporting, setExporting] = useState(false)
  const operationToken = useRef(0)

  const loadAsset = useCallback(
    async (payload: AssetPayload) => {
      const asset = normalizeAsset(payload)
      const token = ++operationToken.current
      setExportWarning(false)
      setTextureSummary(null)
      setSession(asset)
      try {
        const analysis = await analyzeInWorker(asset.bytes, asset.name)
        if (operationToken.current !== token || useInspectorStore.getState().asset !== asset) return
        setAnalysis(analysis)
      } catch (error) {
        if (operationToken.current !== token || useInspectorStore.getState().asset !== asset) return
        setError(error instanceof Error ? error.message : 'GLB 分析失败')
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
      setError(error instanceof Error ? error.message : '打开 GLB 失败')
    }
  }, [loadAsset, setError])

  const handleDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault()
      setDragActive(false)
      const files = [...event.dataTransfer.files]
      if (files.length !== 1 || !files[0]?.name.toLowerCase().endsWith('.glb')) {
        setError('请只拖入一个 .glb 文件；多文件 glTF 不在当前 MVP 支持范围内。')
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
        setError(error instanceof Error ? error.message : '无法读取拖入的 GLB')
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
    (message: string) => setError(`3D 预览失败：${message}`),
    [setError],
  )

  const handleView = useCallback((kind: ViewKind) => {
    setViewRequest((current) => ({ kind, token: current.token + 1 }))
  }, [])

  const handleFix = useCallback(async () => {
    if (!state.asset || !state.bounds) return
    const asset = state.asset
    const baseRepair = state.repair
    const token = ++operationToken.current
    state.setError(null)
    state.setPhase('repairing')
    state.setNotice(null)
    try {
      const repair = await repairInWorker(state.repair?.fixedBytes ?? asset.bytes, asset.name)
      const fixedBounds = await loadWorldBounds(repair.fixedBytes)
      if (operationToken.current !== token || useInspectorStore.getState().asset !== asset || useInspectorStore.getState().repair !== baseRepair) return
      const boundsIdentical = boundsEqual(state.bounds, fixedBounds)
      if (!repair.checks.coreChecksPassed || !boundsIdentical) {
        throw new Error('修复候选未通过修复前后的一致性检查')
      }
      state.setRepair({ ...repair, boundsIdentical })
      state.setNotice('修复候选已通过核心检查')
    } catch (error) {
      if (operationToken.current !== token || useInspectorStore.getState().asset !== asset || useInspectorStore.getState().repair !== baseRepair) return
      state.setError(error instanceof Error ? error.message : '安全修复失败')
    }
  }, [state])

  const handleCleanup = useCallback(async () => {
    if (!state.asset || !state.bounds) return
    const asset = state.asset
    const baseRepair = state.repair
    const token = ++operationToken.current
    state.setError(null)
    state.setPhase('repairing')
    state.setNotice(null)
    try {
      const repair = await cleanupInWorker(state.repair?.fixedBytes ?? asset.bytes, asset.name)
      const fixedBounds = await loadWorldBounds(repair.fixedBytes)
      if (operationToken.current !== token || useInspectorStore.getState().asset !== asset || useInspectorStore.getState().repair !== baseRepair) return
      const boundsIdentical = boundsEqual(state.bounds, fixedBounds)
      if (!repair.checks.coreChecksPassed || !boundsIdentical) throw new Error('清理候选未通过像素载荷、几何、材质或包围盒检查；保留当前模型')
      state.setRepair({ ...repair, boundsIdentical })
      state.setNotice('清理候选已通过复检')
    } catch (error) {
      if (operationToken.current !== token || useInspectorStore.getState().asset !== asset || useInspectorStore.getState().repair !== baseRepair) return
      state.setError(error instanceof Error ? error.message : '一键清理失败；保留当前模型')
    }
  }, [state])

  const handleExport = useCallback(async (confirmed = false) => {
    if (!state.asset || !state.repair?.checks.coreChecksPassed || !state.repair.boundsIdentical || state.phase === 'repairing') return
    if (exporting) return
    if (!confirmed && state.repair.after.gltfValidation.warningCount > 0) { setExportWarning(true); return }
    setExportWarning(false)
    setExporting(true)
    const asset = state.asset, repair = state.repair
    try {
      const result = await window.inspector.saveFixed({
        sourcePath: state.asset.path,
        suggestedName: state.repair.after.file.name,
        bytes: state.repair.fixedBytes,
      })
      if (result.status === 'saved' && useInspectorStore.getState().asset === asset && useInspectorStore.getState().repair === repair) state.setNotice('导出成功')
    } catch (error) {
      if (useInspectorStore.getState().asset === asset && useInspectorStore.getState().repair === repair) state.setError(error instanceof Error ? error.message : '导出失败')
    } finally {
      setExporting(false)
    }
  }, [exporting, state])

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

  const displayBytes = state.repair?.fixedBytes ?? state.asset?.bytes ?? null
  const activeAnalysis = state.repair?.after ?? state.analysis
  const gltfStatus = activeAnalysis
    ? severityForErrors(activeAnalysis.gltfValidation.errorCount, activeAnalysis.gltfValidation.warningCount)
    : 'idle'
  const viyrErrors = activeAnalysis?.amazonIssues.filter((issue) => issue.severity === 'error').length ?? 0
  const viyrWarnings = activeAnalysis?.amazonIssues.filter((issue) => issue.severity === 'warning').length ?? 0
  const viyrStatus = activeAnalysis ? severityForErrors(viyrErrors, viyrWarnings) : 'idle'
  const canFix = Boolean(
    state.bounds &&
      activeAnalysis?.amazonIssues.some((issue) => issue.id === 'AMZ-VIYR-SCENE-001' && issue.autoFixable),
  )
  const canExport = Boolean(state.repair?.checks.coreChecksPassed && state.repair.boundsIdentical)
  const busy = state.phase === 'loading' || state.phase === 'repairing' || exporting

  const statusText = useMemo(() => {
    if (state.phase === 'loading') return '正在分析本地资产'
    if (state.phase === 'repairing') return '正在生成并复检修复候选'
    if (state.error) return '需要处理'
    if (state.analysis) return '分析完成'
    return '可以打开本地 GLB'
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
        viyrStatus={viyrStatus}
        canExport={canExport}
        busy={busy}
        onOpen={handleOpen}
        onExport={() => { void handleExport() }}
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
          repairing={busy}
          canCleanup={Boolean(state.bounds && activeAnalysis?.cleanupPlan?.fixableCount && !activeAnalysis.gltfValidation.errorCount)}
          repair={state.repair}
          onFix={handleFix}
          onCleanup={handleCleanup}
          onRevert={() => { operationToken.current++; setExportWarning(false); state.clearRepair() }}
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
        <span>仅在本机处理</span>
      </footer>

      {(state.notice || state.error) && (
        <div className={`toast ${state.error ? 'toast--error' : ''}`} role="status">
          <strong>{state.error ? '操作已阻止' : state.notice}</strong>
          <span>{state.error ?? (state.notice === '导出成功' ? '保存的字节与已验证候选完全一致。' : '请查看分步记录；原文件未修改，候选可撤销或另存。')}</span>
          <button onClick={() => { state.setNotice(null); state.setError(null) }} aria-label="关闭消息">×</button>
        </div>
      )}

      {dragActive && <div className="drop-overlay"><strong>拖入 GLB 开始检查</strong><span>仅支持单文件 GLB 2.0</span></div>}
      {exportWarning && state.repair && (
        <div className="export-confirm-overlay">
          <section className="export-confirm" role="dialog" aria-modal="true" aria-label="保留警告导出">
            <h3>保留警告导出</h3>
            <p>候选仍有 {state.repair.after.gltfValidation.warningCount} 个 glTF 警告。这些提示不会被隐藏或标记为已修复，也不代表 Amazon 一定拒收。可另存后自行验收。</p>
            <button className="button" onClick={() => setExportWarning(false)}>取消导出</button>
            <button className="button button--primary" onClick={() => { void handleExport(true) }}>继续另存</button>
          </section>
        </div>
      )}
    </div>
  )
}
