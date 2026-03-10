import { useState } from 'react';
import type { SEOCheckResult } from '../types';
import { SummaryTab } from './tabs/SummaryTab';
import { DetailsTab } from './tabs/DetailsTab';
import { AIOTab } from './tabs/AIOTab';
import { StructuredDataTab } from './tabs/StructuredDataTab';
import { SpecificIssuesTab } from './tabs/SpecificIssuesTab';
import { DetailedReportTab } from './tabs/DetailedReportTab';
import { ReportTab } from './tabs/ReportTab';

const TABS = [
  { id: 'summary', label: 'サマリー' },
  { id: 'details', label: 'SEO詳細' },
  { id: 'aio', label: 'AIO詳細' },
  { id: 'structured-data', label: '構造化データ' },
  { id: 'specific', label: '具体的な箇所' },
  { id: 'detailed', label: '詳細レポート' },
  { id: 'report', label: 'Markdownレポート' },
] as const;

type TabId = (typeof TABS)[number]['id'];

interface ResultsContainerProps {
  results: SEOCheckResult;
  reportText: string;
}

export function ResultsContainer({ results, reportText }: ResultsContainerProps) {
  const [activeTab, setActiveTab] = useState<TabId>('summary');
  const overallScore = Math.round(results.combinedScore ?? results.overallScore ?? 0);

  return (
    <div className={`results-container visible`}>
      <div className="score-display">
        <div className="score-number" id="overallScore">
          {overallScore}
        </div>
        <div className="score-label">総合SEOスコア</div>
      </div>

      <div className="tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`tab${activeTab === tab.id ? ' active' : ''}`}
            data-tab={tab.id}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={`tab-content${activeTab === 'summary' ? ' active' : ''}`} id="summary">
        <SummaryTab results={results} />
      </div>
      <div className={`tab-content${activeTab === 'details' ? ' active' : ''}`} id="details">
        <DetailsTab results={results} />
      </div>
      <div className={`tab-content${activeTab === 'aio' ? ' active' : ''}`} id="aio">
        <AIOTab results={results} />
      </div>
      <div className={`tab-content${activeTab === 'structured-data' ? ' active' : ''}`} id="structured-data">
        <StructuredDataTab results={results} />
      </div>
      <div className={`tab-content${activeTab === 'specific' ? ' active' : ''}`} id="specific">
        <SpecificIssuesTab results={results} />
      </div>
      <div className={`tab-content${activeTab === 'detailed' ? ' active' : ''}`} id="detailed">
        <DetailedReportTab results={results} />
      </div>
      <div className={`tab-content${activeTab === 'report' ? ' active' : ''}`} id="report">
        <ReportTab reportText={reportText} />
      </div>
    </div>
  );
}
