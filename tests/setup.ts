import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { configurarClienteGeminiMock } from '../src/core/gemini';

if (typeof window !== 'undefined') {
  window.URL.createObjectURL = window.URL.createObjectURL || (() => 'blob:mock-url');
  window.URL.revokeObjectURL = window.URL.revokeObjectURL || (() => {});
  HTMLAnchorElement.prototype.click = () => {};
}

afterEach(async () => {
  cleanup();
  window.sessionStorage.clear();
  window.localStorage.clear();
  configurarClienteGeminiMock(null);
});
