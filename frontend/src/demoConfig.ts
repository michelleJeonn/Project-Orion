export const DEMO_STORAGE_KEY = 'GENESIS_DEMO_MODE';

export function isDemoMode() {
  const stored = localStorage.getItem(DEMO_STORAGE_KEY);
  // default ON — falls back to mock data when no backend is present
  return stored === null ? true : stored === 'true';
}

export function setDemoMode(value: boolean) {
  localStorage.setItem(DEMO_STORAGE_KEY, value ? 'true' : 'false');
  // Dispatch an event so components can react
  window.dispatchEvent(new Event('demo_mode_changed'));
}
