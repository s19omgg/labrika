import {createRoot} from 'react-dom/client';
import CookieBanner from '../src/CookieBanner';
import {hydrateServiceLinks} from '../src/service-urls';
import './refinements.css';
import './platform-mockups.css';
import {HeroMascot,FeatureArt,Walkthrough,AIChat,Pricing,Peek} from './Sections';
import {initLandingMotion} from './motion';

hydrateServiceLinks();
const cookieRoot=document.createElement('div');document.body.append(cookieRoot);createRoot(cookieRoot).render(<CookieBanner/>);
createRoot(document.getElementById('hero-character')!).render(<HeroMascot/>);
document.querySelectorAll<HTMLElement>('[data-feature-art]').forEach(host=>{
 const type=host.dataset.featureArt as 'brain'|'studio'|'calendar'|'analytics';
 createRoot(host).render(<FeatureArt type={type}/>);
});
createRoot(document.getElementById('walkthrough-root')!).render(<Walkthrough/>);
createRoot(document.getElementById('ai-chat-root')!).render(<AIChat/>);
createRoot(document.getElementById('pricing-root')!).render(<Pricing/>);
createRoot(document.getElementById('cta-peek-root')!).render(<Peek/>);
requestAnimationFrame(()=>initLandingMotion());
