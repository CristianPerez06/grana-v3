'use client'

import { Component, type ReactNode } from 'react'
import { RouteError } from '@/components/ui/route-error'

type Props = { children: ReactNode }
type State = { error: (Error & { digest?: string }) | null }

export class DashboardErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error & { digest?: string }): State {
    return { error }
  }

  reset = () => this.setState({ error: null })

  render() {
    if (this.state.error) {
      return <RouteError error={this.state.error} onRetry={this.reset} />
    }
    return this.props.children
  }
}
