import type { ModelAnalysis } from '@shared/analysis'
import type { ValidationIssue } from '@shared/types'
import { StatusBadge } from '../components/StatusBadge'

function IssueCard({ issue }: { issue: ValidationIssue }) {
  return (
    <article className={`issue-card issue-card--${issue.severity}`}>
      <div className="issue-card__top"><code>{issue.id}</code><StatusBadge status={issue.severity} /></div>
      <h3>{issue.title}</h3>
      <p>{issue.description}</p>
      {(issue.actual !== undefined || issue.expected !== undefined) && (
        <dl>
          <div><dt>Actual</dt><dd>{JSON.stringify(issue.actual)}</dd></div>
          <div><dt>Expected</dt><dd>{JSON.stringify(issue.expected)}</dd></div>
        </dl>
      )}
      <footer><span>{issue.source.replaceAll('-', ' ')}</span><span>{issue.fixType ?? 'no fix'}</span></footer>
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
      <div className="panel-heading"><span>VALIDATION</span><small>RULE EVIDENCE</small></div>
      {analysis ? (
        <>
          <section className="validation-summary">
            <div><span>glTF errors</span><strong>{analysis.gltfValidation.errorCount}</strong></div>
            <div><span>Warnings</span><strong>{analysis.gltfValidation.warningCount}</strong></div>
            <div><span>Amazon issues</span><strong>{analysis.amazonIssues.length}</strong></div>
          </section>

          {canFix && (
            <section className="fix-center">
              <div className="fix-center__label">SAFE FIX</div>
              <h3>Missing default scene</h3>
              <p>只添加顶层 <code>"scene": 0</code>，候选文件会重新验证。</p>
              <button className="button button--primary button--full" onClick={onFix} disabled={repairing}>
                {repairing ? 'Verifying…' : 'Fix scene: 0'}
              </button>
            </section>
          )}

          {repairReady && (
            <section className="repair-proof">
              <strong>修复候选已通过核心检查</strong>
              <span>BIN / non-JSON SHA-256 unchanged</span>
              <span>Geometry statistics unchanged</span>
              <span>glTF Validator: 0 errors</span>
              <span>Bounding Box: {boundsIdentical ? 'unchanged' : 'verification failed'}</span>
            </section>
          )}

          <section className="issues-list">
            {issues.length > 0 ? issues.slice(0, 24).map((issue, index) => <IssueCard key={`${issue.id}-${index}`} issue={issue} />) : (
              <div className="all-clear"><span>✓</span><strong>No validation issues</strong></div>
            )}
          </section>
        </>
      ) : (
        <div className="panel-empty">分析后在此显示 glTF 与 Amazon 规则证据。</div>
      )}
    </aside>
  )
}
