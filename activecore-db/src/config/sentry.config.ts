/**
 * Sentry Configuration
 * Error tracking and monitoring for production environments
 */
import * as Sentry from '@sentry/node';
import { Request, Response, NextFunction } from 'express';

/**
 * Initialize Sentry for error tracking
 * Call this EARLY in your application, before other code
 */
export const initSentry = () => {
  // Only initialize in production if DSN is provided
  if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.1, // Capture 10% of transactions for performance monitoring
      // Ignore certain errors that are too common or not actionable
      ignoreErrors: [
        // Browser extensions
        'top.GLOBALS',
        // Network timeout errors
        'Network timeout',
        'TIMEOUT',
      ],
    });
  }
};

/**
 * Sentry error handler middleware for Express
 * Custom implementation since latest Sentry API differs
 */
export const sentryErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
    Sentry.captureException(err, {
      contexts: {
        http: {
          method: req.method,
          url: req.url,
          status_code: res.statusCode,
        },
      },
    });
  }
  next(err);
};

/**
 * Sentry Request handler middleware for Express
 * Custom implementation to track requests
 */
export const sentryRequestHandler = (req: Request, res: Response, next: NextFunction) => {
  // Simple request tracking - just call next
  // Sentry tracks errors automatically when initialized
  next();
};

/**
 * Capture exception and send to Sentry
 */
export const captureException = (error: any, context?: Record<string, any>) => {
  if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
    Sentry.captureException(error, {
      contexts: {
        custom: context,
      },
    });
  }
};

/**
 * Capture message and send to Sentry
 */
export const captureMessage = (message: string, level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info') => {
  if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
    Sentry.captureMessage(message, level);
  }
};

export default {
  initSentry,
  sentryErrorHandler,
  sentryRequestHandler,
  captureException,
  captureMessage,
};
