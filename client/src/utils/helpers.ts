export function getScoreClass(score: number): string {
  if (score >= 90) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  return 'poor';
}

export function getPriorityTitle(priority: string): string {
  const titles: Record<string, string> = {
    critical: '緊急',
    high: '高',
    medium: '中',
    low: '低',
  };
  return titles[priority] || priority;
}

export function getPriorityTitleLong(priority: string): string {
  const titles: Record<string, string> = {
    critical: '緊急対応',
    high: '高優先度',
    medium: '中優先度',
    low: '低優先度',
  };
  return titles[priority] || priority;
}

export function getStatusClass(status: string): string {
  if (status === '要緊急対応') return 'status-critical';
  if (status === '良好') return 'status-good';
  if (status === '改善必要') return 'status-warning';
  return 'status-poor';
}

export function getCategoryTitle(category: string): string {
  const titles: Record<string, string> = {
    titleTag: 'タイトルタグ',
    metaDescription: 'メタディスクリプション',
    headingStructure: '見出し構造',
    imageAltAttributes: '画像alt属性',
    internalLinkStructure: '内部リンク構造',
    structuredData: '構造化データ',
    otherSEOElements: 'その他SEO要素',
    contentComprehensiveness: 'コンテンツ包括性',
    structuredInformation: '構造化情報',
    credibilitySignals: '信頼性シグナル',
    aiSearchOptimization: 'AI検索最適化',
    naturalLanguageQuality: '自然言語品質',
    contextRelevance: 'コンテキスト関連性',
  };
  return titles[category] || category;
}

export function getPageTypeDisplayName(pageType: string): string {
  const names: Record<string, string> = {
    Article: '記事・ブログ',
    Product: '商品ページ',
    LocalBusiness: '店舗・企業',
    Recipe: 'レシピ',
    Event: 'イベント',
    FAQ: 'よくある質問',
    HowTo: '手順・ガイド',
    Review: 'レビュー',
    JobPosting: '求人情報',
    Course: 'コース・講座',
  };
  return names[pageType] || pageType;
}

export function getIssueTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    missing: '存在しない',
    length: '長さの問題',
    duplicate: '重複',
    format: '形式の問題',
    quality: '品質の問題',
    hierarchy: '階層の問題',
    empty: '空の要素',
    count: '数の問題',
    missing_alt: 'alt属性なし',
    empty_alt: '空のalt属性',
    alt_length: 'alt属性の長さ',
    alt_quality: 'alt属性の品質',
    internal_count: '内部リンク数',
    external_missing: '外部リンクなし',
    empty_text: '空のリンクテキスト',
    generic_text: '汎用的なリンクテキスト',
    jsonld_syntax: 'JSON-LD構文エラー',
    missing_schema: 'スキーマ不足',
    protocol: 'プロトコル',
    depth: 'ディレクトリの深さ',
    viewport_content: 'viewport内容',
    noindex: 'noindex設定',
  };
  return labels[type] || type;
}

export function getEstimatedTime(schema: string): string {
  const times: Record<string, string> = {
    Article: '30分',
    Product: '1-2時間',
    LocalBusiness: '1時間',
    Recipe: '2-3時間',
    Event: '1時間',
    FAQPage: '30分',
    HowTo: '2-3時間',
    Review: '30分',
    JobPosting: '1時間',
    Course: '1-2時間',
  };
  return times[schema] || '1時間';
}

export function getImplementationBenefits(schema: string): string[] | undefined {
  const benefits: Record<string, string[]> = {
    Article: ['Googleニュースでの露出向上', 'リッチスニペット表示の可能性', 'author情報の表示'],
    Product: ['商品リッチスニペット表示', '価格・在庫情報の表示', 'レビュー星評価の表示'],
    LocalBusiness: ['Googleマップでの表示改善', '営業時間の表示', 'ローカル検索での上位表示'],
    Recipe: ['レシピリッチスニペット表示', '調理時間・カロリー表示', 'レシピ検索での優遇'],
  };
  return benefits[schema] || ['SEO効果の向上', '検索結果での目立ち度アップ'];
}

export function getAnalysisReason(analysis: {
  analysisDetails?: { matchedPatterns?: { keywords?: string[]; titlePatterns?: string[]; urlPatterns?: string[] } };
}): string {
  const patterns = analysis.analysisDetails?.matchedPatterns;
  if (!patterns) return '内容分析による判定';
  const reasons: string[] = [];
  if (patterns.keywords?.length) reasons.push(`キーワード: ${patterns.keywords.slice(0, 3).join(', ')}`);
  if (patterns.titlePatterns?.length) reasons.push(`タイトルパターン: ${patterns.titlePatterns.slice(0, 2).join(', ')}`);
  if (patterns.urlPatterns?.length) reasons.push(`URLパターン: ${patterns.urlPatterns.slice(0, 2).join(', ')}`);
  return reasons.length ? reasons.join(', ') : '内容分析による判定';
}
