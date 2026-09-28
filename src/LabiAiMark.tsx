export default function LabiAiMark({size=22,className=''}:{size?:number;className?:string}){
 return <img className={`labi-ai-mark ${className}`.trim()} src="/brand/labi-ai.png" width={size} height={size} alt="" aria-hidden="true"/>;
}
