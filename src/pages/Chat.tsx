import { useState, useEffect, useRef, useCallback } from 'react';
import { LiveKitRoom, RoomAudioRenderer, useRoomContext, useTracks, VideoTrack, useRemoteParticipants, useSpeakingParticipants } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { endSession } from '../api/endpoints';
import { useSocket } from '../hooks/useSocket';
import useAppStore from '../store/useAppStore';
import CallControls from '../components/CallControls';
import ChatOverlay from '../components/ChatOverlay';
import EndSessionSheet from '../components/EndSessionSheet';
import Avatar from '../components/Avatar';
import SpeakingQuestions from '../components/SpeakingQuestions';
import { useT } from '../i18n';
import { notifyHaptic, tapHaptic } from '../utils/haptics';
import { AlertCircle, AlertTriangle, X, Lightbulb, ChevronRight, ArrowLeft } from 'lucide-react';

function fmt(s: number): string {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function MediaController({ micOn, camOn }: { micOn: boolean; camOn: boolean }) {
  const room = useRoomContext();
  useEffect(() => { room?.localParticipant?.setMicrophoneEnabled(micOn); }, [micOn, room]);
  useEffect(() => { room?.localParticipant?.setCameraEnabled(camOn); }, [camOn, room]);
  return null;
}

// ── Drag hook for PiP window ───────────────────────────────────────────────
function useDrag(initialPos: { x: number; y: number }, onClick?: () => void) {
  const [pos, setPos] = useState(initialPos);
  const dragging = useRef(false);
  const moved = useRef(false);
  const startRef = useRef({ x: 0, y: 0, px: 0, py: 0 });

  function onPointerDown(e: React.PointerEvent) {
    dragging.current = true;
    moved.current = false;
    startRef.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.stopPropagation();
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;

    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      moved.current = true;
    }

    const newX = startRef.current.px + dx;
    const newY = startRef.current.py + dy;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pipW = 110;
    const pipH = 160;

    const clampedX = Math.max(-(vw - pipW - 12), Math.min(newX, -12));
    const clampedY = Math.max(-(vh - pipH - 12), Math.min(newY, -12));

    setPos({ x: clampedX, y: clampedY });
  }

  function onPointerUp() {
    dragging.current = false;
    if (!moved.current && onClick) {
      onClick();
    }
  }

  return { pos, onPointerDown, onPointerMove, onPointerUp };
}

