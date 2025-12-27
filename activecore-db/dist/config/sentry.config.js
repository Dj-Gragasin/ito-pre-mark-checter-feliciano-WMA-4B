"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.captureMessage = exports.captureException = exports.sentryRequestHandler = exports.sentryErrorHandler = exports.initSentry = void 0;
/**
 * Sentry Configuration
 * Error tracking and monitoring for production environments
 */
const Sentry = __importStar(require("@sentry/node"));
/**
 * Initialize Sentry for error tracking
 * Call this EARLY in your application, before other code
 */
const initSentry = () => {
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
exports.initSentry = initSentry;
/**
 * Sentry error handler middleware for Express
 * Custom implementation since latest Sentry API differs
 */
const sentryErrorHandler = (err, req, res, next) => {
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
exports.sentryErrorHandler = sentryErrorHandler;
/**
 * Sentry Request handler middleware for Express
 * Custom implementation to track requests
 */
const sentryRequestHandler = (req, res, next) => {
    // Simple request tracking - just call next
    // Sentry tracks errors automatically when initialized
    next();
};
exports.sentryRequestHandler = sentryRequestHandler;
/**
 * Capture exception and send to Sentry
 */
const captureException = (error, context) => {
    if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
        Sentry.captureException(error, {
            contexts: {
                custom: context,
            },
        });
    }
};
exports.captureException = captureException;
/**
 * Capture message and send to Sentry
 */
const captureMessage = (message, level = 'info') => {
    if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
        Sentry.captureMessage(message, level);
    }
};
exports.captureMessage = captureMessage;
exports.default = {
    initSentry: exports.initSentry,
    sentryErrorHandler: exports.sentryErrorHandler,
    sentryRequestHandler: exports.sentryRequestHandler,
    captureException: exports.captureException,
    captureMessage: exports.captureMessage,
};
