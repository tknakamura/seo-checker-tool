interface LoadingSpinnerProps {
  visible: boolean;
}

export function LoadingSpinner({ visible }: LoadingSpinnerProps) {
  return (
    <div className={`loading${visible ? ' visible' : ''}`} id="loading">
      <div className="spinner" />
      <p>SEOチェックを実行中...</p>
    </div>
  );
}
