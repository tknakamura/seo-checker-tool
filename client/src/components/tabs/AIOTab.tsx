import type { SEOCheckResult } from '../../types';
import { getScoreClass } from '../../utils/helpers';

const AIO_CATEGORIES = [
  { key: 'contentComprehensiveness', name: 'コンテンツ包括性' },
  { key: 'structuredInformation', name: '構造化情報' },
  { key: 'credibilitySignals', name: '信頼性シグナル' },
  { key: 'aiSearchOptimization', name: 'AI検索最適化' },
  { key: 'naturalLanguageQuality', name: '自然言語品質' },
  { key: 'contextRelevance', name: 'コンテキスト関連性' },
];

interface AIOTabProps {
  results: SEOCheckResult;
}

export function AIOTab({ results }: AIOTabProps) {
  const aio = results.aio;
  if (!aio) return <p>AIOチェック結果がありません</p>;

  return (
    <>
      <div className="score-display" style={{ marginBottom: '2rem' }}>
        <div className="score-number">{aio.overallScore}</div>
        <div className="score-label">AIO総合スコア</div>
      </div>
      {AIO_CATEGORIES.map((cat) => {
        const check = aio.checks[cat.key];
        if (!check) return null;
        const scoreClass = getScoreClass(check.score);
        return (
          <div key={cat.key} className="category">
            <h3>{cat.name}</h3>
            <div className={`category-score score-${scoreClass}`}>スコア: {check.score}/100</div>
            {check.issues && check.issues.length > 0 && (
              <div className="issues-list">
                <h4>改善点 ({check.issues.length}件)</h4>
                <ul>
                  {check.issues.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}
            {check.recommendations && check.recommendations.length > 0 && (
              <div className="recommendations-list">
                <h4>推奨アクション ({check.recommendations.length}件)</h4>
                <ul>
                  {check.recommendations.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
