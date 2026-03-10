import { useState } from 'react';
import type { SEOCheckResult, StructuredDataCheck, SchemaRecommendationItem } from '../../types';
import {
  getPageTypeDisplayName,
  getAnalysisReason,
  getPriorityTitle,
  getEstimatedTime,
  getImplementationBenefits,
} from '../../utils/helpers';

interface StructuredDataTabProps {
  results: SEOCheckResult;
}

function SchemaItem({
  item,
  schemaId,
  structuredDataCheck,
}: {
  item: SchemaRecommendationItem;
  schemaId: string;
  structuredDataCheck: StructuredDataCheck;
}) {
  const [open, setOpen] = useState(false);
  let implementationCode = '';
  const templates = structuredDataCheck.implementationExamples?.templates;
  if (templates && templates[item.schema]?.schema) {
    implementationCode = JSON.stringify(templates[item.schema].schema, null, 2);
  }
  const benefits = getImplementationBenefits(item.schema);
  const time = getEstimatedTime(item.schema);

  const handleCopy = () => {
    const text = `<script type="application/ld+json">\n${implementationCode}\n</script>`;
    navigator.clipboard.writeText(text).catch(() => {});
  };

  return (
    <div className="schema-item">
      <div
        className="schema-header"
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => e.key === 'Enter' && setOpen(!open)}
        role="button"
        tabIndex={0}
      >
        <div className="schema-type">{item.schema}</div>
        <div className={`schema-priority ${item.priority}`}>{getPriorityTitle(item.priority)}</div>
        {item.seoValue && <div className="schema-seo-value">SEO値: {item.seoValue}</div>}
        {time && <div className="schema-time">{time}</div>}
      </div>
      <div className={`schema-content${open ? ' active' : ''}`} id={schemaId}>
        <div className="schema-description">{item.reason}</div>
        {implementationCode && (
          <>
            <div className="implementation-code" id={`code_${schemaId}`}>
              {`<script type="application/ld+json">\n${implementationCode}\n</script>`}
            </div>
            <button type="button" className="copy-button" onClick={handleCopy}>
              📋 コードをコピー
            </button>
          </>
        )}
        <div className="validation-tools">
          <h4>🔍 検証ツール</h4>
          <div className="validation-tool">
            <span>🔗</span>
            <a href="https://search.google.com/test/rich-results" target="_blank" rel="noopener noreferrer">
              Google構造化データテストツール
            </a>
            <span>- Googleでの認識確認</span>
          </div>
          <div className="validation-tool">
            <span>✅</span>
            <a href="https://validator.schema.org/" target="_blank" rel="noopener noreferrer">
              Schema.org Validator
            </a>
            <span>- スキーマ仕様の準拠確認</span>
          </div>
        </div>
        {benefits && benefits.length > 0 && (
          <div className="benefits-list">
            <h5>💰 実装メリット:</h5>
            <ul>
              {benefits.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export function StructuredDataTab({ results }: StructuredDataTabProps) {
  const structuredDataCheck = results.checks?.structuredData as StructuredDataCheck | undefined;
  if (!structuredDataCheck) return <p>構造化データのチェック結果がありません</p>;

  const analysis = structuredDataCheck.pageTypeAnalysis;
  const recs = structuredDataCheck.structuredDataRecommendations?.recommendations;
  const benefits = structuredDataCheck.structuredDataRecommendations?.expectedBenefits;

  return (
    <div className="structured-data-analysis">
      {analysis && (
        <div className="page-type-analysis">
          <div className="page-type-title">📄 ページタイプ分析結果</div>
          <div className="page-type-confidence">
            判定: {getPageTypeDisplayName(analysis.primaryType)} (信頼度: {Math.round(analysis.confidence * 100)}%)
          </div>
          <div className="page-type-details">
            <div className="page-type-detail">
              <h4>主要タイプ</h4>
              <p>{analysis.primaryType}</p>
            </div>
            {analysis.secondaryTypes && analysis.secondaryTypes.length > 0 && (
              <div className="page-type-detail">
                <h4>候補タイプ</h4>
                <p>{analysis.secondaryTypes.join(', ')}</p>
              </div>
            )}
            <div className="page-type-detail">
              <h4>分析根拠</h4>
              <p>{getAnalysisReason(analysis)}</p>
            </div>
          </div>
        </div>
      )}
      {recs && (
        <div className="schema-recommendations">
          {recs.missing.length > 0 && (
            <div className="schema-section">
              <h3>🚨 必須スキーマ ({recs.missing.length}件)</h3>
              <div className="schema-items">
                {recs.missing.map((item, i) => (
                  <SchemaItem
                    key={i}
                    item={item}
                    schemaId={`missing_${i}`}
                    structuredDataCheck={structuredDataCheck}
                  />
                ))}
              </div>
            </div>
          )}
          {recs.improvements.length > 0 && (
            <div className="schema-section">
              <h3>⭐ 推奨スキーマ ({recs.improvements.length}件)</h3>
              <div className="schema-items">
                {recs.improvements.map((item, i) => (
                  <SchemaItem
                    key={i}
                    item={item}
                    schemaId={`improvement_${i}`}
                    structuredDataCheck={structuredDataCheck}
                  />
                ))}
              </div>
            </div>
          )}
          {recs.optional.length > 0 && (
            <div className="schema-section">
              <h3>💡 オプションスキーマ ({recs.optional.length}件)</h3>
              <div className="schema-items">
                {recs.optional.map((item, i) => (
                  <SchemaItem
                    key={i}
                    item={item}
                    schemaId={`optional_${i}`}
                    structuredDataCheck={structuredDataCheck}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {benefits && (
        <div className="expected-benefits">
          <h3>📈 期待される効果</h3>
          <div className="benefits-grid">
            <div className="benefit-item">
              <div className="benefit-percentage">{benefits.richSnippets.probability}%</div>
              <div className="benefit-description">{benefits.richSnippets.description}</div>
            </div>
            <div className="benefit-item">
              <div className="benefit-percentage">+{benefits.searchRanking.improvement}%</div>
              <div className="benefit-description">{benefits.searchRanking.description}</div>
            </div>
            <div className="benefit-item">
              <div className="benefit-percentage">+{benefits.clickThroughRate.improvement}%</div>
              <div className="benefit-description">{benefits.clickThroughRate.description}</div>
            </div>
            {benefits.localSearch && (
              <div className="benefit-item">
                <div className="benefit-percentage">+{benefits.localSearch.visibility}%</div>
                <div className="benefit-description">{benefits.localSearch.description}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
