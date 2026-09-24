export type Edition = 'ygroup' | 'labrika';
export const edition:Edition = 'labrika';
export const isLabrika = true;
export const productName = isLabrika ? 'LABRIKA' : 'YGROUP';
export const basePath = '';
export function workspaceKey(key:string):string {
  if (!isLabrika) return key.startsWith('ygroup-') ? key : `ygroup-${key}`;
  const id=sessionStorage.getItem('labrika-current-account')||localStorage.getItem('labrika-current-account')||'guest';
  return `labrika-workspace-${id}-${key.replace(/^ygroup-/, '')}`;
}
export function readWorkspace<T>(key:string,fallback:T):T {try{return JSON.parse(localStorage.getItem(workspaceKey(key))??'null')??fallback;}catch{return fallback;}}
export function saveWorkspace(key:string,value:unknown){localStorage.setItem(workspaceKey(key),JSON.stringify(value));}
