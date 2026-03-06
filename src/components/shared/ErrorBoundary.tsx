"use client";

import { Component, type ReactNode } from "react";
import { RetryErrorBoundaryFallback } from "./RetryErrorBoundaryFallback";

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: React.ComponentType<{ error: Error; onRetry?: () => void }>;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const Fallback = this.props.fallback ?? RetryErrorBoundaryFallback;
      return (
        <Fallback error={this.state.error} onRetry={this.handleRetry} />
      );
    }
    return this.props.children;
  }
}
