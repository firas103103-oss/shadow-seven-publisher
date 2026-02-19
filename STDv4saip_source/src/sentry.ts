/**
 * Sentry Configuration - Error Monitoring
 * Feras Ayham Assaf - X-Book System
 */

import * as Sentry from '@sentry/react';

export function initSentry() {
 // Only initialize in production
 if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
 Sentry.init({
 dsn: import.meta.env.VITE_SENTRY_DSN,

 // Performance Monitoring
 integrations: [
 Sentry.browserTracingIntegration(),
 Sentry.replayIntegration({
 maskAllText: true,
 blockAllMedia: true,
 }),
 ],

 // Set tracesSampleRate to 1.0 to capture 100% of transactions
 // Adjust in production to avoid high data volume
 tracesSampleRate: 0.1, // 10% of transactions

 // Capture Replay for 10% of all sessions,
 // plus 100% of sessions with an error
 replaysSessionSampleRate: 0.1,
 replaysOnErrorSampleRate: 1.0,

 // Environment
 environment: import.meta.env.MODE,

 // Release tracking
 release: 'the-seventh-shadow',

 // Ignore common non-critical errors
 ignoreErrors: [
 'ResizeObserver loop limit exceeded',
 'Non-Error promise rejection captured',
 'AbortError',
 ],

 // Before send hook - sanitize sensitive data
 beforeSend(event, hint) {
 // Remove sensitive data
 if (event.request) {
 delete event.request.cookies;
 delete event.request.headers;
 }

 // Log to console in development
 if (import.meta.env.DEV) {
 console.error('Sentry Event:', event, hint);
 }

 return event;
 },
 });

 console.log('✅ Sentry initialized');
 } else {
 console.log('⚠️ Sentry disabled (DEV mode or missing DSN)');
 }
}

// Error boundary wrapper for Sentry
export const SentryErrorBoundary = Sentry.ErrorBoundary;

// Profiler for performance monitoring
export const withSentryProfiler = Sentry.withProfiler;
