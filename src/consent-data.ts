export type ConsentType='terms'|'personal_data'|'marketing'|'cookies';
export interface ConsentRecord{userId:string;consentType:ConsentType;documentVersion:string;acceptedAt:string;source:'registration'|'cookie_banner';status:'accepted';}
const KEY='labrica-consents-v1';

export function recordRegistrationConsents(userId:string,marketing:boolean){
 const acceptedAt=new Date().toISOString();
 const records:ConsentRecord[]=[
  {userId,consentType:'terms',documentVersion:'28.09.2026',acceptedAt,source:'registration',status:'accepted'},
  {userId,consentType:'personal_data',documentVersion:'28.09.2026',acceptedAt,source:'registration',status:'accepted'},
  ...(marketing?[{userId,consentType:'marketing' as const,documentVersion:'28.09.2026',acceptedAt,source:'registration' as const,status:'accepted' as const}]:[]),
 ];
 try{const previous=JSON.parse(localStorage.getItem(KEY)||'[]');localStorage.setItem(KEY,JSON.stringify([...(Array.isArray(previous)?previous:[]),...records]));}catch{/* Registration must not fail solely because consent history storage is full. */}
}
