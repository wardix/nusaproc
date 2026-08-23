import React, { Component, type ReactNode } from 'react';
import { Result, Button } from 'antd';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public render() {
    if (this.state.hasError) {
      return (
        <Result
          status="500"
          title="Terjadi Kesalahan Sistem"
          subTitle={this.state.error?.message || 'Silakan muat ulang halaman atau hubungi administrator.'}
          extra={
            <Button type="primary" onClick={() => window.location.reload()}>
              Muat Ulang Halaman
            </Button>
          }
        />
      );
    }

    return this.props.children;
  }
}
