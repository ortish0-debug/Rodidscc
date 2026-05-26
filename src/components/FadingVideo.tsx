import React, { useEffect, useRef } from 'react';

interface FadingVideoProps {
  src: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function FadingVideo({ src, className, style }: FadingVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const fadingOutRef = useRef<boolean>(false);

  const FADE_MS = 500;
  const FADE_OUT_LEAD = 0.55; // seconds

  const fadeTo = (targetOpacity: number, durationMs: number = FADE_MS) => {
    const video = videoRef.current;
    if (!video) return;

    // Cancel existing animation frame before starting a new one
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    const startOpacity = parseFloat(video.style.opacity || '0');
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      
      // Interpolate opacity
      const currentOpacity = startOpacity + (targetOpacity - startOpacity) * progress;
      video.style.opacity = currentOpacity.toFixed(3);

      if (progress < 1) {
        rafIdRef.current = requestAnimationFrame(animate);
      } else {
        rafIdRef.current = null;
      }
    };

    rafIdRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Reset properties on mount or src change
    video.style.opacity = '0';
    fadingOutRef.current = false;

    const handleLoadedData = () => {
      video.style.opacity = '0';
      video.play().catch(err => {
        // Safe catch for browsers blocking autoplay before interaction
        console.warn("Video autoplay blocked or state invalidated:", err);
      });
      fadeTo(1);
    };

    const handleTimeUpdate = () => {
      if (!video.duration || video.duration === Infinity) return;
      const remainingTime = video.duration - video.currentTime;

      if (!fadingOutRef.current && remainingTime <= FADE_OUT_LEAD && remainingTime > 0) {
        fadingOutRef.current = true;
        fadeTo(0);
      }
    };

    const handleEnded = () => {
      video.style.opacity = '0';
      setTimeout(() => {
        if (!videoRef.current) return;
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(err => console.warn(err));
        fadingOutRef.current = false;
        fadeTo(1);
      }, 100);
    };

    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);

    // Initial load/play if state is already ready
    if (video.readyState >= 2) {
      handleLoadedData();
    } else {
      video.load();
    }

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
    };
  }, [src]);

  return (
    <video
      id="fading-video-bg"
      ref={videoRef}
      src={src}
      className={className}
      style={{ opacity: 0, transition: 'none', ...style }}
      muted
      playsInline
      autoPlay
      preload="auto"
    />
  );
}
