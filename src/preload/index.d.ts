import type { api } from './index';

declare global {
  interface Window {
    ink: typeof api;
  }
}
