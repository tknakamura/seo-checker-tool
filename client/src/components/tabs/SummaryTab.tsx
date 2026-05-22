import { useState } from 'react';
import type { SEOCheckResult, ConciseRecommendation } from '../../types';
import { getScoreClass, getPriorityTitle } from '../../utils/helpers';

interface SummaryTabProps {
  results: SEOCheckResult;
}

function RecommendationItem({ rec, index }: { rec: ConciseRecommendation; index: number }) {
  const [open, setOpen] = useState(false);
  const hasDetails = Boolean(rec.codeExample || rec.docLink);

  return (
    <div className={`recommendation-item ${rec.priority}`}>
      <div
        className="recommendation-header"
        onClick={() => hasDetails && setOpen(!open)}
        onKeyDown={(e) => e.key === 'Enter' && hasDetails && setOpen(!open)}
        role={hasDetails ? 'button' : undefined}
        tabIndex={hasDetails ? 0 : undefined}
        style={{ cursor: hasDetails ? 'pointer' : 'default' }}
      >
        <span className="checkmark">✓</span>
        <span className="recommendation-text">{rec.fix}</span>
        <span className={`priority-badge ${rec.priority}`}>{getPriorityTitle(rec.priority)}</span>
        {hasDetails && <span className="toggle-icon">{open ? '▲' : '▼'}</span>}
      </div>
      <div className="recommendation-details">
        <span className="element-info">{rec.element}</span>
        <span className="location-info">{rec.location}</span>
        {rec.count != null && rec.count > 1 && (
          <span className="count-info">{rec.count}件</span>
        )}
        {rec.type && <span className={`type-badge type-${rec.type}`}>{rec.type.toUpperCase()}</span>}
      </div>
      {open && hasDetails && (
        <div className="recommendation-extra" data-index={index}>
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
                📖 参考ドキュメント →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SummaryTab({ results }: SummaryTabProps) {
  const overallScore = results.overallScore ?? 0;
  const aioScore = results.aioOverallScore ?? 0;
  const combinedScore = results.combinedScore ?? 0;
  const recs = results.conciseRecommendations ?? [];

  return (
    <div className="summary-section">
      <h2>📊 総合スコア</h2>
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
          <h2>🎯 推奨アクション ({recs.length}件)</h2>
          <p className="hint">💡 行をクリックすると修正例コードと参考リンクが展開されます</p>
          <div className="recommendations-list">
            {recs.map((rec, i) => (
              <RecommendationItem key={i} rec={rec} index={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
