export type Edition = 'ygroup' | 'labrika';
export const edition:Edition = 'labrika';
export const isLabrika = true;
export const productName = isLabrika ? 'LABRICA' : 'YGROUP';
const deploymentBase = import.meta.env.BASE_URL.replace(/\/$/, '');
export const basePath = isLabrika ? `${deploymentBase}/labrika` : '/ygroup';
export function workspaceKey(key:string):string {
  if (!isLabrika) return key.startsWith('ygroup-') ? key : `ygroup-${key}`;
  const accountId=sessionStorage.getItem('labrika-current-account')||localStorage.getItem('labrika-current-account')||'guest';
  let id=accountId;try{const db=JSON.parse(localStorage.getItem('labrika-billing-v1')||'{}');id=db.accounts?.find((a:{id:string;ownerId?:string})=>a.id===accountId)?.ownerId||accountId;}catch{}
  return `labrika-workspace-${id}-${key.replace(/^ygroup-/, '')}`;
}
export function readWorkspace<T>(key:string,fallback:T):T {try{return JSON.parse(localStorage.getItem(workspaceKey(key))??'null')??fallback;}catch{return fallback;}}
export function saveWorkspace(key:string,value:unknown){localStorage.setItem(workspaceKey(key),JSON.stringify(value));}

export function personalKey(key:string):string {const id=isLabrika?sessionStorage.getItem('labrika-current-account')||'guest':sessionStorage.getItem('ygroup-current-member')||'owner';return isLabrika?`labrika-workspace-${id}-${key.replace(/^ygroup-/, '')}`:(id==='owner'||id==='ygroup-owner')?workspaceKey(key):`ygroup-member-${id}-${key.replace(/^ygroup-/, '')}`;}
