import { FormEvent } from 'react';

interface MessageState {
  text: string;
  type: 'error' | 'success' | null;
}

interface CheckFormProps {
  url: string;
  html: string;
  waitForJS: boolean;
  loading: boolean;
  message: MessageState;
  onUrlChange: (v: string) => void;
  onHtmlChange: (v: string) => void;
  onWaitForJSChange: (v: boolean) => void;
  onSubmit: (e: FormEvent) => void;
  onClear: () => void;
}

export function CheckForm({
  url,
  html,
  waitForJS,
  loading,
  onUrlChange,
  onHtmlChange,
  onWaitForJSChange,
  onSubmit,
  onClear,
  message,
}: CheckFormProps) {
  return (
    <div className="form-container">
      {message.type && (
        <div className={message.type === 'error' ? 'error-message' : 'success-message'}>{message.text}</div>
      )}
      <form id="seoCheckForm" onSubmit={onSubmit}>
        <div className="form-group">
          <label htmlFor="url">WebページURL</label>
          <input
            type="url"
            id="url"
            name="url"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="html">またはHTMLコンテンツ（オプション）</label>
          <textarea
            id="html"
            name="html"
            placeholder="HTMLコンテンツを直接貼り付ける場合はこちらに記入してください"
            value={html}
            onChange={(e) => onHtmlChange(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="check-type-label">チェックタイプを選択してください</label>
          <div className="check-type-options">
            <div
              className={`check-type-option${!waitForJS ? ' active' : ''}`}
              data-type="simple"
              onClick={() => onWaitForJSChange(false)}
              onKeyDown={(e) => e.key === 'Enter' && onWaitForJSChange(false)}
              role="button"
              tabIndex={0}
            >
              <div className="option-icon">⚡</div>
              <div className="option-title">Simple Check (Fast)</div>
              <div className="option-desc">高速チェック（従来の方法）</div>
            </div>
            <div
              className={`check-type-option${waitForJS ? ' active' : ''}`}
              data-type="advanced"
              onClick={() => onWaitForJSChange(true)}
              onKeyDown={(e) => e.key === 'Enter' && onWaitForJSChange(true)}
              role="button"
              tabIndex={0}
            >
              <div className="option-icon">🚀</div>
              <div className="option-title">Advanced Check (JavaScript)</div>
              <div className="option-desc">JavaScript実行待機（動的コンテンツ対応）</div>
            </div>
          </div>
        </div>
        <div className="button-group">
          <button type="submit" className="btn btn-primary" id="checkBtn" disabled={loading}>
            SEOチェック実行
          </button>
          <button type="button" className="btn btn-secondary" id="clearBtn" onClick={onClear}>
            クリア
          </button>
        </div>
      </form>
    </div>
  );
}
