import { useEffect, useMemo, useRef, useState } from 'react';
import mascotManifest from '../assets/mascot/labi.json';

type MaskoAnimationAsset = {
  video?: string;
  transparent_video_mov?: string;
  transparent_video_webm?: string;
  transparent_video_android?: string;
  transparent_video_android_720?: string;
  transparent_video_mov_720?: string;
  transparent_video_webm_720?: string;
};

type MaskoItem = {
  name: string;
  animations: MaskoAnimationAsset[];
};

function prefersHevcAlpha() {
  const ua = navigator.userAgent;

  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' &&
      navigator.maxTouchPoints > 1);

  const isSafari =
    /Safari/.test(ua) &&
    /AppleWebKit/.test(ua) &&
    !/(Chrome|Chromium|CriOS|Edg|OPR|FxiOS)/.test(ua);

  return isIOS || isSafari;
}

function chooseSources(asset: MaskoAnimationAsset) {
  const compact = window.matchMedia(
    '(max-width: 900px)'
  ).matches;

  const webm =
    compact && asset.transparent_video_webm_720
      ? asset.transparent_video_webm_720
      : asset.transparent_video_webm;

  const mov =
    compact && asset.transparent_video_mov_720
      ? asset.transparent_video_mov_720
      : asset.transparent_video_mov;

  const sources: string[] = [];

  // Safari / iPhone
  if (prefersHevcAlpha()) {
    if (mov) sources.push(mov);
    if (webm) sources.push(webm);
  } else {
    // Chrome / Firefox / Edge
    if (webm) sources.push(webm);
    if (mov) sources.push(mov);
  }

  // Запасной обычный MP4
  if (asset.video && !sources.includes(asset.video)) {
    sources.push(asset.video);
  }

  return sources;
}

export default function MaskoMascot({
  animation,
  className = '',
}: {
  animation?: string;
  className?: string;
}) {
  const video = useRef<HTMLVideoElement>(null);

  /*
   * Если animation передан — пытаемся найти его.
   * Если нет или такого имени больше нет —
   * автоматически используем первый item из JSON.
   *
   * Благодаря этому для замены маскота достаточно
   * просто заменить assets/mascot/labi.json.
   */
  const items = mascotManifest.items as MaskoItem[];

  const item = animation
    ? items.find(entry => entry.name === animation) ?? items[0]
    : items[0];

  const asset = item?.animations?.[0];

  const sources = useMemo(
    () => (asset ? chooseSources(asset) : []),
    [asset]
  );

  const [sourceIndex, setSourceIndex] = useState(0);

  const [reduced, setReduced] = useState(() =>
    window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches
  );

  const [failed, setFailed] = useState(!asset);

  useEffect(() => {
    const media = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    );

    const sync = () => {
      setReduced(media.matches);
    };

    media.addEventListener('change', sync);

    return () => {
      media.removeEventListener('change', sync);
    };
  }, []);

  useEffect(() => {
    setSourceIndex(0);
    setFailed(!asset);
  }, [animation, asset]);

  useEffect(() => {
    const element = video.current;

    if (!element || failed) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          element.pause();
          return;
        }

        if (reduced) {
          element.pause();
          return;
        }

        void element.play().catch(() => undefined);
      },
      {
        threshold: 0.05,
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [failed, reduced, sourceIndex]);

  if (!asset || failed || !sources[sourceIndex]) {
    return null;
  }

  /*
   * Настройка цикла.
   *
   * START — сколько секунд пропускаем в начале.
   * END   — сколько секунд отрезаем в конце.
   */
  const LOOP_START_TRIM = 1.5;
  const LOOP_END_TRIM = 1.5;

  return (
    <video
      ref={video}
      className={`masko-mascot-video ${className}`.trim()}
      src={sources[sourceIndex]}
      muted
      playsInline
      preload="auto"
      disablePictureInPicture
      aria-hidden="true"
      onLoadedMetadata={event => {
        const element = event.currentTarget;

        if (
          !Number.isFinite(element.duration) ||
          element.duration <= 0
        ) {
          return;
        }

        if (reduced) {
          element.currentTime = Math.max(
            0,
            element.duration - LOOP_END_TRIM
          );

          element.pause();
          return;
        }

        // Сразу пропускаем паузу в начале.
        element.currentTime = Math.min(
          LOOP_START_TRIM,
          Math.max(0, element.duration - LOOP_END_TRIM)
        );

        void element.play().catch(() => undefined);
      }}
      onTimeUpdate={event => {
        if (reduced) {
          return;
        }

        const element = event.currentTarget;

        if (
          !Number.isFinite(element.duration) ||
          element.duration <=
            LOOP_START_TRIM + LOOP_END_TRIM
        ) {
          return;
        }

        /*
         * Не ждём физического окончания файла.
         * Сразу возвращаемся к началу рабочего
         * участка анимации.
         */
        if (
          element.currentTime >=
          element.duration - LOOP_END_TRIM
        ) {
          element.currentTime = LOOP_START_TRIM;

          void element.play().catch(() => undefined);
        }
      }}
      onError={() => {
        /*
         * Если WebM/MOV не сработал,
         * автоматически пробуем следующий формат.
         */
        if (sourceIndex + 1 < sources.length) {
          setSourceIndex(index => index + 1);
        } else {
          setFailed(true);
        }
      }}
    />
  );
}