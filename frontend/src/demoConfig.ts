export const DEMO_STORAGE_KEY = 'GENESIS_DEMO_MODE';

export function isDemoMode() {
  const stored = localStorage.getItem(DEMO_STORAGE_KEY);
  // default ON — uses mock data; toggle off via the button once backend is running
  return stored === null ? true : stored === 'true';
}

export function setDemoMode(value: boolean) {
  localStorage.setItem(DEMO_STORAGE_KEY, value ? 'true' : 'false');
  // Dispatch an event so components can react
  window.dispatchEvent(new Event('demo_mode_changed'));
}
