export interface SEOCheckResult {
  url?: string;
  timestamp?: string;
  overallScore?: number;
  aioOverallScore?: number;
  combinedScore?: number;
  checks: Record<string, SEOCheckItem>;
  aio?: AIOChecks;
  conciseRecommendations?: ConciseRecommendation[];
  detailedAnalysis?: DetailedAnalysis;
  detailedReport?: DetailedReport;
}

export interface SEOCheckItem {
  score: number;
  current?: string;
  length?: number;
  issues?: string[];
  recommendations?: string[];
}

export interface AIOChecks {
  overallScore: number;
  checks: Record<string, SEOCheckItem>;
}

export interface ConciseRecommendation {
  priority: string;
  fix: string;
  element: string;
  location: string;
  count?: number;
}

export interface DetailedAnalysis {
  titleTag?: CategoryIssues;
  metaDescription?: CategoryIssues;
  headingStructure?: CategoryIssues;
  imageAltAttributes?: CategoryIssues;
  internalLinkStructure?: CategoryIssues;
  structuredData?: CategoryIssues;
  otherSEOElements?: CategoryIssues;
}

export interface CategoryIssues {
  specificIssues?: SpecificIssue[];
}

export interface SpecificIssue {
  type: string;
  location: string;
  description: string;
  fix: string;
  current?: string;
  length?: number;
  count?: number;
}

export interface DetailedReport {
  summary: {
    overallScore: number;
    seoScore: number;
    aioScore: number;
    grades: { overall: string; seo: string; aio: string };
    status: string;
    quickWins: Array<{ issue: string; effort: string; impact: string; time: string }>;
  };
  priorityAnalysis: Record<string, PriorityItem[]>;
  implementationPlan: Record<string, ImplementationPhase>;
  expectedImpact: {
    currentScore: number;
    potentialScore: number;
    improvement: number;
    expectedBenefits: {
      seo: { organicTraffic: number; rankingImprovement: number; clickThroughRate: string };
      aio: { aiVisibility: number };
    };
  };
}

export interface PriorityItem {
  category: string;
  impact: string;
  effort: string;
  roi: number;
  issues: string[];
}

export interface ImplementationPhase {
  title: string;
  duration: string;
  items: Array<{
    title: string;
    implementation: string[];
    examples: string[];
    tools: string[];
  }>;
}

export interface StructuredDataCheck extends SEOCheckItem {
  pageTypeAnalysis?: {
    primaryType: string;
    secondaryTypes?: string[];
    confidence: number;
    analysisDetails?: { matchedPatterns?: { keywords?: string[]; titlePatterns?: string[]; urlPatterns?: string[] } };
  };
  structuredDataRecommendations?: {
    recommendations: {
      missing: SchemaRecommendationItem[];
      improvements: SchemaRecommendationItem[];
      optional: SchemaRecommendationItem[];
    };
    expectedBenefits?: {
      richSnippets: { probability: number; description: string };
      searchRanking: { improvement: number; description: string };
      clickThroughRate: { improvement: number; description: string };
      localSearch?: { visibility: number; description: string };
    };
  };
  implementationExamples?: {
    templates?: Record<string, { schema?: unknown }>;
  };
}

export interface SchemaRecommendationItem {
  schema: string;
  priority: string;
  reason: string;
  seoValue?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
