import type { ModelAnalysis, WarningCleanupItem } from '@shared/analysis'
import type { ValidationIssue } from '@shared/types'
import type { RepairSession } from '../store/inspectorStore'
import { StatusBadge } from '../components/StatusBadge'
import { fixTypeLabels, sourceLabels } from '../i18n/zhCN'

function IssueCard({ issue, cleanup }: { issue: ValidationIssue; cleanup?: WarningCleanupItem }) {
  return (
    <article className={`issue-card issue-card--${issue.severity}`}>
      <div className="issue-card__top"><code>{issue.id}</code><StatusBadge status={issue.severity} /></div>
      <h3>{issue.title}</h3>
      <p>{issue.description}</p>
      {cleanup && <p className="cleanup-reason">{cleanup.status === 'eligible' ? '可一键处理：' : '保留原因：'}{cleanup.message}</p>}
      {(issue.actual !== undefined || issue.expected !== undefined) && (
        <dl>
          <div><dt>实际值</dt><dd>{JSON.stringify(issue.actual)}</dd></div>
          <div><dt>期望值</dt><dd>{JSON.stringify(issue.expected)}</dd></div>
        </dl>
      )}
      <footer>
        <span>{sourceLabels[issue.source]}</span>
        <span>{cleanup?.status === 'eligible' ? '可一键处理' : issue.fixType ? fixTypeLabels[issue.fixType] : '不可自动修复'}</span>
      </footer>
    </article>
  )
}

export function ValidationPanel({
  analysis,
  canFix,
  repairing,
  canCleanup,
  repair,
  onFix,
  onCleanup,
  onRevert,
}: {
  analysis: ModelAnalysis | null
  canFix: boolean
  repairing: boolean
  canCleanup: boolean
  repair: RepairSession | null
  onFix(): void
  onCleanup(): void
  onRevert(): void
}) {
  const issues = analysis ? [...analysis.amazonIssues, ...analysis.gltfValidation.issues] : []
  const cleanupSteps = repair?.steps.filter((step) => step.kind === 'warning-cleanup') ?? []
  const cleanedImages = cleanupSteps.reduce((sum, step) => sum + step.changedImageCount, 0)
  const cleanupItems = cleanupSteps.flatMap((step) => step.items)
  return (
    <aside className="panel validation-panel">
      <div className="panel-heading"><span>验证结果</span><small>规则证据</small></div>
      {analysis ? (
        <>
          <section className="validation-summary">
            <div><span>glTF 错误</span><strong>{analysis.gltfValidation.errorCount}</strong></div>
            <div><span>警告</span><strong>{analysis.gltfValidation.warningCount}</strong></div>
            <div><span>Amazon 问题</span><strong>{analysis.amazonIssues.length}</strong></div>
          </section>

          {canFix && (
            <section className="fix-center">
              <div className="fix-center__label">安全修复</div>
              <h3>缺少默认场景</h3>
              <p>只添加顶层 <code>"scene": 0</code>，候选文件会重新验证。</p>
              <button className="button button--primary button--full" onClick={onFix} disabled={repairing}>
                {repairing ? '正在复检…' : '修复 scene: 0'}
              </button>
            </section>
          )}

          {Boolean(analysis.cleanupPlan?.items.length) && (
            <section className="fix-center">
              <div className="fix-center__label">可选优化 · 不影响原文件</div>
              <h3>警告与未使用数据清理</h3>
              <p>只处理可证明安全的 UV 引用和图片元数据，不压缩、不缩放贴图。无法安全处理的项目保留并说明原因；这些提示不等于 Amazon 拒收。</p>
              <button className="button button--primary button--full" onClick={onCleanup} disabled={!canCleanup || repairing}>
                {repairing ? '正在复检…' : `一键处理可修复项（${analysis.cleanupPlan?.fixableCount ?? 0}）`}
              </button>
            </section>
          )}

          {repair?.checks.coreChecksPassed && (
            <section className="repair-proof" data-testid="repair-proof">
              <strong>修复候选已通过核心检查</strong>
              {repair.steps.some((step) => step.kind === 'scene') && <span>scene: 0 已补齐；该步骤 BIN / 非 JSON chunk 的 SHA-256 未变化</span>}
              {cleanupSteps.length > 0 && <>
                <span>已处理 {cleanupItems.filter((item) => item.status === 'fixed').length} 项；跳过 {cleanupItems.filter((item) => item.status === 'skipped').length} 项</span>
                <span>警告：{repair.before.gltfValidation.warningCount} → {repair.after.gltfValidation.warningCount}</span>
                <span>信息：{repair.before.gltfValidation.infoCount} → {repair.after.gltfValidation.infoCount}</span>
                <span>{cleanedImages ? `BIN：仅图片区域变更（${cleanedImages} 张），几何字节一致` : 'BIN：全部字节未变化'}</span>
                <span>图片压缩像素载荷与材质定义未变化</span>
                <details className="cleanup-records"><summary>查看处理记录</summary>{cleanupItems.map((item, index) => (
                  <div key={`${item.pointer}-${index}`}><strong>{item.status === 'fixed' ? '已处理' : '跳过'} · {item.pointer}</strong><p>{item.message}</p></div>
                ))}</details>
              </>}
              <span>几何统计未变化</span>
              <span>glTF Validator：0 个错误</span>
              <span>包围盒：{repair.boundsIdentical ? '未变化' : '复检失败'}</span>
              <button className="button button--full" onClick={onRevert} disabled={repairing}>撤销修复候选</button>
            </section>
          )}

          <section className="issues-list">
            {issues.length > 0 ? issues.slice(0, 24).map((issue, index) => <IssueCard key={`${issue.id}-${index}`} issue={issue} cleanup={analysis.cleanupPlan?.items.find((item) => item.issueId === issue.id && item.pointer === issue.actual)} />) : (
              <div className="all-clear"><span>✓</span><strong>未发现验证问题</strong></div>
            )}
          </section>
        </>
      ) : (
        <div className="panel-empty">分析后在此显示 glTF 与 Amazon 规则证据。</div>
      )}
    </aside>
  )
}
