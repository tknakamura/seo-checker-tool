import { useState } from 'react';
import type { SEOCheckResult, CategoryIssues } from '../../types';
import { getIssueTypeLabel } from '../../utils/helpers';

const CATEGORIES = [
  { key: 'titleTag', name: 'タイトルタグ', icon: '📝' },
  { key: 'metaDescription', name: 'メタディスクリプション', icon: '📄' },
  { key: 'headingStructure', name: '見出し構造', icon: '📋' },
  { key: 'imageAltAttributes', name: '画像alt属性', icon: '🖼️' },
  { key: 'internalLinkStructure', name: '内部リンク構造', icon: '🔗' },
  { key: 'structuredData', name: '構造化データ', icon: '🏗️' },
  { key: 'otherSEOElements', name: 'その他SEO要素', icon: '⚙️' },
];

interface SpecificIssuesTabProps {
  results: SEOCheckResult;
}

function IssueBlock({
  categoryKey,
  index,
  issue,
}: {
  categoryKey: string;
  index: number;
  issue: { type: string; location: string; description: string; fix: string; current?: string; length?: number; count?: number };
}) {
  const [open, setOpen] = useState(false);
  const id = `${categoryKey}_${index}`;
  return (
    <div className="specific-issue">
      <div
        className="issue-header"
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => e.key === 'Enter' && setOpen(!open)}
        role="button"
        tabIndex={0}
      >
        <span className={`issue-type ${issue.type}`}>{getIssueTypeLabel(issue.type)}</span>
        <span className="issue-location">{issue.location}</span>
        <span className="toggle-icon">{open ? '▲' : '▼'}</span>
      </div>
      <div className="issue-description">{issue.description}</div>
      {open && (
        <div className="issue-details" id={id}>
          <div className="issue-fix">
            <h4>修正方法:</h4>
            <p>{issue.fix}</p>
          </div>
          {issue.current != null && (
            <div className="issue-current">
              <h4>現在の値:</h4>
              <code>{issue.current}</code>
            </div>
          )}
          <div className="issue-meta">
            {issue.length != null && <span className="meta-item">文字数: {issue.length}</span>}
            {issue.count != null && <span className="meta-item">件数: {issue.count}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

export function SpecificIssuesTab({ results }: SpecificIssuesTabProps) {
  const analysis = results.detailedAnalysis;
  if (!analysis) return <p>詳細分析結果がありません</p>;

  return (
    <div className="specific-issues">
      <h2>🎯 具体的な問題箇所</h2>
      <p className="description">
        以下の箇所で具体的な問題が発見されました。各項目をクリックすると詳細な修正方法が表示されます。
      </p>
      {CATEGORIES.map((cat) => {
        const categoryData = analysis[cat.key as keyof typeof analysis] as CategoryIssues | undefined;
        const issues = categoryData?.specificIssues;
        if (!issues || issues.length === 0) return null;
        return (
          <div key={cat.key} className="category-section">
            <h3>{cat.icon} {cat.name}</h3>
            <div className="issues-list">
              {issues.map((issue, i) => (
                <IssueBlock key={i} categoryKey={cat.key} index={i} issue={issue} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
