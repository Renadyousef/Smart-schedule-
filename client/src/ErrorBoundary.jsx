import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("Render error:", error, info); }

  render() {
    if (this.state.error) {
      return (
        <div className="container py-5">
          <h2 className="text-danger">Something went wrong.</h2>
          <pre className="bg-light p-3 rounded" style={{ whiteSpace: "pre-wrap" }}>
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <p className="text-muted">
            افتحي الـConsole لمزيد من التفاصيل. عطيني أول خطأ أحمر لو استمرّت المشكلة.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
