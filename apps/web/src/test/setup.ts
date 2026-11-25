import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

installMemoryStorage();

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function installMemoryStorage() {
  if (typeof globalThis.localStorage?.setItem === 'function') return;
  const memory = new Map<string, string>();
  const storage: Storage = {
    get length() { return memory.size; },
    clear() { memory.clear(); },
    getItem(key) { return memory.has(key) ? memory.get(key) ?? null : null; },
    key(index) { return [...memory.keys()][index] ?? null; },
    removeItem(key) { memory.delete(key); },
    setItem(key, value) { memory.set(String(key), String(value)); },
  };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: storage });
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', { configurable: true, writable: true, value: storage });
  }
}

