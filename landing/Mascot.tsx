import {useId} from 'react';

// The six articulated layers all sample the user's original photograph.
// Paths follow the front view's silhouette; no generated character is involved.
const parts={
 body:'M112 432 Q176 415 233 437 Q252 473 254 539 L268 607 Q249 648 175 651 Q101 644 82 608 L100 529Z',
 leftLeg:'M89 590 Q116 602 170 623 L174 650 Q168 680 158 686 Q161 715 142 732 L132 737 L132 750 Q124 757 80 755 Q67 755 68 748 Q68 735 79 726 Q55 704 58 679 Q57 656 67 644 Q63 615 71 608Z',
 rightLeg:'M177 623 Q224 603 257 595 Q282 623 280 648 Q291 676 286 700 Q286 722 269 734 Q276 741 277 751 Q277 758 249 756 L221 754 Q211 752 212 735 Q190 726 186 702 Q185 678 177 658Z',
 leftArm:'M115 441 Q89 444 73 469 Q67 479 66 497 Q39 519 37 548 Q34 568 47 582 L48 595 Q49 609 61 611 Q72 612 77 598 L82 580 Q99 572 103 543 L112 511 Q125 470 115 441Z',
 rightArm:'M236 442 Q266 448 279 480 L284 502 Q306 523 313 554 Q315 572 305 582 L301 597 Q299 611 286 610 Q275 610 273 592 Q254 579 254 557 L245 518Z',
 head:'M21 209 Q17 202 33 207 Q79 211 111 234 Q112 216 144 211 Q157 188 182 198 Q194 199 205 207 Q230 201 248 222 Q275 198 321 181 Q330 178 326 196 L324 205 Q337 213 329 228 L320 232 Q314 264 288 292 Q308 297 302 320 Q315 340 302 365 Q297 376 285 379 Q288 401 258 418 Q254 436 232 441 Q212 456 177 452 Q141 458 119 444 Q98 442 96 422 Q69 418 69 395 Q46 384 48 359 Q46 341 59 322 Q54 302 65 290 Q44 288 47 272 Q49 258 56 258 Q43 238 21 209Z',
};

export default function Mascot({peek=false}:{peek?:boolean}){
 const id=useId().replace(/:/g,'');
 return <svg className={`mascot-rig${peek?' mascot-rig-peek':''}`} viewBox="-20 135 390 665" aria-hidden="true" focusable="false">
  <defs>{Object.entries(parts).map(([name,path])=><clipPath id={`${id}-${name}`} key={name}><path d={path}/></clipPath>)}</defs>
  <g className="mascot-bounce">
   {(['leftLeg','rightLeg','body','leftArm','rightArm','head'] as const).map(name=><g key={name} className={`mascot-part mascot-${name}`}><g clipPath={`url(#${id}-${name})`}><image href={`${import.meta.env.BASE_URL}landing-assets/mascot-cutout.png`} x="0" y="0" width="1280" height="960"/></g></g>)}
  </g>
 </svg>;
}
