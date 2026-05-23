import { useState, useId } from 'react';
import type { SEOCheckResult, ConciseRecommendation, WarningEntry } from '../../types';
import { getScoreClass, getPriorityTitle } from '../../utils/helpers';

interface SummaryTabProps {
  results: SEOCheckResult;
}

function RecommendationItem({ rec }: { rec: ConciseRecommendation }) {
  const [open, setOpen] = useState(false);
  const hasDetails = Boolean(rec.codeExample || rec.docLink);
  const panelId = useId();

  const header = hasDetails ? (
    <button
      type="button"
      className="recommendation-header"
      data-toggle={panelId}
      aria-expanded={open}
      aria-controls={panelId}
      onClick={() => setOpen(!open)}
    >
      <span className="checkmark" aria-hidden="true">✓</span>
      <span className="recommendation-text">{rec.fix}</span>
      <span
        className={`priority-badge ${rec.priority}`}
        aria-label={`優先度: ${getPriorityTitle(rec.priority)}`}
      >
        {getPriorityTitle(rec.priority)}
      </span>
      <span className="toggle-icon" aria-hidden="true">{open ? '▲' : '▼'}</span>
    </button>
  ) : (
    <div className="recommendation-header">
      <span className="checkmark" aria-hidden="true">✓</span>
      <span className="recommendation-text">{rec.fix}</span>
      <span
        className={`priority-badge ${rec.priority}`}
        aria-label={`優先度: ${getPriorityTitle(rec.priority)}`}
      >
        {getPriorityTitle(rec.priority)}
      </span>
    </div>
  );

  return (
    <div className={`recommendation-item ${rec.priority}`}>
      {header}
      <div className="recommendation-details">
        <span className="element-info">{rec.element}</span>
        <span className="location-info">{rec.location}</span>
        {rec.count != null && rec.count > 1 && (
          <span className="count-info">{rec.count}件</span>
        )}
        {rec.type && (
          <span className={`type-badge type-${rec.type}`}>{rec.type.toUpperCase()}</span>
        )}
      </div>
      {open && hasDetails && (
        <div
          className="recommendation-extra"
          id={panelId}
          onClick={(e) => e.stopPropagation()}
        >
          {rec.issue && (
            <div className="rec-issue">
              <strong>検出された問題:</strong> {rec.issue}
            </div>
          )}
          {rec.codeExample && (
            <div className="rec-code">
              <h4>修正例</h4>
              <pre><code>{rec.codeExample}</code></pre>
            </div>
          )}
          {rec.docLink && (
            <div className="rec-doc">
              <a href={rec.docLink} target="_blank" rel="noopener noreferrer">
                参考ドキュメント →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WarningsBanner({ warnings }: { warnings: WarningEntry[] }) {
  if (!warnings || warnings.length === 0) return null;
  return (
    <div className="warnings-banner" role="region" aria-label="診断時の警告">
      {warnings.map((w, i) => (
        <div key={i} className="warning-item" role="alert" aria-live="polite">
          <strong aria-label="警告コード">⚠️ {w.code || 'WARNING'}</strong>
          <div>{w.message}</div>
          {w.detail && (
            <details>
              <summary>詳細</summary>
              <code>{w.detail}</code>
            </details>
          )}
        </div>
      ))}
    </div>
  );
}

// 安定キー生成: index ではなく rec の内容ハッシュ風にして、再診断時の state 干渉を防ぐ
function makeStableKey(rec: ConciseRecommendation, fallbackIndex: number): string {
  return [rec.category, rec.type, rec.priority, rec.element, rec.fix?.slice(0, 30)]
    .filter(Boolean)
    .join('|') || `rec-${fallbackIndex}`;
}

export function SummaryTab({ results }: SummaryTabProps) {
  const overallScore = results.overallScore ?? 0;
  const aioScore = results.aioOverallScore ?? 0;
  const combinedScore = results.combinedScore ?? 0;
  const recs = results.conciseRecommendations ?? [];
  // Phase 1.1: Advanced→Simple フォールバック等の警告
  const warnings = results.warnings ?? [];

  return (
    <div className="summary-section">
      <WarningsBanner warnings={warnings} />
      <h2>総合スコア</h2>
      <div className="score-grid">
        <div className="score-item">
          <div className="score-label">SEOスコア</div>
          <div className={`score-value score-${getScoreClass(overallScore)}`}>{Math.round(overallScore)}</div>
        </div>
        <div className="score-item">
          <div className="score-label">AIOスコア</div>
          <div className={`score-value score-${getScoreClass(aioScore)}`}>{Math.round(aioScore)}</div>
        </div>
        <div className="score-item">
          <div className="score-label">総合スコア</div>
          <div className={`score-value score-${getScoreClass(combinedScore)}`}>{Math.round(combinedScore)}</div>
        </div>
      </div>
      {recs.length > 0 && (
        <div className="summary-section">
          <h2>推奨アクション ({recs.length}件)</h2>
          <p className="hint">行をクリックすると修正例コードと参考リンクが展開されます</p>
          <div className="recommendations-list">
            {recs.map((rec, i) => (
              <RecommendationItem key={makeStableKey(rec, i)} rec={rec} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
