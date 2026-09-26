import { useEffect, useState } from 'react';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { readWorkspace, saveWorkspace, workspaceKey } from './runtime';

export type Appearance = 'light' | 'dark' | 'system';
const eventName = 'workspace-appearance-change';
const savedAppearance = (): Appearance => {
  const value = readWorkspace<string>('appearance-v1', 'system');
  return value === 'light' || value === 'dark' ? value : 'system';
};
function applyAppearance(value: Appearance) {
  const dark = value === 'dark' || (value === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  const nextTheme = dark ? 'dark' : 'light';
  if (document.documentElement.dataset.theme !== nextTheme) {
    document.documentElement.dataset.themeSwitching = 'true';
    requestAnimationFrame(() => requestAnimationFrame(() => { delete document.documentElement.dataset.themeSwitching; }));
  }
  document.documentElement.dataset.theme = nextTheme;
  document.documentElement.dataset.appearance = value;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#141719' : '#f4f4f7');
}

// Applies to portal dialogs as well as the workspace, and follows OS changes only in System mode.
export function ThemeController() {
  const scope = workspaceKey('appearance-v1');
  useEffect(() => {
    const update = () => applyAppearance(savedAppearance());
    const system = matchMedia('(prefers-color-scheme: dark)');
    update();
    system.addEventListener('change', update);
    window.addEventListener(eventName, update);
    window.addEventListener('labrika-account-change', update);
    window.addEventListener('storage', update);
    return () => {
      system.removeEventListener('change', update);
      window.removeEventListener(eventName, update);
      window.removeEventListener('labrika-account-change', update);
      window.removeEventListener('storage', update);
    };
  }, [scope]);
  return null;
}

export default function AppearanceSettings() {
  const [appearance, setAppearance] = useState<Appearance>(savedAppearance);
  useEffect(() => {
    const update = () => setAppearance(savedAppearance());
    window.addEventListener('storage', update);
    window.addEventListener(eventName, update);
    return () => { window.removeEventListener('storage', update); window.removeEventListener(eventName, update); };
  }, []);
  const choices = [
    { value: 'light' as const, label: 'Светлая', icon: Sun },
    { value: 'dark' as const, label: 'Тёмная', icon: Moon },
    { value: 'system' as const, label: 'Системная', icon: Monitor },
  ];
  return <section className="panel appearance-settings">
    <h2>Оформление</h2>
    <div className="appearance-options" role="radiogroup" aria-label="Тема интерфейса">
      {choices.map(({ value, label, icon: Icon }) => <button type="button" key={value} role="radio" aria-checked={appearance === value} className={`appearance-option ${appearance === value ? 'selected' : ''}`} onClick={() => {
        saveWorkspace('appearance-v1', value);
        setAppearance(value);
        applyAppearance(value);
        window.dispatchEvent(new Event(eventName));
      }}>
        <span className={`appearance-preview appearance-preview-${value}`} aria-hidden="true"><i className="appearance-preview-bar"/><i className="appearance-preview-rail"/><i className="appearance-preview-card"/><i className="appearance-preview-chart"/></span>
        <span className="appearance-label"><Icon size={16}/>{label}<span className="appearance-check">{appearance === value && <Check size={12}/>}</span></span>
      </button>)}
    </div>
  </section>;
}
