import { forwardRef } from 'react';
import type { VoiceStatus } from '../../hooks/useVoiceConversation';

/**
 * The AI, as a single living sphere.
 *
 * The whole screen is this thing and three buttons, so it carries the entire state of
 * the conversation on its own: whether it is listening, thinking or talking, and how
 * loudly the room is speaking into it. No icon, no spinner and no waveform — those
 * would each say one part of what the sphere already says all of.
 *
 * The ref goes on the outer element because the caller writes `--level` to it on every
 * animation frame, straight from the microphone analyser, without re-rendering.
 */
const AiOrb = forwardRef<HTMLDivElement, { status: VoiceStatus }>(function AiOrb(
  { status },
  ref
) {
  return (
    <div ref={ref} className={`orb orb--${status}`}>
      <div className="orb__sphere">
        <span className="orb__blob orb__blob--1" />
        <span className="orb__blob orb__blob--2" />
        <span className="orb__blob orb__blob--3" />
        <span className="orb__sheen" />
      </div>

      <style>{`
  /* ── Orb ──
     The edge stays crisp: the blobs are blurred, not the sphere, and
     overflow plus a mask keeps their haze inside the circle on both
     engines. */
  .orb {
    position: relative; flex-shrink: 0;
    width: min(62vw, 232px); aspect-ratio: 1;
    /* --level is written straight from the microphone analyser on every
       animation frame, so the sphere swells as the room gets louder. */
    transform: scale(calc(1 + var(--level, 0) * 0.09));
    transition: transform 110ms linear;
  }
  .orb__sphere {
    position: absolute; inset: 0;
    border-radius: 50%; overflow: hidden; isolation: isolate;
    background:
      radial-gradient(circle at 32% 72%, #FFFFFF 0%, #E8F3FF 26%, transparent 62%),
      linear-gradient(150deg, #7FA8FF 0%, #4E7FE8 42%, #2E5BD0 100%);
    -webkit-mask-image: radial-gradient(circle at center, #000 99%, transparent 100%);
            mask-image: radial-gradient(circle at center, #000 99%, transparent 100%);
    box-shadow: 0 24px 80px rgba(78, 127, 232, 0.30);
    animation: orbBreathe 7s ease-in-out infinite;
  }
  @keyframes orbBreathe {
    0%, 100% { transform: scale(1); }
    50%      { transform: scale(1.035); }
  }

  .orb__blob {
    position: absolute; border-radius: 50%;
    filter: blur(26px); will-change: transform;
  }
  .orb__blob--1 {
    width: 78%; height: 78%; top: -14%; right: -10%;
    background: radial-gradient(circle, rgba(124, 158, 255, 0.95) 0%, rgba(124, 158, 255, 0) 68%);
    animation: orbDrift1 11s ease-in-out infinite;
  }
  .orb__blob--2 {
    width: 70%; height: 70%; bottom: -8%; left: -12%;
    background: radial-gradient(circle, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0) 66%);
    animation: orbDrift2 9s ease-in-out infinite;
  }
  .orb__blob--3 {
    width: 54%; height: 54%; top: 30%; left: 26%;
    background: radial-gradient(circle, rgba(0, 198, 255, 0.34) 0%, rgba(0, 198, 255, 0) 70%);
    animation: orbDrift3 13s ease-in-out infinite;
  }
  @keyframes orbDrift1 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50%      { transform: translate(-14%, 12%) scale(1.14); }
  }
  @keyframes orbDrift2 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50%      { transform: translate(16%, -14%) scale(0.9); }
  }
  @keyframes orbDrift3 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    33%      { transform: translate(12%, -10%) scale(1.2); }
    66%      { transform: translate(-10%, 8%) scale(0.88); }
  }

  /* A single highlight across the top, which is what reads as "sphere"
     rather than "flat disc". */
  .orb__sheen {
    position: absolute; inset: 0;
    background: radial-gradient(ellipse 70% 46% at 46% 14%, rgba(255,255,255,0.42) 0%, transparent 70%);
  }

  /* States. The orb never stops moving entirely — a frozen sphere reads as
     a crash — but each state moves differently enough to be told apart. */
  .orb--listening .orb__sphere { animation-duration: 4.5s; }
  .orb--speaking .orb__sphere  { animation-duration: 1.9s; }
  .orb--speaking .orb__blob--1 { animation-duration: 4s; }
  .orb--speaking .orb__blob--2 { animation-duration: 3.2s; }
  .orb--speaking .orb__blob--3 { animation-duration: 4.6s; }
  .orb--thinking .orb__sphere  { animation-duration: 2.6s; opacity: 0.72; }
  .orb--connecting .orb__sphere { opacity: 0.6; }
  .orb--muted .orb__sphere,
  .orb--error .orb__sphere {
    background: linear-gradient(150deg, #2A3446 0%, #1A2232 100%);
    box-shadow: none;
  }
  .orb--muted .orb__blob,
  .orb--error .orb__blob,
  .orb--muted .orb__sheen,
  .orb--error .orb__sheen { opacity: 0.12; }

  @media (prefers-reduced-motion: reduce) {
    .orb__sphere, .orb__blob { animation: none; }
  }
      `}</style>
    </div>
  );
});

export default AiOrb;
