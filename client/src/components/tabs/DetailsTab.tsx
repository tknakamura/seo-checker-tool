import type { SEOCheckResult } from '../../types';
import { getScoreClass } from '../../utils/helpers';

const CATEGORIES = [
  { key: 'titleTag', name: 'タイトルタグ' },
  { key: 'metaDescription', name: 'メタディスクリプション' },
  { key: 'headingStructure', name: '見出し構造（H1〜H3）' },
  { key: 'imageAltAttributes', name: '画像のalt属性' },
  { key: 'internalLinkStructure', name: '内部リンク構造' },
  { key: 'structuredData', name: '構造化データ' },
  { key: 'otherSEOElements', name: 'その他SEO要素' },
];

interface DetailsTabProps {
  results: SEOCheckResult;
}

export function DetailsTab({ results }: DetailsTabProps) {
  const checks = results.checks ?? {};

  return (
    <>
      {CATEGORIES.map((cat) => {
        const check = checks[cat.key];
        if (!check) return null;
        const scoreClass = getScoreClass(check.score);
        return (
          <div key={cat.key} className="category">
            <h3>{cat.name}</h3>
            <div className={`category-score score-${scoreClass}`}>スコア: {check.score}/100</div>
            {check.current != null && (
              <p>
                <strong>現在の値:</strong> {check.current}
              </p>
            )}
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
