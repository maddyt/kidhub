'use client';
import { useEffect, useRef, useState } from 'react';

/** Plays an HLS (.m3u8) stream: natively on Safari/iOS, via hls.js elsewhere. */
export function VideoPlayer({ src, title }: { src: string; title: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const video = ref.current; if (!video) return;
    let destroy = () => {};
    if (video.canPlayType('application/vnd.apple.mpegurl')) { video.src = src; }
    else {
      import('hls.js').then(({ default: Hls }) => {
        if (!Hls.isSupported()) { setError('This browser cannot play live video.'); return; }
        // Low-latency settings keep many simultaneous viewers light on bandwidth.
        const hls = new Hls({ lowLatencyMode: true, capLevelToPlayerSize: true });
        hls.on(Hls.Events.ERROR, (_e, d) => { if (d.fatal) setError('The camera is not reachable right now.'); });
        hls.loadSource(src); hls.attachMedia(video);
        destroy = () => hls.destroy();
      });
    }
    return () => destroy();
  }, [src]);
  return (
    <figure className="overflow-hidden rounded-xl border border-rule bg-black">
      <video ref={ref} controls muted autoPlay playsInline className="aspect-video w-full" aria-label={title} />
      <figcaption className="flex justify-between bg-white px-3 py-2 text-sm"><span className="font-medium">{title}</span>{error && <span className="text-danger">{error}</span>}</figcaption>
    </figure>
  );
}
