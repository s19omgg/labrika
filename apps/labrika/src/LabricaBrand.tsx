export default function LabricaBrand({ className = '', light = false, company = '' }: { className?: string; light?: boolean; company?:string }) {
  const wordmark=<img className="labrica-wordmark" src="/brand/labrica-wordmark.svg" width="126" height="29" alt="LABRICA" />;
  return <span className={`labrica-brand ${light ? 'labrica-brand-light' : ''} ${company?'labrica-brand-company':''} ${className}`}>
    <img className="labrica-symbol" src="/brand/labrica-symbol.svg" width="40" height="40" alt="" />
    {company?<span className="labrica-brand-text">{wordmark}<span className="workspace-company"><span className="workspace-company-cross" aria-hidden="true">×</span><span className="workspace-company-name">{company}</span></span></span>:wordmark}
  </span>;
}
