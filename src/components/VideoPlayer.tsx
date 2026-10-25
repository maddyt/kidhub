'use client';
import { useEffect, useRef, useState } from 'react';

type Hls = import('hls.js').default;

/**
 * Plays one camera. The stream URL comes from /api/video/[id], which re-checks permission each time;
 * the link is refreshed before it expires and playback stops when access ends.
 */
export function VideoPlayer({ cameraId, title }: { cameraId: string; title: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const video = ref.current; if (!video) return;
    let hls: Hls | null = null, timer: ReturnType<typeof setTimeout> | undefined, stopped = false, current = '';

    const stop = (msg: string) => { stopped = true; hls?.destroy(); hls = null; video.removeAttribute('src'); video.load(); setStatus(msg); };

    async function load() {
      if (stopped) return;
      const res = await fetch(`/api/video/${cameraId}`, { cache: 'no-store' }).catch(() => null);
      if (!res) { setStatus('Connection problem. Retrying…'); timer = setTimeout(load, 15000); return; }
      if (res.status === 403) return stop('This camera isn’t available to you right now.');
      if (!res.ok) { setStatus('Video is busy. Retrying…'); timer = setTimeout(load, 30000); return; }
      const { url, expiresIn } = (await res.json()) as { url: string; expiresIn: number };
      setStatus(null);
      if (url !== current) {
        current = url;
        if (video!.canPlayType('application/vnd.apple.mpegurl')) video!.src = url;
        else {
          const { default: H } = await import('hls.js');
          if (!H.isSupported()) return stop('This browser cannot play live video.');
          hls?.destroy();
          // Low-latency settings keep many simultaneous viewers light on bandwidth.
          hls = new H({ lowLatencyMode: true, capLevelToPlayerSize: true });
          hls.on(H.Events.ERROR, (_e, d) => { if (d.fatal) setStatus('The camera is not reachable right now.'); });
          hls.loadSource(url); hls.attachMedia(video!);
        }
      }
      // Re-check permission and renew the link shortly before it expires.
      timer = setTimeout(load, Math.max(30, expiresIn - 90) * 1000);
    }
    load();
    return () => { stopped = true; clearTimeout(timer); hls?.destroy(); };
  }, [cameraId]);

  return (
    <figure className="overflow-hidden rounded-xl border border-rule bg-black">
      <video ref={ref} controls muted autoPlay playsInline disablePictureInPicture controlsList="nodownload noremoteplayback"
        className="aspect-video w-full" aria-label={title} />
      <figcaption className="flex justify-between gap-2 bg-white px-3 py-2 text-sm"><span className="font-medium">{title}</span>{status && <span className="text-danger">{status}</span>}</figcaption>
    </figure>
  );
}
