import { useState, useEffect, useRef, useCallback } from 'react';
import { LiveKitRoom, RoomAudioRenderer, useRoomContext, useTracks, VideoTrack, useRemoteParticipants, useSpeakingParticipants } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { endSession, sendAIPartnerTurn, getTTSAudio, recordAiPartnerSession } from '../api/endpoints';
import { useSocket } from '../hooks/useSocket';
import useAppStore from '../store/useAppStore';
import CallControls from '../components/CallControls';
import ChatOverlay from '../components/ChatOverlay';
import EndSessionSheet from '../components/EndSessionSheet';
import Avatar from '../components/Avatar';
import SpeakingQuestions from '../components/SpeakingQuestions';
import { useT } from '../i18n';
import { notifyHaptic } from '../utils/haptics';
import { AlertCircle, AlertTriangle, X, Sparkles } from 'lucide-react';

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

function AiVideoGrid({
  camOn,
  aiStatus,
}: {
  camOn: boolean;
  aiStatus: 'idle' | 'listening' | 'thinking' | 'speaking';
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [swapped, setSwapped] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    if (camOn) {
      navigator.mediaDevices
        ?.getUserMedia({ video: true, audio: false })
        .then((s) => {
          stream = s;
          if (videoRef.current) {
            videoRef.current.srcObject = s;
          }
        })
        .catch((err) => {
          console.warn('Camera access error:', err);
        });
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [camOn]);

  const pip = useDrag({ x: -14, y: -130 }, () => setSwapped((v) => !v));

  if (!camOn) return null;

  const isSpeaking = aiStatus === 'speaking';
  const isListening = aiStatus === 'listening';
  const isThinking = aiStatus === 'thinking';

  return (
    <div className="video-grid ai-video-grid">
      <div className={`video-main ${!swapped && isSpeaking ? 'video-main--speaking' : ''}`}>
        {swapped ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="ai-user-video"
          />
        ) : (
          <div className="ai-avatar-view">
            <div className={`ai-orb-container ${aiStatus}`}>
              <div className="ai-orb-glow" />
              <div className="ai-orb-core">
                <Sparkles size={56} className="ai-orb-icon" />
              </div>
              {isSpeaking && <div className="ai-wave-ring ring-1" />}
              {isSpeaking && <div className="ai-wave-ring ring-2" />}
              {isSpeaking && <div className="ai-wave-ring ring-3" />}
            </div>
            <div className="ai-view-badge">
              <span className={`ai-badge-dot ${aiStatus}`} />
              <span>
                {isListening
                  ? 'Listening...'
                  : isThinking
                  ? 'Thinking...'
                  : isSpeaking
                  ? 'Speaking...'
                  : 'Suhbatdosh AI'}
              </span>
            </div>
          </div>
        )}
        <div className="video-scrim" />
        <span className="video-label">
          {!swapped && isSpeaking && <span className="video-label__dot" />}
          {swapped ? 'You' : 'Suhbatdosh AI'}
        </span>
      </div>

      <div
        className={`video-pip ${swapped && isSpeaking ? 'video-pip--speaking' : ''}`}
        style={{
          right: Math.max(12, -pip.pos.x),
          bottom: Math.max(12, -pip.pos.y),
          touchAction: 'none',
        }}
        onPointerDown={pip.onPointerDown}
        onPointerMove={pip.onPointerMove}
        onPointerUp={pip.onPointerUp}
      >
        {!swapped ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="ai-user-video-pip"
          />
        ) : (
          <div className="ai-avatar-view-pip">
            <Sparkles size={26} className="text-cyan-400" />
          </div>
        )}
        <span className="video-label video-label--pip">{!swapped ? 'You' : 'Suhbatdosh AI'}</span>
        <div className="video-pip__swap" aria-hidden="true">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
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
  } = useAppStore();
  const { joinSession, sendMessage, sendTyping } = useSocket();
  const t = useT();

  const isAiSession = !!session?.isAi;

  const [elapsed, setElapsed]       = useState(0);
  const [showChat, setShowChat]     = useState(false);
  const [showEnd, setShowEnd]       = useState(false);
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

  // AI Voice State
  const [aiStatus, setAiStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [aiHistory, setAiHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const maxRecordTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasSpokenRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  const handleSpeaking = useCallback((you: boolean, partner: boolean) => {
    setYouSpeaking(you);
    setPartnerSpeaking(partner);
  }, []);

  const timerRef = useRef<any>(null);

  // AI Voice loop effect
  useEffect(() => {
    isMountedRef.current = true;
    let timer: NodeJS.Timeout;

    if (isAiSession) {
      setPartnerConnected(true);
      const userName = user?.displayName || 'there';
      const initialGreeting = `Hi ${userName}! I'm Suhbatdosh AI, your speaking partner. What would you like to practice talking about today?`;

      setAiHistory([{ role: 'assistant', content: initialGreeting }]);

      addMessage({
        id: `ai_init_${Date.now()}`,
        senderId: 'ai_partner',
        content: initialGreeting,
        sentAt: new Date().toISOString(),
        sent_at: new Date().toISOString(),
        isOwn: false,
        is_own: false,
      });

      timer = setTimeout(() => {
        if (isMountedRef.current) {
          speakAiText(initialGreeting);
        }
      }, 500);

      return () => {
        if (timer) clearTimeout(timer);
        isMountedRef.current = false;
        cleanupAiAudio();
      };
    }
    return () => {
      isMountedRef.current = false;
      cleanupAiAudio();
    };
  }, [isAiSession]);

  function cleanupAiAudio() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch {}
    }
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (maxRecordTimerRef.current) clearTimeout(maxRecordTimerRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try { audioContextRef.current.close(); } catch {}
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  async function speakAiText(text: string) {
    if (!isMountedRef.current) return;
    setAiStatus('speaking');

    try {
      const res = await getTTSAudio(text);
      if (res?.ok && res?.audioUrl) {
        const audio = new Audio(res.audioUrl);
        audio.onended = () => {
          if (isMountedRef.current && micOn) {
            startAiRecording();
          } else {
            setAiStatus('idle');
          }
        };
        audio.onerror = () => {
          if (isMountedRef.current && micOn) startAiRecording();
        };
        await audio.play();
        return;
      }
    } catch {}

    if ('speechSynthesis' in window) {
      const spokenText = text
        .replace(/Suhbatdosh AI/gi, 'Soohbahtdosh A I')
        .replace(/Suhbatdosh/gi, 'Soohbahtdosh')
        .replace(/Assalomu alaykum/gi, 'Ahssalohmoo ahlaykoom')
        .replace(/Salom/gi, 'Sahlom')
        .replace(/Rahmat/gi, 'Rahmat');
      const utterance = new SpeechSynthesisUtterance(spokenText);
      utterance.lang = 'en-US';
      utterance.rate = 0.95;
      utterance.onend = () => {
        if (isMountedRef.current && micOn) {
          startAiRecording();
        } else {
          setAiStatus('idle');
        }
      };
      utterance.onerror = () => {
        if (isMountedRef.current && micOn) startAiRecording();
      };
      window.speechSynthesis.speak(utterance);
    } else {
      if (isMountedRef.current && micOn) startAiRecording();
    }
  }

  async function handleSendAiTurn(audioBase64: string, audioMimeType: string) {
    if (!isMountedRef.current) return;
    setAiStatus('thinking');

    try {
      const res = await sendAIPartnerTurn({
        audioBase64,
        audioMimeType,
        history: aiHistory,
        userLevel: user?.level ? String(user.level) : undefined,
      });

      const userText = res.transcription || 'Voice message';
      const aiResponse = res.aiResponse || "That's very interesting! Tell me more?";

      addMessage({
        id: Date.now().toString(),
        senderId: String(user?.id || 'me'),
        content: userText,
        sentAt: new Date().toISOString(),
        sent_at: new Date().toISOString(),
        isOwn: true,
        is_own: true,
      });

      addMessage({
        id: (Date.now() + 1).toString(),
        senderId: 'ai_partner',
        content: aiResponse,
        sentAt: new Date().toISOString(),
        sent_at: new Date().toISOString(),
        isOwn: false,
        is_own: false,
      });

      setAiHistory((prev) => [
        ...prev,
        { role: 'user', content: userText },
        { role: 'assistant', content: aiResponse },
      ]);

      notifyHaptic('success');
      speakAiText(aiResponse);
    } catch {
      notifyHaptic('error');
      setAiStatus('idle');
    }
  }

  async function handleSendAiTextTurn(text: string) {
    if (!isMountedRef.current || !text.trim()) return;

    stopAiRecording();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();

    const userText = text.trim();

    addMessage({
      id: Date.now().toString(),
      senderId: String(user?.id || 'me'),
      content: userText,
      sentAt: new Date().toISOString(),
      sent_at: new Date().toISOString(),
      isOwn: true,
      is_own: true,
    });

    setAiStatus('thinking');

    try {
      const res = await sendAIPartnerTurn({
        text: userText,
        history: aiHistory,
        userLevel: user?.level ? String(user.level) : undefined,
      });

      const aiResponse = res.aiResponse || "That's very interesting! Tell me more?";

      addMessage({
        id: (Date.now() + 1).toString(),
        senderId: 'ai_partner',
        content: aiResponse,
        sentAt: new Date().toISOString(),
        sent_at: new Date().toISOString(),
        isOwn: false,
        is_own: false,
      });

      setAiHistory((prev) => [
        ...prev,
        { role: 'user', content: userText },
        { role: 'assistant', content: aiResponse },
      ]);

      notifyHaptic('success');
      setAiStatus('idle');
      if (micOn) startAiRecording();
    } catch {
      notifyHaptic('error');
      setAiStatus('idle');
    }
  }

  async function startAiRecording() {
    if (!isMountedRef.current || !micOn) {
      setAiStatus('idle');
      return;
    }
    try {
      if (maxRecordTimerRef.current) clearTimeout(maxRecordTimerRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      hasSpokenRef.current = false;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkSilence = () => {
        if (!isMountedRef.current || mediaRecorder.state === 'inactive') return;
        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
        const averageVolume = sum / bufferLength;

        // Lower volume threshold to 4 to detect soft mobile speech easily
        if (averageVolume > 4) {
          hasSpokenRef.current = true;
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        } else if (hasSpokenRef.current) {
          if (!silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(() => {
              stopAiRecording();
            }, 1800);
          }
        }

        animationFrameRef.current = requestAnimationFrame(checkSilence);
      };

      checkSilence();

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        if (maxRecordTimerRef.current) clearTimeout(maxRecordTimerRef.current);
        stream.getTracks().forEach((t) => t.stop());

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        if (audioBlob.size > 200 && (hasSpokenRef.current || audioChunksRef.current.length > 2)) {
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = () => {
            const base64Data = (reader.result as string).split(',')[1];
            handleSendAiTurn(base64Data, 'audio/webm');
          };
        } else {
          setAiStatus('idle');
        }
      };

      mediaRecorder.start();
      setAiStatus('listening');

      // Max 10-second safety timeout so recording never gets stuck permanently
      maxRecordTimerRef.current = setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          stopAiRecording();
        }
      }, 10000);
    } catch {
      setAiStatus('idle');
    }
  }

  function stopAiRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }

  useEffect(() => {
    if (!isAiSession && session?.id) joinSession(session.id);
    const backBtn = window.Telegram?.WebApp?.BackButton;
    const onBack = () => setShowEnd(true);
    if (backBtn) {
      backBtn.show();
      backBtn.onClick(onBack);
    }
    timerRef.current = setInterval(() => {
      setElapsed((prevElapsed) => {
        const next = prevElapsed + 1;
        if (isAiSession && !user?.isPremium) {
          const used = user?.dailyMinutes || 0;
          const limit = user?.dailyLimit || 10;
          const remSecs = Math.max(0, (limit - used) * 60);
          if (remSecs > 0 && next >= remSecs) {
            setTimeout(() => {
              handleEnd(true);
            }, 0);
          }
        }
        return next;
      });
    }, 1000);

    const timeoutId = setTimeout(() => {
      if (!isAiSession && !useAppStore.getState().partnerConnected) {
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
  }, [isAiSession, user?.isPremium, user?.dailyMinutes, user?.dailyLimit]);

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

  async function handleEnd(isLimitReached = false) {
    if (ending) return;
    setEnding(true);
    cleanupAiAudio();

    if (isAiSession) {
      try {
        const res = await recordAiPartnerSession(elapsed);
        if (res?.user) {
          updateUser(res.user);
        } else if (res?.addedMinutes) {
          updateUser({ dailyMinutes: (user?.dailyMinutes || 0) + res.addedMinutes });
        }
      } catch (err) {
        console.error('[AI Session End Error]', err);
      }

      if (isLimitReached) {
        setMatchingStatus('limit_reached');
        navigate('matching');
        return;
      }
      navigate('session_end', { sessionId: 'ai_session', elapsed, isAi: true });
      return;
    }

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
      {!isAiSession && isCallActive && livekitToken && livekitUrl && (
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

      {/* AI Video Grid when camera is ON in AI session */}
      {isAiSession && camOn && (
        <AiVideoGrid camOn={camOn} aiStatus={aiStatus} />
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

      {/* ── Header — audio mode ── */}
      {!camOn && (
        <div className="call-header">
          <div className={`call-presence${partnerSpeaking || aiStatus === 'speaking' ? ' call-presence--speaking' : ''}`}>
            {isAiSession ? (
              <div className="ai-partner-avatar">
                <Sparkles size={22} className="text-cyan-400" />
              </div>
            ) : (
              <Avatar name={session?.partnerName} avatarUrl={session?.partnerAvatarUrl} size={44} />
            )}
          </div>
          <div className="call-header__info">
            <span className="call-header__name">
              {session?.partnerName || (isAiSession ? 'Suhbatdosh AI' : 'Partner')}
            </span>
            <div className="call-header__meta">
              <div className="call-header__meta-row">
                <span className="call-tag">{t('lang.en')}</span>
                {(session?.partnerLevel || user?.level) && (
                  <span className="call-tag call-tag--dim">{t(`level.${session?.partnerLevel || user?.level}`)}</span>
                )}
                {isAiSession ? (
                  <span className={`call-status ${aiStatus === 'speaking' ? 'call-status--speaking' : ''}`}>
                    {aiStatus === 'listening' ? 'Listening...' : aiStatus === 'thinking' ? 'Thinking...' : aiStatus === 'speaking' ? 'Speaking...' : 'Connected'}
                  </span>
                ) : partnerSpeaking ? (
                  <span className="call-status call-status--speaking">
                    {t('call.speaking')}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="call-header__timer">
            <span
              className="call-dot"
              style={{
                background: partnerConnected ? 'var(--success)' : 'var(--warning)',
                boxShadow: partnerConnected ? '0 0 8px var(--success)' : '0 0 8px var(--warning)',
              }}
            />
            <span className="call-header__elapsed">
              {partnerConnected ? fmt(elapsed) : t('call.waiting')}
            </span>
          </div>
        </div>
      )}

      {/* ── Speaking section — audio mode ── */}
      {!camOn && (
        <div className="call-body">
          {!partnerConnected && (
            <div className="call-waiting-note">
              <span className="call-waiting-spinner" />
              <span>{t('call.waiting')}</span>
            </div>
          )}
          <SpeakingQuestions onDetailChange={setSpeakingDetail} />
        </div>
      )}

      <CallControls
        micOn={micOn}
        camOn={camOn}
        isAiSession={isAiSession}
        speaking={(youSpeaking || aiStatus === 'listening') && micOn}
        onToggleMic={() => {
          setMicOn(v => {
            const next = !v;
            if (isAiSession) {
              if (!next) stopAiRecording();
              else startAiRecording();
            }
            return next;
          });
        }}
        onToggleCam={() => setCamOn(v => !v)}
        onEnd={() => setShowEnd(true)}
        onOpenChat={() => setShowChat(true)}
        unread={unread}
        hidden={!camOn && speakingDetail}
      />

      {showChat && (
        <ChatOverlay
          messages={messages}
          isPartnerTyping={isPartnerTyping || aiStatus === 'thinking'}
          sessionId={session?.id}
          onClose={() => setShowChat(false)}
          sendMessage={(sId, text) => {
            if (isAiSession) {
              handleSendAiTextTurn(text);
            } else {
              sendMessage(sId, text);
            }
          }}
          sendTyping={(sId) => {
            if (!isAiSession) sendTyping(sId);
          }}
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
        .call-screen {
          --bg: #080C14;
          --bg-secondary: rgba(255,255,255,0.07);
          --text-primary: #ffffff;
          --text-secondary: rgba(255,255,255,0.55);
          --border: rgba(255,255,255,0.1);
          position: relative;
          width: 100%; height: 100%;
          background: #080C14;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .ai-partner-avatar {
          width: 44px; height: 44px; border-radius: 50%;
          background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
          display: flex; align-items: center; justify-content: center;
          border: 1.5px solid rgba(56, 189, 248, 0.5);
          box-shadow: 0 0 16px rgba(56, 189, 248, 0.4);
          color: #ffffff;
        }

        .ai-voice-action-box {
          width: 100%;
          padding: 8px 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          z-index: 12;
        }

        .ai-voice-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 20px;
          border-radius: 99px;
          background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
          color: #ffffff;
          font-size: 13px;
          font-weight: 700;
          border: 1px solid rgba(255, 255, 255, 0.2);
          box-shadow: 0 4px 16px rgba(2, 132, 199, 0.35);
          cursor: pointer;
          transition: transform 0.15s ease, background 0.15s ease;
        }
        .ai-voice-btn:active {
          transform: scale(0.96);
        }

        .ai-voice-btn--listening {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          box-shadow: 0 4px 20px rgba(239, 68, 68, 0.45);
          animation: pulseListening 1.5s ease-in-out infinite;
        }

        @keyframes pulseListening {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.6); }
          50% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
        }

        .ai-voice-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #ffffff;
          animation: blinkDot 1s ease-in-out infinite alternate;
        }

        @keyframes blinkDot {
          from { opacity: 0.3; }
          to { opacity: 1; }
        }

        .ai-voice-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border-radius: 99px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
          font-size: 13px;
          font-weight: 600;
          color: #94a3b8;
        }
        .ai-voice-status-pill--speaking {
          color: #38bdf8;
          border-color: rgba(56, 189, 248, 0.3);
          background: rgba(56, 189, 248, 0.1);
        }

        .ai-voice-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255, 255, 255, 0.2);
          border-top-color: #38bdf8;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
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

        /* AI Video Grid Styles */
        .ai-video-grid { position: absolute; inset: 0; z-index: 1; }
        .ai-user-video, .ai-user-video-pip {
          width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1);
        }
        .ai-avatar-view {
          width: 100%; height: 100%;
          background: radial-gradient(circle at center, #0c192e 0%, #030712 100%);
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          position: relative; overflow: hidden;
        }
        .ai-orb-container {
          position: relative; width: 140px; height: 140px;
          display: flex; align-items: center; justify-content: center;
        }
        .ai-orb-core {
          width: 90px; height: 90px; border-radius: 50%;
          background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
          border: 2px solid rgba(56, 189, 248, 0.6);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 30px rgba(56, 189, 248, 0.5); z-index: 2;
        }
        .ai-orb-icon { color: #ffffff; }
        .ai-orb-glow {
          position: absolute; inset: -20px; border-radius: 50%;
          background: radial-gradient(circle, rgba(56, 189, 248, 0.35) 0%, transparent 70%);
          animation: orbPulse 3s ease-in-out infinite;
        }
        .ai-wave-ring {
          position: absolute; border-radius: 50%;
          border: 2px solid rgba(56, 189, 248, 0.6);
          animation: waveExpand 2s cubic-bezier(0, 0.2, 0.8, 1) infinite;
        }
        .ring-1 { width: 100px; height: 100px; animation-delay: 0s; }
        .ring-2 { width: 100px; height: 100px; animation-delay: 0.6s; }
        .ring-3 { width: 100px; height: 100px; animation-delay: 1.2s; }
        @keyframes waveExpand {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        @keyframes orbPulse {
          0%, 100% { transform: scale(0.95); opacity: 0.7; }
          50% { transform: scale(1.15); opacity: 1; }
        }
        .ai-view-badge {
          margin-top: 24px; padding: 8px 18px; border-radius: 20px;
          background: rgba(15, 23, 42, 0.75);
          border: 1px solid rgba(255, 255, 255, 0.12);
          backdrop-filter: blur(12px); display: flex; align-items: center; gap: 8px;
          font-size: 13px; font-weight: 600; color: #f8fafc; z-index: 2;
        }
        .ai-badge-dot { width: 8px; height: 8px; border-radius: 50%; background: #94a3b8; }
        .ai-badge-dot.listening { background: #10b981; box-shadow: 0 0 8px #10b981; }
        .ai-badge-dot.thinking { background: #f59e0b; box-shadow: 0 0 8px #f59e0b; }
        .ai-badge-dot.speaking { background: #38bdf8; box-shadow: 0 0 8px #38bdf8; }
        .ai-avatar-view-pip {
          width: 100%; height: 100%;
          background: linear-gradient(135deg, #0c192e 0%, #030712 100%);
          display: flex; align-items: center; justify-content: center;
        }
      `}</style>
    </div>
  );
}
