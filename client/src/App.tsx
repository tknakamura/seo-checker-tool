import { useState, useCallback } from 'react';
import { Header } from './components/Header';
import { CheckForm } from './components/CheckForm';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ResultsContainer } from './components/ResultsContainer';
import { checkSEO, getReport } from './api';
import type { SEOCheckResult } from './types';

type MessageType = 'error' | 'success' | null;

export default function App() {
  const [url, setUrl] = useState('');
  const [html, setHtml] = useState('');
  const [waitForJS, setWaitForJS] = useState(true);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SEOCheckResult | null>(null);
  const [reportText, setReportText] = useState('');
  const [message, setMessage] = useState<{ text: string; type: MessageType }>({ text: '', type: null });

  const showMessage = useCallback((text: string, type: MessageType) => {
    setMessage({ text, type });
    if (type) {
      setTimeout(() => setMessage({ text: '', type: null }), 3000);
    }
  }, []);

  const runSEOCheck = useCallback(async () => {
    if (!url && !html) {
      showMessage('URLまたはHTMLコンテンツを入力してください', 'error');
      return;
    }
    setLoading(true);
    setResults(null);
    try {
      const res = await checkSEO(url, html, waitForJS);
      if (res.success && res.data) {
        setResults(res.data);
        showMessage('SEOチェックが完了しました', 'success');
        // Fetch report in background
        getReport(url, html, waitForJS).then((reportRes) => {
          if (reportRes.success && reportRes.data?.report) {
            setReportText(reportRes.data.report);
          }
        });
      } else {
        showMessage(res.error ?? 'SEOチェック中にエラーが発生しました', 'error');
      }
    } catch (err) {
      showMessage('ネットワークエラーが発生しました: ' + (err instanceof Error ? err.message : String(err)), 'error');
    } finally {
      setLoading(false);
    }
  }, [url, html, waitForJS, showMessage]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      runSEOCheck();
    },
    [runSEOCheck]
  );

  const handleClear = useCallback(() => {
    setUrl('');
    setHtml('');
    setResults(null);
    setReportText('');
  }, []);

  return (
    <div className="container">
      <Header />
      <CheckForm
        url={url}
        html={html}
        waitForJS={waitForJS}
        loading={loading}
        message={message}
        onUrlChange={setUrl}
        onHtmlChange={setHtml}
        onWaitForJSChange={setWaitForJS}
        onSubmit={handleSubmit}
        onClear={handleClear}
      />
      <LoadingSpinner visible={loading} />
      {results && <ResultsContainer results={results} reportText={reportText} />}
    </div>
  );
}