function VideoGrid({ session }: { session: any }) {
  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }],
    { onlySubscribed: false }
  );
  const speakingIds = new Set(useSpeakingParticipants().map(p => p.identity));

  const localTrack  = tracks.find(t => t.participant?.isLocal);
  const remoteTrack = tracks.find(t => t.participant && !t.participant.isLocal);
  const hasLocal    = !!localTrack?.publication?.track;
  const hasRemote   = !!remoteTrack?.publication?.track;

  const [swapped, setSwapped] = useState(false);

  const pip = useDrag({ x: -14, y: -130 }, () => setSwapped(v => !v));

  if (!hasLocal && !hasRemote) return null;

  const mainTrack   = swapped ? localTrack  : remoteTrack;
  const mainName    = swapped ? 'You'        : (session?.partnerName || 'Partner');
  const mainHas     = swapped ? hasLocal     : hasRemote;
  const mainLetter  = swapped ? 'You'        : (session?.partnerName?.[0]?.toUpperCase() || '?');

  const pipTrack    = swapped ? remoteTrack  : localTrack;
  const pipName     = swapped ? (session?.partnerName || 'Partner') : 'You';
  const pipHas      = swapped ? hasRemote    : hasLocal;
  const pipLetter   = swapped ? (session?.partnerName?.[0]?.toUpperCase() || '?') : 'You';

  const mainMirror = swapped;
  const pipMirror  = !swapped;

  const mainSpeaking = mainTrack?.participant ? speakingIds.has(mainTrack.participant.identity) : false;
  const pipSpeaking  = pipTrack?.participant  ? speakingIds.has(pipTrack.participant.identity)  : false;

  return (
    <div className="video-grid">
      <div className={`video-main${mainSpeaking ? ' video-main--speaking' : ''}`}>
        {mainHas && mainTrack
          ? <VideoTrack trackRef={mainTrack as any} style={mainMirror ? { transform: 'scaleX(-1)' } : {}} />
          : <div className="video-avatar"><span>{mainLetter}</span></div>
        }
        <div className="video-scrim" />
        <span className="video-label">
          {mainSpeaking && <span className="video-label__dot" />}
          {mainName}
        </span>
      </div>

      <div
        className={`video-pip${pipSpeaking ? ' video-pip--speaking' : ''}`}
        style={{
          right: Math.max(12, -pip.pos.x),
          bottom: Math.max(12, -pip.pos.y),
          touchAction: 'none',
        }}
        onPointerDown={pip.onPointerDown}
        onPointerMove={pip.onPointerMove}
        onPointerUp={pip.onPointerUp}
      >
        {pipHas && pipTrack
          ? <VideoTrack trackRef={pipTrack as any} style={pipMirror ? { transform: 'scaleX(-1)' } : {}} />
          : <div className="video-avatar video-avatar--pip"><span>{pipLetter}</span></div>
        }
        <span className="video-label video-label--pip">{pipName}</span>
        <div className="video-pip__swap" aria-hidden="true">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3 4 7l4 4" /><path d="M4 7h16" />
            <path d="m16 21 4-4-4-4" /><path d="M20 17H4" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function friendlyError(msg: string | null, t: any): string {
  if (!msg) return t('call.err.generic');
  const m = msg.toLowerCase();
  if (m.includes('webrtc') || m.includes('not supported'))
    return t('call.err.webrtc');
  if (m.includes('permission') || m.includes('notallowed'))
    return t('call.err.permission');
  if (m.includes('network') || m.includes('ice') || m.includes('connection'))
    return t('call.err.network');
  return t('call.err.generic');
}

function ConnectionWatcher() {
  const participants = useRemoteParticipants();
  const setPartnerConnected = useAppStore((s) => s.setPartnerConnected);
  const hasRemote = participants.length > 0;

  useEffect(() => {
    if (hasRemote) {
      setPartnerConnected(true);
    }
  }, [hasRemote, setPartnerConnected]);

  return null;
}

function SpeakingWatcher({ onChange }: { onChange: (you: boolean, partner: boolean) => void }) {
  const speaking = useSpeakingParticipants();
  const youSpeaking = speaking.some((p) => p.isLocal);
  const partnerSpeaking = speaking.some((p) => !p.isLocal);

  useEffect(() => {
    onChange(youSpeaking, partnerSpeaking);
  }, [youSpeaking, partnerSpeaking, onChange]);

  return null;
}

export default function Chat() {
  const {
    session, messages, isPartnerTyping,
    isCallActive, navigate, setCallActive,
    livekitToken, livekitUrl,
    clearSession, setMatchingStatus,
    partnerConnected, setPartnerConnected,
    user, updateUser, addMessage,
    speakingTopicId,
  } = useAppStore();
  const { joinSession, sendMessage, sendTyping } = useSocket();
  const t = useT();

  const [elapsed, setElapsed]       = useState(0);
  const [showChat, setShowChat]     = useState(false);
  const [showEnd, setShowEnd]       = useState(false);
  const [showTopics, setShowTopics] = useState(false);
  const [ending, setEnding]         = useState(false);
  const [micOn, setMicOn]           = useState(true);
  const [camOn, setCamOn]           = useState(false);
  const [speakingDetail, setSpeakingDetail] = useState(false);
  const [liveKitError, setLiveKitError] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [lastSeenCount, setLastSeenCount] = useState(0);
  const [connectionTimeout, setConnectionTimeout] = useState(false);
  const [youSpeaking, setYouSpeaking] = useState(false);
  const [partnerSpeaking, setPartnerSpeaking] = useState(false);

  const showTopicsRef = useRef(false);
  showTopicsRef.current = showTopics;
  const showChatRef = useRef(false);
  showChatRef.current = showChat;

  const handleSpeaking = useCallback((you: boolean, partner: boolean) => {
    setYouSpeaking(you);
    setPartnerSpeaking(partner);
  }, []);

  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (session?.id) joinSession(session.id);
    const backBtn = window.Telegram?.WebApp?.BackButton;
    const onBack = () => {
      if (showTopicsRef.current) {
        setShowTopics(false);
      } else if (showChatRef.current) {
        setShowChat(false);
      } else {
        setShowEnd(true);
      }
    };
    if (backBtn) {
      backBtn.show();
      backBtn.onClick(onBack);
    }
    timerRef.current = setInterval(() => setElapsed((prev) => prev + 1), 1000);

    const timeoutId = setTimeout(() => {
      if (!useAppStore.getState().partnerConnected) {
        setConnectionTimeout(true);
      }
    }, 25000);

    return () => {
      clearInterval(timerRef.current);
      clearTimeout(timeoutId);
      if (backBtn) {
        backBtn.offClick(onBack);
        backBtn.hide();
      }
    };
  }, []);

  async function handleRetryConnection() {
    if (session?.id) {
      try { await endSession(session.id); } catch {}
    }
    clearSession();
    setMatchingStatus('idle');
    navigate('matching');
  }

  async function handleGoHome() {
    if (session?.id) {
      try { await endSession(session.id); } catch {}
    }
    clearSession();
    setMatchingStatus('idle');
    navigate('home');
  }

  async function handleEnd() {
    if (ending) return;
    setEnding(true);

    if (session?.id) {
      try { await endSession(session.id); } catch {}
    }
    navigate('session_end', { sessionId: session?.id, elapsed });
  }

  const unread = showChat ? 0 : Math.max(0, messages.length - lastSeenCount);
  useEffect(() => {
    if (showChat) setLastSeenCount(messages.length);
  }, [showChat, messages.length]);

  useEffect(() => {
    if (partnerConnected) notifyHaptic('success');
  }, [partnerConnected]);

  if (connectionTimeout) {
    return (
      <div className="timeout-screen scale-in">
        <span className="chat-glyph"><AlertCircle size={30} /></span>
        <div className="timeout-info">
          <h2>{t('call.timeoutTitle')}</h2>
          <p>{t('call.timeoutDesc')}</p>
        </div>
        <div className="timeout-actions">
          <button className="btn-primary" onClick={handleRetryConnection}>{t('common.tryAgain')}</button>
          <button className="btn-secondary" onClick={handleGoHome}>{t('common.goHome')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="call-screen">

      {/* LiveKit room for real human calls */}
      {isCallActive && livekitToken && livekitUrl && (
        <LiveKitRoom
          {...({
            token: livekitToken,
            serverUrl: livekitUrl,
            connect: true,
            audio: true,
            video: camOn,
            onConnected: () => { setLiveKitError(null); setIsReconnecting(false); },
            onDisconnected: () => setCallActive(false),
            onReconnecting: () => setIsReconnecting(true),
            onReconnected: () => setIsReconnecting(false),
            onError: (err: Error) => {
              console.error('LiveKit error:', err);
              setLiveKitError(err?.message || 'Connection failed');
            },
            style: { position: 'absolute', inset: 0, zIndex: 0 }
          } as any)}
        >
          <RoomAudioRenderer />
          <MediaController micOn={micOn} camOn={camOn} />
          <ConnectionWatcher />
          <SpeakingWatcher onChange={handleSpeaking} />
          {camOn && <VideoGrid session={session} />}
        </LiveKitRoom>
      )}

      {/* Reconnecting banner */}
      {isReconnecting && (
        <div className="reconnecting-banner fade-down">
          <span>{t('call.reconnecting')}</span>
        </div>
      )}

      {/* Gradient bg */}
      {!camOn && <div className="call-bg-glow" />}

      {/* LiveKit error banner */}
      {liveKitError && (
        <div className="call-error-banner">
          <span><AlertTriangle size={14} /> {friendlyError(liveKitError, t)}</span>
          <button onClick={() => setLiveKitError(null)} aria-label="Close"><X size={15} /></button>
        </div>
      )}

      {/* Camera timer overlay */}
      {camOn && (
        <div className="call-cam-timer">
          <span
            className="call-dot"
            style={{
              background: partnerConnected ? 'var(--success)' : 'var(--warning)',
              boxShadow: partnerConnected ? '0 0 6px var(--success)' : '0 0 6px var(--warning)',
            }}
          />
          <span>{partnerConnected ? fmt(elapsed) : t('call.waiting')}</span>
        </div>
      )}

      {/* ── Audio Mode: Clean Voice Call Screen or Topics View ── */}
      {!camOn && (
        <>
          {showTopics ? (
            <div className="call-topics-pane">
              <div className="call-topics-header">
                <button
                  type="button"
                  className="call-topics-back-btn"
                  onClick={() => {
                    tapHaptic('light');
                    setShowTopics(false);
                  }}
                >
                  <ArrowLeft size={18} />
                  <span>{t('call.backToCall') || 'Back to Voice Call'}</span>
                </button>
                <div className="call-topics-timer">
                  <span
                    className="call-dot"
                    style={{
                      background: partnerConnected ? 'var(--success)' : 'var(--warning)',
                      boxShadow: partnerConnected ? '0 0 8px var(--success)' : '0 0 8px var(--warning)',
                    }}
                  />
                  <span>{partnerConnected ? fmt(elapsed) : t('call.waiting')}</span>
                </div>
              </div>

              <div className="call-topics-body">
                <SpeakingQuestions onDetailChange={setSpeakingDetail} />
              </div>
            </div>
          ) : (
            <div className="call-stage">
              {/* Top status bar */}
              <div className="call-stage__topbar">
                <div className="call-stage__status">
                  <span
                    className="call-dot"
                    style={{
                      background: partnerConnected ? 'var(--success)' : 'var(--warning)',
                      boxShadow: partnerConnected ? '0 0 8px var(--success)' : '0 0 8px var(--warning)',
                    }}
                  />
                  <span>{partnerConnected ? 'Live 1-on-1 Audio Call' : t('call.waiting')}</span>
                </div>
                <div className="call-stage__timer-pill">
                  {partnerConnected ? fmt(elapsed) : t('call.waiting')}
                </div>
              </div>

              {/* Central stage */}
              <div className="call-stage__center">
                {/* Large partner avatar with pulse ring */}
                <div className="call-stage__avatar-box">
                  <div className={`call-stage__halo ${partnerSpeaking ? 'active' : ''}`} />
                  <div className={`call-stage__halo-outer ${partnerSpeaking ? 'active' : ''}`} />
                  <div className={`call-stage__avatar ${partnerSpeaking ? 'speaking' : ''}`}>
                    <Avatar
                      name={session?.partnerName}
                      avatarUrl={session?.partnerAvatarUrl}
                      size={96}
                    />
                  </div>
                </div>

                <div className="call-stage__identity">
                  <h2 className="call-stage__name">{session?.partnerName || 'Speaking Partner'}</h2>
                  <div className="call-stage__meta-row">
                    <span className="call-tag">{t('lang.en')}</span>
                    {(session?.partnerLevel || user?.level) && (
                      <span className="call-tag call-tag--level">
                        {t(`level.${session?.partnerLevel || user?.level}`)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Live soundwave animated visualizer */}
                <div className="call-stage__soundwave" aria-hidden="true">
                  {[4, 12, 22, 16, 28, 18, 8].map((h, i) => (
                    <span
                      key={i}
                      className={`call-stage__wave-bar ${
                        partnerSpeaking
                          ? 'speaking-partner'
                          : youSpeaking && micOn
                          ? 'speaking-you'
                          : 'idle'
                      }`}
                      style={{
                        '--bar-h': `${h}px`,
                        animationDelay: `${i * 0.1}s`,
                      } as React.CSSProperties}
                    />
                  ))}
                </div>

                {/* Audio speech indicator text */}
                <div className="call-stage__speech-indicator">
                  {partnerSpeaking ? (
                    <span className="call-status--speaking">
                      <span className="speaking-dot" /> {t('call.speaking')}
                    </span>
                  ) : youSpeaking && micOn ? (
                    <span className="call-status--you">
                      <span className="speaking-dot speaking-dot--you" /> You are speaking…
                    </span>
                  ) : !partnerConnected ? (
                    <span className="call-status--waiting">
                      <span className="call-waiting-spinner" /> Connecting to partner…
                    </span>
                  ) : (
                    <span className="call-status--connected">
                      Ready to speak · Say hello!
                    </span>
                  )}
                </div>

                {/* Topics / Questions button */}
                <button
                  type="button"
                  className="call-stage__topics-btn"
                  onClick={() => {
                    tapHaptic('light');
                    setShowTopics(true);
                  }}
                >
                  <Lightbulb size={17} className="text-amber-400" />
                  <span>
                    {speakingTopicId ? 'View Selected Question' : 'Conversation Topics & Ideas'}
                  </span>
                  <ChevronRight size={16} className="text-white/40" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <CallControls
        micOn={micOn}
        camOn={camOn}
        speaking={youSpeaking && micOn}
        onToggleMic={() => setMicOn((v) => !v)}
        onToggleCam={() => setCamOn(v => !v)}
        onEnd={() => setShowEnd(true)}
        onOpenChat={() => setShowChat(true)}
        unread={unread}
        hidden={!camOn && showTopics && speakingDetail}
      />

      {showChat && (
        <ChatOverlay
          messages={messages}
          isPartnerTyping={isPartnerTyping}
          sessionId={session?.id}
          onClose={() => setShowChat(false)}
          sendMessage={sendMessage}
          sendTyping={sendTyping}
        />
      )}

      {showEnd && (
        <EndSessionSheet
          onConfirm={handleEnd}
          onCancel={() => setShowEnd(false)}
          isEnding={ending}
        />
      )}

      <style>{`
        /* ── Call Stage (Main Clean Voice Screen) ── */
        .call-stage {
          flex: 1; min-height: 0;
          display: flex; flex-direction: column;
          position: relative; z-index: 5;
          padding: calc(var(--space-3) + env(safe-area-inset-top, 0px)) var(--space-4) calc(120px + env(safe-area-inset-bottom, 0px));
        }
        .call-stage__topbar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 8px 14px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: var(--radius-full);
          backdrop-filter: blur(12px);
          font-size: var(--text-xs); font-weight: var(--weight-bold);
          color: rgba(255, 255, 255, 0.85);
          flex-shrink: 0;
        }
        .call-stage__status {
          display: flex; align-items: center; gap: 8px;
        }
        .call-stage__timer-pill {
          font-variant-numeric: tabular-nums;
          font-weight: var(--weight-heavy);
          color: #FFFFFF;
        }

        .call-stage__center {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 16px; text-align: center;
          padding: 16px 0;
        }

        .call-stage__avatar-box {
          position: relative;
          width: 130px; height: 130px;
          display: flex; align-items: center; justify-content: center;
        }
        .call-stage__halo, .call-stage__halo-outer {
          position: absolute; inset: 0; border-radius: 50%;
          border: 2px solid transparent;
          pointer-events: none;
          transition: all 0.25s ease;
        }
        .call-stage__halo.active {
          border-color: rgba(33, 184, 135, 0.45);
          animation: ringPulse 1.6s ease-out infinite;
        }
        .call-stage__halo-outer.active {
          border-color: rgba(33, 184, 135, 0.25);
          animation: ringPulse 1.6s ease-out 0.4s infinite;
        }
        @keyframes ringPulse {
          0% { transform: scale(0.95); opacity: 0.9; }
          100% { transform: scale(1.4); opacity: 0; }
        }
        .call-stage__avatar {
          position: relative; z-index: 2;
          border-radius: 50%;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .call-stage__avatar.speaking {
          transform: scale(1.05);
          box-shadow: 0 0 28px rgba(33, 184, 135, 0.5);
        }

        .call-stage__identity {
          display: flex; flex-direction: column; align-items: center; gap: 6px;
        }
        .call-stage__name {
          font-size: 24px; font-weight: var(--weight-heavy);
          color: #FFFFFF; margin: 0;
          letter-spacing: -0.4px;
        }
        .call-stage__meta-row {
          display: flex; align-items: center; gap: 6px;
        }
        .call-stage__tag--level {
          color: var(--primary); background: rgba(40, 120, 240, 0.16);
          border: 1px solid rgba(40, 120, 240, 0.3);
        }

        /* Soundwave */
        .call-stage__soundwave {
          display: flex; align-items: center; justify-content: center;
          gap: 5px; height: 32px; padding: 0 16px;
        }
        .call-stage__wave-bar {
          width: 4px; border-radius: 2px;
          background: rgba(255, 255, 255, 0.2);
          height: 6px; transition: height 0.15s ease, background-color 0.15s ease;
        }
        .call-stage__wave-bar.speaking-partner {
          background: var(--success);
          animation: waveBounce 0.7s ease-in-out infinite alternate;
        }
        .call-stage__wave-bar.speaking-you {
          background: var(--primary);
          animation: waveBounce 0.7s ease-in-out infinite alternate;
        }
        @keyframes waveBounce {
          0% { height: 6px; }
          100% { height: var(--bar-h, 24px); }
        }

        .call-stage__speech-indicator {
          font-size: 13px; font-weight: var(--weight-semi);
          color: rgba(255, 255, 255, 0.65);
          min-height: 22px;
          display: flex; align-items: center; justify-content: center;
        }
        .call-status--you { color: #60A5FA; display: inline-flex; align-items: center; gap: 6px; }
        .speaking-dot {
          width: 7px; height: 7px; border-radius: 50%; background: var(--success);
          box-shadow: 0 0 8px var(--success); flex-shrink: 0;
        }
        .speaking-dot--you { background: #60A5FA; box-shadow: 0 0 8px #60A5FA; }

        .call-stage__topics-btn {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 18px;
          border-radius: var(--radius-full);
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.14);
          color: #FFFFFF; font-size: 13px; font-weight: var(--weight-bold);
          cursor: pointer; transition: all 0.2s ease;
          margin-top: 10px;
        }
        .call-stage__topics-btn:active {
          transform: scale(0.97);
          background: rgba(255, 255, 255, 0.14);
        }

        /* ── Call Topics Pane ── */
        .call-topics-pane {
          flex: 1; display: flex; flex-direction: column;
          min-height: 0; overflow: hidden; position: relative; z-index: 5;
        }
        .call-topics-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: calc(var(--space-3) + env(safe-area-inset-top, 0px)) var(--space-4) var(--space-3);
          background: rgba(8, 12, 20, 0.85);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(14px);
          flex-shrink: 0;
        }
        .call-topics-back-btn {
          display: flex; align-items: center; gap: 8px;
          background: transparent; border: none; color: #FFFFFF;
          font-size: var(--text-sm); font-weight: var(--weight-bold);
          cursor: pointer; padding: 6px 12px; border-radius: var(--radius-full);
          transition: background 0.15s ease;
        }
        .call-topics-back-btn:active { background: rgba(255, 255, 255, 0.12); }
        .call-topics-timer {
          display: flex; align-items: center; gap: 6px;
          font-size: var(--text-xs); font-weight: var(--weight-bold);
          color: rgba(255, 255, 255, 0.85);
          font-variant-numeric: tabular-nums;
        }
        .call-topics-body {
          flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch;
          padding-bottom: calc(140px + env(safe-area-inset-bottom, 0px));
        }

        .call-screen {
          --bg: #080C14;
          --bg-secondary: rgba(255,255,255,0.07);
          --surface-2: rgba(255,255,255,0.12);
          --surface-3: rgba(255,255,255,0.20);
          --text-primary: #ffffff;
          --text-secondary: rgba(255,255,255,0.55);
          --border: rgba(255,255,255,0.1);
          --border-strong: rgba(255,255,255,0.2);
          /* Re-declaring the token does not re-resolve a colour already computed
             further up: <body> resolved var(--text-primary) against the light scheme
             before this subtree existed, so anything in here without its own colour
             inherited near-black onto a dark screen — the chat overlay's title, most
             visibly. Setting it once here makes the subtree read from these tokens. */
          color: var(--text-primary);
          position: relative;
          width: 100%; height: 100%;
          background: #080C14;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .call-bg-glow {
          position: absolute; inset: 0; z-index: 0;
          background:
            radial-gradient(ellipse 80% 50% at 50% -10%, rgba(0,168,255,0.12) 0%, transparent 65%),
            radial-gradient(ellipse 60% 40% at 80% 110%, rgba(139,92,246,0.08) 0%, transparent 60%);
          pointer-events: none;
        }

        .call-header {
          position: relative; z-index: 10;
          display: flex; align-items: center; gap: var(--space-3);
          padding: calc(var(--space-3) + env(safe-area-inset-top, 0px)) var(--space-4) var(--space-3);
          border-bottom: 1px solid rgba(255,255,255,0.07);
          animation: fadeIn 0.2s ease both;
          flex-shrink: 0;
          background: rgba(8, 12, 20, 0.6);
          backdrop-filter: blur(10px);
        }
        .call-presence {
          position: relative;
          flex-shrink: 0;
          border-radius: 50%;
        }
        .call-presence::after {
          content: '';
          position: absolute; inset: -3px;
          border-radius: 50%;
          border: 2px solid transparent;
          transition: border-color 0.18s ease;
          pointer-events: none;
        }
        .call-presence--speaking::after {
          border-color: var(--success);
          animation: speakPulse 1.3s ease-out infinite;
        }
        @keyframes speakPulse {
          0%   { box-shadow: 0 0 0 0 rgba(52,199,89,0.45); }
          100% { shadow: 0 0 0 9px rgba(52,199,89,0); }
        }

        .call-header__info {
          flex: 1; min-width: 0;
          display: flex; flex-direction: column; gap: var(--space-1);
        }
        .call-header__name {
          font-size: var(--text-md); font-weight: var(--weight-bold);
          color: var(--text-primary);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          line-height: 1.2;
        }
        .call-header__meta {
          display: flex; flex-direction: column; gap: var(--space-1); align-items: flex-start;
        }
        .call-header__meta-row {
          display: flex; align-items: center; gap: var(--space-1);
        }
        .call-tag {
          font-size: var(--text-xs); font-weight: var(--weight-bold);
          color: rgba(255,255,255,0.85);
          background: rgba(255,255,255,0.1);
          border-radius: 6px; padding: 2px 6px;
          letter-spacing: 0.3px;
          white-space: nowrap;
        }
        .call-tag--dim {
          color: rgba(255,255,255,0.4);
          background: rgba(255,255,255,0.05);
          font-weight: var(--weight-medium);
        }
        .call-status {
          font-size: var(--text-xs); font-weight: var(--weight-semi);
          color: rgba(255,255,255,0.45);
          display: inline-flex; align-items: center;
          white-space: nowrap;
          transition: color 0.18s ease;
        }
        .call-status::before {
          content: '';
          width: 6px; height: 6px; border-radius: 50%;
          margin-right: var(--space-1);
          background: currentColor;
          flex-shrink: 0;
        }
        .call-status--speaking { color: var(--success); }
        .call-header__timer {
          display: flex; align-items: center; gap: var(--space-1-5);
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 99px; padding: var(--space-1) var(--space-3);
          font-size: var(--text-sm); font-weight: var(--weight-bold);
          color: rgba(255,255,255,0.9);
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .call-header__elapsed { letter-spacing: 0.3px; }
        .call-dot {
          width: 7px; height: 7px; border-radius: 50%;
          flex-shrink: 0;
          animation: dotPulse 2s ease-in-out infinite;
        }

        .call-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          min-height: 0;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          position: relative; z-index: 5;
          padding-top: var(--space-3);
          padding-bottom: calc(140px + env(safe-area-inset-bottom, 0px));
        }
        .call-body > * { width: 100%; }

        .call-waiting-note {
          display: flex; align-items: center; justify-content: center; gap: var(--space-2);
          margin: var(--space-0-5) var(--space-4) var(--space-1-5);
          padding: var(--space-2) var(--space-3);
          background: rgba(255,149,0,0.12);
          border: 1px solid rgba(255,149,0,0.22);
          border-radius: 12px;
          font-size: var(--text-sm); font-weight: var(--weight-semi);
          color: #ffb454;
        }
        .call-waiting-spinner {
          width: 13px; height: 13px; border-radius: 50%;
          border: 2px solid rgba(255,180,84,0.35);
          border-top-color: #ffb454;
          animation: spin 0.8s linear infinite;
        }

        .call-cam-timer {
          position: absolute; top: calc(14px + env(safe-area-inset-top, 0px)); left: 50%; transform: translateX(-50%);
          display: flex; align-items: center; gap: var(--space-1-5);
          background: rgba(0,0,0,0.45);
          backdrop-filter: blur(10px);
          border-radius: 99px; padding: var(--space-1) var(--space-4);
          font-size: var(--text-sm); font-weight: var(--weight-bold);
          color: rgba(255,255,255,0.9);
          font-variant-numeric: tabular-nums;
          z-index: 15; pointer-events: none;
        }

        .call-error-banner {
          position: absolute; top: 12px; left: 12px; right: 12px;
          display: flex; align-items: center; justify-content: space-between;
          background: rgba(220,38,38,0.9);
          backdrop-filter: blur(8px);
          border-radius: 12px; padding: var(--space-3) var(--space-4);
          font-size: var(--text-sm); font-weight: var(--weight-semi); color: #fff;
          z-index: 30; gap: var(--space-3);
          box-shadow: 0 4px 20px rgba(220,38,38,0.4);
        }
        .call-error-banner button {
          font-size: var(--text-md); color: rgba(255,255,255,0.7);
          flex-shrink: 0;
        }

        .video-grid {
          position: absolute; inset: 0;
          background: #000; z-index: 1;
        }
        .video-main {
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center;
          background: #111;
        }
        .video-main video { width: 100%; height: 100%; object-fit: cover; }
        .video-scrim {
          position: absolute; left: 0; right: 0; bottom: 0; height: 140px;
          background: linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%);
          z-index: 1; pointer-events: none;
        }
        .video-main--speaking::after {
          content: '';
          position: absolute; inset: 0;
          border: 3px solid var(--success);
          box-shadow: inset 0 0 24px rgba(52,199,89,0.35);
          z-index: 3; pointer-events: none;
          animation: videoSpeak 1.4s ease-in-out infinite;
        }
        @keyframes videoSpeak {
          0%, 100% { opacity: 0.65; }
          50% { opacity: 1; }
        }
        .video-pip {
          position: absolute; bottom: 130px; right: 14px;
          width: 112px; height: 162px;
          border-radius: 18px; overflow: hidden;
          background: #1a1a2e;
          border: 2px solid rgba(255,255,255,0.18);
          box-shadow: 0 6px 28px rgba(0,0,0,0.55);
          cursor: pointer; z-index: 15;
          display: flex; align-items: center; justify-content: center;
          transition: transform 0.15s, border-color 0.18s, box-shadow 0.18s;
        }
        .video-pip:active { transform: scale(0.95); }
        .video-pip--speaking {
          border-color: var(--success);
          box-shadow: 0 6px 28px rgba(0,0,0,0.55), 0 0 0 2px rgba(52,199,89,0.45);
        }
        .video-pip video { width: 100%; height: 100%; object-fit: cover; }
        .video-pip__swap {
          position: absolute; top: 7px; right: 7px;
          width: 24px; height: 24px;
          display: flex; align-items: center; justify-content: center;
          background: rgba(0,0,0,0.5); color: #fff;
          border-radius: 50%; backdrop-filter: blur(6px);
          border: 1px solid rgba(255,255,255,0.18);
          pointer-events: none;
        }
        .video-avatar {
          width: 100%; height: 100%;
          display: flex; align-items: center; justify-content: center;
          background: radial-gradient(circle at 50% 38%, #2a2a45 0%, #14141f 75%);
        }
        .video-avatar span { font-size: 52px; font-weight: var(--weight-bold); color: rgba(255,255,255,0.6); }
        .video-avatar--pip span { font-size: 28px; }
        .video-label {
          position: absolute; bottom: 10px; left: 12px;
          display: inline-flex; align-items: center; gap: var(--space-1-5);
          font-size: var(--text-sm); font-weight: var(--weight-semi);
          color: #fff; background: rgba(0,0,0,0.4);
          padding: var(--space-1) var(--space-3); border-radius: 20px;
          backdrop-filter: blur(6px); z-index: 4; pointer-events: none;
        }
        .video-label__dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: var(--success); flex-shrink: 0;
          box-shadow: 0 0 6px var(--success);
        }
        .video-label--pip {
          font-size: var(--text-xs); bottom: 6px; left: 6px;
          padding: var(--space-0-5) var(--space-1-5);
        }

        .timeout-screen {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: var(--space-5); padding: var(--space-7) var(--space-5);
          flex: 1; height: 100%; background: var(--bg); text-align: center;
        }
        .timeout-info { display: flex; flex-direction: column; gap: var(--space-2); }
        .timeout-info h2 { font-size: var(--text-lg); font-weight: var(--weight-heavy); color: var(--text-primary); }
        .timeout-info p { font-size: var(--text-base); color: var(--text-secondary); line-height: 1.6; }
        .timeout-actions {
          display: flex; flex-direction: column; gap: var(--space-2); width: 100%; max-width: 260px;
        }

        @keyframes dotPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.15); }
        }

      
        /* The call screen is a video surface, so it stays dark whatever Telegram's
           colour scheme says — but the labels inside it are written with the theme's
           text tokens, and in the light scheme those resolved to near-black on
           near-black. Pinning the dark palette for this subtree keeps every token in
           here meaning what it meant when it was written, instead of patching each
           rule one at a time. */
        .light .call-screen {
          color-scheme: dark;
          --bg:             #080C14;
          --bg-secondary:   #121824;
          --surface-2:      #1A2232;
          --surface-3:      #222C3E;
          --border:         rgba(255, 255, 255, 0.08);
          --border-strong:  rgba(255, 255, 255, 0.16);
          --text-primary:   #F8FAFC;
          --text-secondary: #94A3B8;
          --text-tertiary:  #64748B;
        }
      `}</style>
    </div>
  );
}
