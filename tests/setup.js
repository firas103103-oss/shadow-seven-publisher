import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock environment variables
vi.mock('import.meta', () => ({
  env: {
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'test-key',
    VITE_GOOGLE_AI_API_KEY: 'test-google-ai-key',
  },
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock IndexedDB if not already available
if (!global.indexedDB) {
  const fakeIndexedDB = require('fake-indexeddb');
  global.indexedDB = fakeIndexedDB;
  global.IDBDatabase = fakeIndexedDB.IDBDatabase;
  global.IDBFactory = fakeIndexedDB.IDBFactory;
  global.IDBKeyRange = fakeIndexedDB.IDBKeyRange;
  global.IDBObjectStore = fakeIndexedDB.IDBObjectStore;
  global.IDBRequest = fakeIndexedDB.IDBRequest;
  global.IDBTransaction = fakeIndexedDB.IDBTransaction;
}
