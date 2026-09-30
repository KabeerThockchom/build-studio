import { Play, ExternalLink } from "lucide-react";

/* A "watch while you wait" YouTube card for the loading screens. Presented as a
   tidy card so it feels intentional, not bolted on. Uses the privacy-friendly
   nocookie domain and plays inline (YouTube's own play button). Always pairs the
   iframe with an "open on YouTube" link so that if the host's content-security-
   policy blocks the frame, the video is still one click away. `short` renders a
   vertical (9:16) frame for YouTube Shorts; otherwise a standard 16:9. */

interface Props {
  id: string;        // YouTube video id
  title: string;     // human label
  sub?: string;      // one-line description under the title
  short?: boolean;   // vertical Shorts aspect
  eyebrow?: string;  // small line above (default "Watch while you wait")
}

export function VideoEmbed({ id, title, sub, short, eyebrow = "Watch while you wait" }: Props) {
  const src = `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`;
  return (
    <div className={`overflow-hidden rounded-2xl border border-line bg-white shadow-[0_2px_14px_rgba(20,32,41,0.05)] ${short ? "mx-auto w-full max-w-[320px]" : ""}`}>
      <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-green-soft text-green">
          <Play className="h-4 w-4 fill-current" />
        </span>
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-green-ink">{eyebrow}</div>
          <div className="truncate text-[14px] font-bold text-navy">{title}</div>
        </div>
      </div>
      <div className="p-3">
        <div className="relative w-full overflow-hidden rounded-xl bg-black"
          style={{ aspectRatio: short ? "9 / 16" : "16 / 9" }}>
          <iframe
            className="absolute inset-0 h-full w-full"
            style={{ border: 0 }}
            src={src}
            title={title}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-3 px-0.5">
          {sub ? <p className="text-[12px] leading-snug text-navy-3">{sub}</p> : <span />}
          <a href={`https://youtu.be/${id}`} target="_blank" rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 text-[12px] font-semibold text-navy-3 hover:text-green-ink">
            <ExternalLink className="h-3.5 w-3.5" /> YouTube
          </a>
        </div>
      </div>
    </div>
  );
}
