import type { SEOCheckResult } from '../../types';
import { getPriorityTitleLong, getCategoryTitle, getStatusClass } from '../../utils/helpers';

interface DetailedReportTabProps {
  results: SEOCheckResult;
}

export function DetailedReportTab({ results }: DetailedReportTabProps) {
  const report = results.detailedReport;
  if (!report) return <p>詳細レポートがありません</p>;

  const { summary, priorityAnalysis, implementationPlan, expectedImpact } = report;

  return (
    <div className="detailed-report">
      <div className="report-summary">
        <h2>📊 総合評価</h2>
        <div className="summary-cards">
          <div className="summary-card">
            <h3>総合スコア</h3>
            <div className="score-large">{summary.overallScore}/100</div>
            <div className="grade">{summary.grades.overall}</div>
          </div>
          <div className="summary-card">
            <h3>SEOスコア</h3>
            <div className="score-large">{summary.seoScore}/100</div>
            <div className="grade">{summary.grades.seo}</div>
          </div>
          <div className="summary-card">
            <h3>AIOスコア</h3>
            <div className="score-large">{summary.aioScore}/100</div>
            <div className="grade">{summary.grades.aio}</div>
          </div>
        </div>
        <div className={`status-badge ${getStatusClass(summary.status)}`}>{summary.status}</div>
      </div>

      <div className="quick-wins">
        <h2>⚡ クイックウィン</h2>
        <div className="quick-wins-grid">
          {summary.quickWins.map((win, i) => (
            <div key={i} className="quick-win-card">
              <h4>{win.issue}</h4>
              <div className="win-meta">
                <span className="effort">工数: {win.effort}</span>
                <span className="impact">影響: {win.impact}</span>
                <span className="time">時間: {win.time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="priority-analysis">
        <h2>🎯 優先度分析</h2>
        <div className="priority-sections">
          {Object.entries(priorityAnalysis).map(([priority, items]) => (
            <div key={priority} className={`priority-section ${priority}`}>
              <h3>{getPriorityTitleLong(priority)} ({items.length}件)</h3>
              {items.map((item, i) => (
                <div key={i} className="priority-item">
                  <h4>{getCategoryTitle(item.category)}</h4>
                  <div className="item-meta">
                    <span className="impact">影響度: {item.impact}</span>
                    <span className="effort">工数: {item.effort}</span>
                    <span className="roi">ROI: {item.roi.toFixed(1)}</span>
                  </div>
                  <ul className="item-issues">
                    {item.issues.map((issue, j) => (
                      <li key={j}>{issue}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="implementation-plan">
        <h2>📋 実装計画</h2>
        {Object.entries(implementationPlan).map(([phase, plan]) => (
          <div key={phase} className="implementation-phase">
            <h3>{plan.title} ({plan.duration})</h3>
            <div className="phase-items">
              {plan.items.map((item, i) => (
                <div key={i} className="implementation-item">
                  <h4>{item.title}</h4>
                  <div className="implementation-details">
                    <div className="implementation-guide">
                      <h5>実装手順:</h5>
                      <ol>
                        {item.implementation.map((step, j) => (
                          <li key={j}>{step}</li>
                        ))}
                      </ol>
                    </div>
                    <div className="implementation-examples">
                      <h5>例:</h5>
                      <ul>
                        {item.examples.map((example, j) => (
                          <li key={j}>{example}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="implementation-tools">
                      <h5>推奨ツール:</h5>
                      <div className="tools-list">
                        {item.tools.map((tool, j) => (
                          <span key={j} className="tool-tag">
                            {tool}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="expected-impact">
        <h2>📈 期待される効果</h2>
        <div className="impact-cards">
          <div className="impact-card">
            <h3>現在のスコア</h3>
            <div className="score">{expectedImpact.currentScore}/100</div>
          </div>
          <div className="impact-card">
            <h3>改善後のスコア</h3>
            <div className="score">{expectedImpact.potentialScore}/100</div>
          </div>
          <div className="impact-card">
            <h3>改善幅</h3>
            <div className="score improvement">+{expectedImpact.improvement}</div>
          </div>
        </div>
        <div className="benefits">
          <h3>期待される効果:</h3>
          <ul>
            <li>SEO: オーガニックトラフィック +{expectedImpact.expectedBenefits.seo.organicTraffic}%</li>
            <li>ランキング: +{expectedImpact.expectedBenefits.seo.rankingImprovement}位向上</li>
            <li>CTR: +{expectedImpact.expectedBenefits.seo.clickThroughRate}</li>
            <li>AIO: AI検索での露出 +{expectedImpact.expectedBenefits.aio.aiVisibility}%</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
