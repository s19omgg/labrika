import { AtSign, Bookmark, Check, ChevronDown, Eye, Forward, Heart, MessageCircle, MoreHorizontal, Play, Repeat2, Send, Share2, ThumbsUp, Youtube } from 'lucide-react';
import type { Platform } from './model';
import { formatNumber, platformMeta } from './model';
import './social-preview.css';

export type SocialVisual = string | {kind: 'image' | 'video'; url: string; format?: string};
export interface SocialPreviewProps {
  platform: Platform;
  body: string;
  title?: string;
  visual?: SocialVisual;
  brandName?: string;
  views?: number;
}

function PostText({body}: {body: string}) {
  if (!body.trim()) return <p className="social-text social-text-empty">Текст публикации</p>;
  return <p className="social-text">{body.split(/(\*\*[^*]+\*\*)/g).map((part, index) => part.startsWith('**') && part.endsWith('**') ? <strong key={index}>{part.slice(2, -2)}</strong> : <span key={index}>{part}</span>)}</p>;
}
function BrandAvatar({name, ring = false}: {name: string; ring?: boolean}) {return <span className={`social-brand-avatar ${ring ? 'has-ring' : ''}`} aria-hidden="true"><span>{name.slice(0, 1).toUpperCase()}</span></span>;}
function PostVisual({visual, title, brand, fallback = false, video = false}: {visual?: SocialVisual; title: string; brand: string; fallback?: boolean; video?: boolean}) {
  const url = typeof visual === 'string' ? visual : visual?.url;
  const isVideo = typeof visual === 'object' ? visual.kind === 'video' : !!url && (/^data:video\//.test(url) || /\.(mp4|webm)(?:[?#]|$)/i.test(url));
  if (url) return <div className={`social-media ${isVideo ? 'is-video' : ''}`}>{isVideo ? <video src={url} controls playsInline preload="metadata" aria-label={title || 'Видео публикации'}/> : <img src={url} alt={title || 'Изображение публикации'}/>}</div>;
  if (!fallback) return null;
  return <div className={`social-fallback-art ${video ? 'is-video-cover' : ''}`} role="img" aria-label={`Обложка: ${title || brand}`}><span className="social-art-top">{brand}<span>STUDIO / 01</span></span><strong>{title || 'Большие идеи.\nИзмеримый рост.'}</strong><span className="social-art-orbit"/><span className="social-art-bottom">Идеи, которые становятся результатом.<span>↗</span></span>{video && <span className="social-video-play" aria-hidden="true"><Play size={26} fill="currentColor"/></span>}</div>;
}
function Author({brand, ring = false, subtitle}: {brand: string; ring?: boolean; subtitle?: string}) {return <div className="social-author"><BrandAvatar name={brand} ring={ring}/><div><strong>{brand}</strong>{subtitle && <small>{subtitle}</small>}</div><MoreHorizontal size={20} aria-hidden="true"/></div>;}
function ViewCount({views}: {views?: number}) {return views !== undefined ? <span className="social-view-count"><Eye size={13}/>{formatNumber(views)}</span> : null;}

export default function SocialPreview({platform, body, title = '', visual, brandName = 'YGROUP', views}: SocialPreviewProps) {
  const username = brandName.toLowerCase().replace(/[^\p{L}\p{N}_.]/gu, '_');
  const shellProps = {className: `social-preview social-${platform}`, 'aria-label': `Предпросмотр ${platformMeta[platform].name}`};

  if (platform === 'telegram' || platform === 'max') return <article {...shellProps}>
    <div className="social-tg-channel"><BrandAvatar name={brandName}/><div><strong>{brandName}</strong><small>Канал</small></div><ChevronDown size={16} aria-hidden="true"/></div>
    <div className="social-tg-chat"><div className="social-tg-bubble"><span className="social-tg-sender">{brandName}</span><PostVisual visual={visual} title={title} brand={brandName}/><PostText body={body}/><div className="social-tg-bottom"><ViewCount views={views}/><Check size={12} aria-hidden="true"/></div></div><span className="social-tg-forward" aria-hidden="true"><Forward size={17}/></span></div>
  </article>;

  if (platform === 'instagram') return <article {...shellProps}>
    <Author brand={username} ring/>
    <PostVisual visual={visual} title={title} brand={brandName} fallback/>
    <div className="social-ig-actions" aria-hidden="true"><Heart size={23}/><MessageCircle size={23}/><Send size={22}/><Bookmark size={22}/></div>
    <div className="social-ig-caption"><strong>{username}</strong><PostText body={body}/></div>
    {views !== undefined && <div className="social-ig-views">{formatNumber(views)} просмотров</div>}
  </article>;

  if (platform === 'threads') return <article {...shellProps}>
    <div className="social-threads-top"><AtSign size={23}/><span>Для вас</span><ChevronDown size={14}/></div>
    <div className="social-thread"><BrandAvatar name={brandName}/><div className="social-thread-main"><div className="social-thread-author"><strong>{username}</strong><span>•</span><MoreHorizontal size={19} aria-hidden="true"/></div><PostText body={body}/><PostVisual visual={visual} title={title} brand={brandName}/><div className="social-thread-actions" aria-hidden="true"><Heart size={20}/><MessageCircle size={20}/><Repeat2 size={21}/><Send size={20}/></div>{views !== undefined && <small className="social-thread-views">{formatNumber(views)} просмотров</small>}</div></div>
  </article>;

  if (platform === 'dzen') return <article {...shellProps}>
    <Author brand={brandName} subtitle="Авторский канал"/>
    <h2 className="social-dzen-title">{title || body.split('\n')[0] || 'Название публикации'}</h2>
    <PostVisual visual={visual} title={title} brand={brandName}/>
    <PostText body={body.startsWith(title + '\n') && title ? body.slice(title.length).trimStart() : body}/>
    <div className="social-dzen-bottom"><span aria-hidden="true"><ThumbsUp size={20}/><MessageCircle size={20}/><Share2 size={19}/></span><ViewCount views={views}/></div>
  </article>;

  if (platform === 'tiktok') return <article {...shellProps}><div className="social-tiktok-top">TikTok<span>Для вас</span></div><div className="social-tiktok-video">{visual?<PostVisual visual={visual} title={title} brand={brandName}/>:<div className="social-tiktok-empty"><Play size={36}/></div>}<div className="social-tiktok-caption"><strong>@{brandName.toLowerCase().replace(/\s+/g,'_')}</strong><PostText body={body}/></div><div className="social-tiktok-actions"><Heart size={24}/><MessageCircle size={24}/><Bookmark size={22}/><Share2 size={23}/></div></div></article>;
  if (platform === 'youtube') return <article {...shellProps}>
    <div className="social-youtube-top"><Youtube size={25} fill="#ff0033" color="#ff0033"/><strong>YouTube</strong></div>
    <PostVisual visual={visual} title={title} brand={brandName} fallback video/>
    <div className="social-youtube-content"><h2>{title || 'Название видео'}</h2><div className="social-youtube-meta">{views !== undefined ? `${formatNumber(views)} просмотров` : 'Предпросмотр видео'}</div><Author brand={brandName}/><div className="social-youtube-actions" aria-hidden="true"><span><ThumbsUp size={16}/></span><span><Share2 size={16}/></span><span><Bookmark size={16}/></span></div><div className="social-youtube-description"><PostText body={body}/></div></div>
  </article>;

  return <article {...shellProps}>
    <Author brand={brandName} subtitle="Публикация сообщества"/>
    <div className="social-vk-body"><PostText body={body}/></div>
    <PostVisual visual={visual} title={title} brand={brandName}/>
    <div className="social-vk-actions"><span aria-hidden="true"><Heart size={21}/><MessageCircle size={21}/><Share2 size={20}/></span><ViewCount views={views}/></div>
  </article>;
}
