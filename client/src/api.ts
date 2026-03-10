import type { ApiResponse, SEOCheckResult } from './types';

const API_BASE = '';

export async function checkSEO(
  url: string,
  html: string,
  waitForJS: boolean
): Promise<ApiResponse<SEOCheckResult>> {
  const res = await fetch(`${API_BASE}/api/check/seo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: url || undefined, html: html || undefined, waitForJS }),
  });
  return res.json();
}

export async function getReport(
  url: string,
  html: string,
  waitForJS: boolean
): Promise<ApiResponse<{ results: SEOCheckResult; report: string }>> {
  const res = await fetch(`${API_BASE}/api/report/seo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: url || undefined, html: html || undefined, waitForJS }),
  });
  return res.json();
}
