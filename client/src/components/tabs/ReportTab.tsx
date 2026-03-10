interface ReportTabProps {
  reportText: string;
}

export function ReportTab({ reportText }: ReportTabProps) {
  return (
    <div className="report-section">
      <h2>SEOチェックレポート</h2>
      <div className="report-content">{reportText || 'レポートを取得中...'}</div>
    </div>
  );
}
