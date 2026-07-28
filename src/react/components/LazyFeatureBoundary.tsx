import { Component, type ErrorInfo, type ReactNode, Suspense } from 'react';

interface LazyFeatureBoundaryProps {
  children: ReactNode;
  label: string;
  resetKey?: string | number | boolean;
}

interface LazyFeatureBoundaryState {
  failed: boolean;
}

export class LazyFeatureBoundary extends Component<LazyFeatureBoundaryProps, LazyFeatureBoundaryState> {
  state: LazyFeatureBoundaryState = { failed: false };

  static getDerivedStateFromError(): Partial<LazyFeatureBoundaryState> {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`Lazy feature failed: ${this.props.label}`, error, info);
  }

  componentDidUpdate(previousProps: LazyFeatureBoundaryProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.failed) {
      this.setState({ failed: false });
    }
  }

  private retry = () => {
    window.location.reload();
  };

  render() {
    if (this.state.failed) {
      return (
        <section className="lazy-feature-error" role="alert">
          <strong>{this.props.label} yüklenemedi.</strong>
          <span>Yerel paket okunamadı. Bağlantıyı veya uygulama önbelleğini kontrol edip yeniden deneyin.</span>
          <button type="button" onClick={this.retry}>Yeniden dene</button>
        </section>
      );
    }

    return (
      <Suspense fallback={<div className="lazy-feature-loading" role="status">{this.props.label} yükleniyor…</div>}>
        {this.props.children}
      </Suspense>
    );
  }
}
