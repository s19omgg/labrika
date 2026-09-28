import { useEffect, useMemo, useRef, useState } from 'react';
import mascotManifest from '../assets/mascot/labi.json';

type MaskoAnimationAsset = {
  transparent_video_mov: string;
  video: string;
  transparent_video_webm: string;
  transparent_video_android_720?: string;
  transparent_video_mov_720?: string;
  transparent_video_webm_720?: string;
  transparent_video_android?: string;
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

  return prefersHevcAlpha()
    ? [mov, webm]
    : [webm, mov];
}

export default function MaskoMascot({
  animation,
  className = '',
}: {
  animation: string;
  className?: string;
}) {
  const video = useRef<HTMLVideoElement>(null);

  const item = (
    mascotManifest.items as MaskoItem[]
  ).find(entry => entry.name === animation);

  const asset = item?.animations[0];

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

        void element
          .play()
          .catch(() => undefined);
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
   * Настройка бесшовного цикла.
   *
   * START — сколько секунд пропускаем в начале.
   * END   — сколько секунд не проигрываем в конце.
   *
   * Можно подбирать независимо:
   *
   * 0.40
   * 0.45
   * 0.50
   * 0.55
   * и т.д.
   */
  const LOOP_START_TRIM = 0.5;
  const LOOP_END_TRIM = 0.6;

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

        /*
         * Если у пользователя включено
         * "уменьшение движения",
         * показываем почти финальный кадр
         * и не запускаем анимацию.
         */
        if (reduced) {
          element.currentTime = Math.max(
            0,
            element.duration - LOOP_END_TRIM
          );

          element.pause();
          return;
        }

        /*
         * При первом запуске сразу
         * пропускаем статичную часть в начале.
         */
        element.currentTime = LOOP_START_TRIM;

        void element
          .play()
          .catch(() => undefined);
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
         * Не ждём физического конца видео.
         * Как только дошли до точки перед
         * финальной паузой — возвращаемся
         * сразу к рабочему началу анимации.
         */
        if (
          element.currentTime >=
          element.duration - LOOP_END_TRIM
        ) {
          element.currentTime = LOOP_START_TRIM;

          void element
            .play()
            .catch(() => undefined);
        }
      }}

      onError={() => {
        /*
         * Если основной формат не загрузился,
         * пробуем второй.
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