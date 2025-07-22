import React, { Component } from 'react';
import { AlertTriangle, RefreshCw, Home, Send, Copy, CheckCircle } from 'lucide-react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
      reportSent: false,
      showDetails: false,
      copied: false
    };
    
    // Bind methods
    this.resetError = this.resetError.bind(this);
    this.reportError = this.reportError.bind(this);
    this.copyError = this.copyError.bind(this);
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error to console
    console.error('[ErrorBoundary] Error caught:', error, errorInfo);
    
    // Update state with error details
    this.setState(prevState => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1
    }));
    
    // Log to external service
    this.logErrorToService(error, errorInfo);
    
    // Store error in localStorage for debugging
    this.storeErrorForDebugging(error, errorInfo);
    
    // Send analytics event
    this.sendAnalyticsEvent(error, errorInfo);
  }

  logErrorToService(error, errorInfo) {
    try {
      const errorData = {
        message: error.toString(),
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        errorCount: this.state.errorCount + 1
      };

      // Send to logging service
      fetch('/api/errors/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorData)
      }).catch(err => {
        console.error('[ErrorBoundary] Failed to log error:', err);
      });

      // Also log to Sentry/LogRocket/etc if available
      if (window.Sentry) {
        window.Sentry.captureException(error, {
          contexts: {
            react: {
              componentStack: errorInfo.componentStack
            }
          }
        });
      }
    } catch (logError) {
      console.error('[ErrorBoundary] Error logging failed:', logError);
    }
  }

  storeErrorForDebugging(error, errorInfo) {
    try {
      const errors = JSON.parse(localStorage.getItem('servimap_errors') || '[]');
      errors.push({
        message: error.toString(),
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        url: window.location.href
      });
      
      // Keep only last 10 errors
      if (errors.length > 10) {
        errors.shift();
      }
      
      localStorage.setItem('servimap_errors', JSON.stringify(errors));
    } catch (storageError) {
      console.error('[ErrorBoundary] Failed to store error:', storageError);
    }
  }

  sendAnalyticsEvent(error, errorInfo) {
    if (typeof gtag !== 'undefined') {
      gtag('event', 'exception', {
        description: error.toString(),
        fatal: true
      });
    }
  }

  resetError() {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      reportSent: false,
      showDetails: false,
      copied: false
    });
  }

  async reportError() {
    if (this.state.reportSent) return;

    try {
      const errorReport = {
        message: this.state.error?.toString() || 'Unknown error',
        stack: this.state.error?.stack,
        componentStack: this.state.errorInfo?.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      };

      const response = await fetch('/api/errors/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorReport)
      });

      if (response.ok) {
        this.setState({ reportSent: true });
        
        // Show success notification
        setTimeout(() => {
          this.setState({ reportSent: false });
        }, 3000);
      }
    } catch (error) {
      console.error('[ErrorBoundary] Failed to report error:', error);
    }
  }

  copyError() {
    const errorText = `
Error: ${this.state.error?.toString() || 'Unknown error'}
URL: ${window.location.href}
Time: ${new Date().toISOString()}
User Agent: ${navigator.userAgent}

Stack Trace:
${this.state.error?.stack || 'No stack trace available'}

Component Stack:
${this.state.errorInfo?.componentStack || 'No component stack available'}
    `.trim();

    navigator.clipboard.writeText(errorText).then(() => {
      this.setState({ copied: true });
      setTimeout(() => {
        this.setState({ copied: false });
      }, 2000);
    }).catch(err => {
      console.error('[ErrorBoundary] Failed to copy error:', err);
    });
  }

  render() {
    if (this.state.hasError) {
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full">
            {/* Error icon */}
            <div className="text-center mb-6">
              <div className="w-24 h-24 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-12 h-12 text-red-500" />
              </div>
            </div>

            {/* Error message */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
                ¡Ups! Algo salió mal
              </h1>
              <p className="text-gray-600 text-center mb-6">
                Encontramos un error inesperado. Por favor, intenta recargar la página.
              </p>

              {/* Action buttons */}
              <div className="space-y-3">
                <button
                  onClick={() => window.location.reload()}
                  className="w-full bg-blue-500 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-600 transition-colors flex items-center justify-center space-x-2"
                >
                  <RefreshCw className="w-5 h-5" />
                  <span>Recargar página</span>
                </button>

                <button
                  onClick={() => window.location.href = '/'}
                  className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center justify-center space-x-2"
                >
                  <Home className="w-5 h-5" />
                  <span>Ir al inicio</span>
                </button>

                <button
                  onClick={this.reportError}
                  disabled={this.state.reportSent}
                  className={`w-full py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 ${
                    this.state.reportSent
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {this.state.reportSent ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Error reportado</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Reportar error</span>
                    </>
                  )}
                </button>
              </div>

              {/* Error details (development only) */}
              {isDevelopment && (
                <div className="mt-6 pt-6 border-t">
                  <button
                    onClick={() => this.setState({ showDetails: !this.state.showDetails })}
                    className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    {this.state.showDetails ? 'Ocultar' : 'Mostrar'} detalles del error
                  </button>

                  {this.state.showDetails && (
                    <div className="mt-4">
                      <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-auto max-h-64">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs text-gray-400">Error Details</span>
                          <button
                            onClick={this.copyError}
                            className="text-xs text-gray-400 hover:text-white flex items-center space-x-1"
                          >
                            {this.state.copied ? (
                              <>
                                <CheckCircle className="w-3 h-3" />
                                <span>Copiado</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copiar</span>
                              </>
                            )}
                          </button>
                        </div>
                        <pre className="text-xs whitespace-pre-wrap font-mono">
                          <div className="mb-4">
                            <strong className="text-red-400">Error:</strong> {this.state.error?.toString()}
                          </div>
                          {this.state.error?.stack && (
                            <div className="mb-4">
                              <strong className="text-yellow-400">Stack Trace:</strong>
                              {'\n' + this.state.error.stack}
                            </div>
                          )}
                          {this.state.errorInfo?.componentStack && (
                            <div>
                              <strong className="text-blue-400">Component Stack:</strong>
                              {this.state.errorInfo.componentStack}
                            </div>
                          )}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Error frequency warning */}
              {this.state.errorCount > 2 && (
                <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="text-yellow-800 font-medium">
                        Errores frecuentes detectados
                      </p>
                      <p className="text-yellow-700 mt-1">
                        Si el problema persiste, intenta limpiar la caché del navegador
                        o contacta a soporte.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Additional help */}
            <div className="text-center mt-6">
              <p className="text-sm text-gray-500">
                ¿Necesitas ayuda? Contáctanos en{' '}
                <a href="mailto:soporte@servimap.com" className="text-blue-500 hover:underline">
                  soporte@servimap.com
                </a>
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Error boundary wrapper with retry logic
export const withErrorBoundary = (Component, fallback) => {
  return class extends React.Component {
    render() {
      return (
        <ErrorBoundary fallback={fallback}>
          <Component {...this.props} />
        </ErrorBoundary>
      );
    }
  };
};

// Async error boundary for handling promise rejections
export class AsyncErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  componentDidMount() {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  componentWillUnmount() {
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  handleUnhandledRejection = (event) => {
    console.error('[AsyncErrorBoundary] Unhandled promise rejection:', event.reason);
    
    // Prevent the default behavior
    event.preventDefault();
    
    // Log to service
    this.logAsyncError(event.reason);
    
    // Optionally show error UI
    if (this.props.showAsyncErrors) {
      this.setState({ hasError: true, error: event.reason });
    }
  };

  logAsyncError(error) {
    try {
      fetch('/api/errors/async', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: error?.toString() || 'Unhandled promise rejection',
          stack: error?.stack,
          timestamp: new Date().toISOString(),
          url: window.location.href
        })
      }).catch(err => {
        console.error('[AsyncErrorBoundary] Failed to log async error:', err);
      });
    } catch (logError) {
      console.error('[AsyncErrorBoundary] Error logging failed:', logError);
    }
  }

  render() {
    if (this.state.hasError && this.props.showAsyncErrors) {
      return (
        <div className="p-4 bg-red-50 rounded-lg">
          <p className="text-red-800">Error asíncrono detectado. Por favor, recarga la página.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;