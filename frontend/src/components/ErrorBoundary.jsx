import { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) {
      console.error('Nightfeed error boundary caught:', error, info);
    }
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div className="state-panel state-panel-error" role="alert">
          <h3 className="state-panel-title">Something went wrong</h3>
          <p className="state-panel-message">A component crashed unexpectedly. You can keep browsing — try reloading this view.</p>
          <div className="state-panel-actions">
            <button type="button" className="state-panel-button primary" onClick={this.reset}>Try again</button>
            <button type="button" className="state-panel-button" onClick={() => window.location.reload()}>Reload page</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
