import type { SEOCheckResult } from '../../types';
import { getScoreClass, getPriorityTitle } from '../../utils/helpers';

interface SummaryTabProps {
  results: SEOCheckResult;
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
          <div className="recommendations-list">
            {recs.map((rec, i) => (
              <div key={i} className={`recommendation-item ${rec.priority}`}>
                <div className="recommendation-header">
                  <span className="checkmark">✓</span>
                  <span className="recommendation-text">{rec.fix}</span>
                  <span className={`priority-badge ${rec.priority}`}>{getPriorityTitle(rec.priority)}</span>
                </div>
                <div className="recommendation-details">
                  <span className="element-info">{rec.element}</span>
                  <span className="location-info">{rec.location}</span>
                  {rec.count != null && rec.count > 1 && (
                    <span className="count-info">{rec.count}件</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
