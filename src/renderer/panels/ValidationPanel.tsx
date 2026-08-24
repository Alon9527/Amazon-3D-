import type { ModelAnalysis } from '@shared/analysis'
import type { ValidationIssue } from '@shared/types'
import { StatusBadge } from '../components/StatusBadge'
import { fixTypeLabels, sourceLabels } from '../i18n/zhCN'

function IssueCard({ issue }: { issue: ValidationIssue }) {
  return (
    <article className={`issue-card issue-card--${issue.severity}`}>
      <div className="issue-card__top"><code>{issue.id}</code><StatusBadge status={issue.severity} /></div>
      <h3>{issue.title}</h3>
      <p>{issue.description}</p>
      {(issue.actual !== undefined || issue.expected !== undefined) && (
        <dl>
          <div><dt>实际值</dt><dd>{JSON.stringify(issue.actual)}</dd></div>
          <div><dt>期望值</dt><dd>{JSON.stringify(issue.expected)}</dd></div>
        </dl>
      )}
      <footer>
        <span>{sourceLabels[issue.source]}</span>
        <span>{issue.fixType ? fixTypeLabels[issue.fixType] : '不可自动修复'}</span>
      </footer>
    </article>
  )
}

export function ValidationPanel({
  analysis,
  canFix,
  repairing,
  repairReady,
  boundsIdentical,
  onFix,
}: {
  analysis: ModelAnalysis | null
  canFix: boolean
  repairing: boolean
  repairReady: boolean
  boundsIdentical: boolean | null
  onFix(): void
}) {
  const issues = analysis ? [...analysis.amazonIssues, ...analysis.gltfValidation.issues] : []
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

          {repairReady && (
            <section className="repair-proof">
              <strong>修复候选已通过核心检查</strong>
              <span>BIN / 非 JSON chunk 的 SHA-256 未变化</span>
              <span>几何统计未变化</span>
              <span>glTF Validator：0 个错误</span>
              <span>包围盒：{boundsIdentical ? '未变化' : '复检失败'}</span>
            </section>
          )}

          <section className="issues-list">
            {issues.length > 0 ? issues.slice(0, 24).map((issue, index) => <IssueCard key={`${issue.id}-${index}`} issue={issue} />) : (
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
