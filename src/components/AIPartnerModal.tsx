import React, { useState, useRef, useEffect } from 'react';
import { X, Mic, MicOff, PhoneOff, Sparkles, RefreshCw, Volume2, Send } from 'lucide-react';
import { sendAIPartnerTurn, getTTSAudio, getAiStatus } from '../api/endpoints';
import { tapHaptic, notifyHaptic } from '../utils/haptics';
import useAppStore from '../store/useAppStore';

interface AIPartnerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AIPartnerModal({ isOpen, onClose }: AIPartnerModalProps) {
  const { user } = useAppStore();
  const [status, setStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [history, setHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const isComponentMounted = useRef(true);

  // Silence Detection Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasSpokenRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    isComponentMounted.current = true;
    if (isOpen) {
      setErrorMsg(null);
      getAiStatus().then((res) => {
        if (res && res.enabled === false) {
          setErrorMsg("Suhbatdosh AI vaqtincha admin tomonidan o'chirilgan.");
          setStatus('idle');
        } else {
          startRecording();
        }
      }).catch(() => {
        startRecording();
      });
    } else {
      cleanupAudio();
    }
    return () => {
      isComponentMounted.current = false;
      cleanupAudio();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  function cleanupAudio() {
    stopRecording();
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  async function speakText(text: string) {
    if (!isComponentMounted.current) return;
    setStatus('speaking');
    tapHaptic('light');

    try {
      const res = await getTTSAudio(text);
      if (res?.ok && res?.audioUrl) {
        const audio = new Audio(res.audioUrl);
        audio.onended = () => {
          if (isComponentMounted.current && !isMuted) {
            startRecording();
          } else {
            setStatus('idle');
          }
        };
        await audio.play();
        return;
      }
    } catch {
      // Fallback
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.95;
      utterance.onend = () => {
        if (isComponentMounted.current && !isMuted) {
          startRecording();
        } else {
          setStatus('idle');
        }
      };
      window.speechSynthesis.speak(utterance);
    } else {
      if (isComponentMounted.current && !isMuted) startRecording();
    }
  }

  async function handleSendTurn(audioBase64: string, audioMimeType: string) {
    if (!isComponentMounted.current) return;
    setStatus('thinking');
    setErrorMsg(null);
    tapHaptic('medium');

    try {
      const res = await sendAIPartnerTurn({
        audioBase64,
        audioMimeType,
        history,
        userLevel: user?.level ? String(user.level) : undefined,
      });

      const userText = res.transcription || 'Voice message';
      const aiResponse = res.aiResponse || "That's very interesting! Tell me more?";

      setHistory((prev) => [
        ...prev,
        { role: 'user', content: userText },
        { role: 'assistant', content: aiResponse },
      ]);

      notifyHaptic('success');
      speakText(aiResponse);
    } catch (err: any) {
      console.error('[AI Voice Partner Error]:', err);
      const msg = err?.response?.data?.error || err?.message || 'Suhbatdosh AI unavailable. Try speaking again.';
      setErrorMsg(msg);
      notifyHaptic('error');
      setStatus('idle');
    }
  }

  async function startRecording() {
    if (isMuted || !isComponentMounted.current) {
      setStatus('idle');
      return;
    }
    try {
      setErrorMsg(null);
      hasSpokenRef.current = false;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // Setup Web Audio API Silence Detection
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
        if (!isComponentMounted.current || mediaRecorder.state === 'inactive') return;
        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const averageVolume = sum / bufferLength;
        setVolumeLevel(Math.min(100, Math.round(averageVolume * 2)));

        // Speech detection threshold
        if (averageVolume > 15) {
          hasSpokenRef.current = true;
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        } else if (hasSpokenRef.current) {
          // If user was speaking and now silent for 1.3 seconds, automatically stop & send!
          if (!silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(() => {
              stopRecording();
            }, 2200);
          }
        }

        animationFrameRef.current = requestAnimationFrame(checkSilence);
      };

      checkSilence();

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        stream.getTracks().forEach((t) => t.stop());

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        if (audioBlob.size > 200 && hasSpokenRef.current) {
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = () => {
            const base64Data = (reader.result as string).split(',')[1];
            handleSendTurn(base64Data, 'audio/webm');
          };
        } else {
          setStatus('idle');
        }
      };

      mediaRecorder.start();
      setStatus('listening');
      tapHaptic('heavy');
    } catch {
      setErrorMsg('Microphone access was denied or is not supported.');
      setStatus('idle');
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }

  function handleOrbClick() {
    if (status === 'listening') {
      // Tap orb to manually send immediately!
      stopRecording();
    } else if (status === 'idle') {
      startRecording();
    }
  }

  function handleEndSession() {
    cleanupAudio();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl fade-in">
      <div className="relative w-full max-w-md h-[88vh] flex flex-col justify-between items-center py-8 px-6 bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="w-full flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg leading-tight">Suhbatdosh AI</h3>
              <p className="text-xs text-cyan-400 font-medium">Practice speaking with Suhbatdosh AI</p>
            </div>
          </div>

          <button
            onClick={handleEndSession}
            className="p-2 text-slate-400 hover:text-white rounded-full bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Center: Interactive Glowing Voice Orb */}
        <div className="relative flex flex-col items-center justify-center my-auto z-10 space-y-8">
          
          {/* Animated Glowing Orb Container - Clickable to Send Immediately */}
          <button
            onClick={handleOrbClick}
            disabled={status === 'thinking'}
            className="relative flex items-center justify-center w-52 h-52 outline-none group cursor-pointer"
          >
            
            {/* Outer Ripple Aura Rings */}
            {status === 'listening' && (
              <>
                <div
                  className="absolute inset-0 rounded-full bg-emerald-500/25 animate-ping duration-1000"
                  style={{ transform: `scale(${1 + volumeLevel / 150})` }}
                />
                <div className="absolute -inset-4 rounded-full border-2 border-emerald-500/40 animate-pulse" />
              </>
            )}

            {status === 'speaking' && (
              <>
                <div className="absolute inset-0 rounded-full bg-cyan-500/30 animate-ping duration-700" />
                <div className="absolute -inset-6 rounded-full border-2 border-cyan-400/50 animate-pulse" />
              </>
            )}

            {status === 'thinking' && (
              <div className="absolute -inset-6 rounded-full border-2 border-dashed border-purple-500/60 animate-spin duration-3000" />
            )}

            {/* Core Orb Center */}
            <div
              className={`w-36 h-36 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl ${
                status === 'listening'
                  ? 'bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-500 shadow-emerald-500/50 scale-105 group-hover:scale-110'
                  : status === 'speaking'
                  ? 'bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 shadow-cyan-500/60 scale-110'
                  : status === 'thinking'
                  ? 'bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-600 shadow-purple-500/50 animate-pulse'
                  : 'bg-gradient-to-tr from-slate-700 to-slate-800 shadow-slate-900/50 group-hover:scale-105'
              }`}
            >
              {status === 'thinking' ? (
                <RefreshCw size={44} className="text-white animate-spin" />
              ) : status === 'speaking' ? (
                <Volume2 size={48} className="text-white animate-bounce" />
              ) : status === 'listening' ? (
                <div className="flex flex-col items-center gap-1">
                  <Mic size={40} className="text-white animate-pulse" />
                  <span className="text-[10px] text-emerald-100 font-bold uppercase tracking-wider">Tap to Send</span>
                </div>
              ) : (
                <Mic size={44} className="text-white" />
              )}
            </div>
          </button>

          {/* Status Headline */}
          <div className="text-center space-y-1">
            <h4 className="text-lg font-extrabold text-white tracking-wide">
              {status === 'listening'
                ? 'Listening... Speak naturally'
                : status === 'thinking'
                ? 'Suhbatdosh AI is thinking...'
                : status === 'speaking'
                ? 'Suhbatdosh AI is speaking...'
                : 'Tap Orb to Start Practice'}
            </h4>
            <p className="text-xs text-slate-400 font-medium">
              {status === 'listening'
                ? 'Stops automatically when you finish speaking'
                : status === 'thinking'
                ? 'Preparing your level-adapted response'
                : status === 'speaking'
                ? 'Listening after AI finishes'
                : 'Voice mode active'}
            </p>
          </div>

          {errorMsg && (
            <div className="px-4 py-2 rounded-xl bg-red-950/50 border border-red-500/40 text-xs text-red-300 font-medium text-center max-w-xs">
              ⚠️ {errorMsg}
            </div>
          )}
        </div>

        {/* Bottom Control Bar */}
        <div className="w-full flex items-center justify-center gap-6 z-10">
          {/* Mute/Mic Toggle */}
          <button
            onClick={() => {
              if (isMuted) {
                setIsMuted(false);
                startRecording();
              } else {
                setIsMuted(true);
                stopRecording();
                setStatus('idle');
              }
              tapHaptic('medium');
            }}
            className={`p-4 rounded-full border transition-all ${
              isMuted
                ? 'bg-red-500/20 border-red-500 text-red-400'
                : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
            }`}
            title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
          >
            {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
          </button>

          {/* Instant Send Button when listening */}
          {status === 'listening' && (
            <button
              onClick={() => stopRecording()}
              className="p-4 rounded-full bg-cyan-600 text-white font-bold hover:bg-cyan-500 shadow-lg shadow-cyan-600/30 transition-transform active:scale-95 flex items-center justify-center"
              title="Send speech immediately"
            >
              <Send size={24} />
            </button>
          )}

          {/* Big Red End Practice Button */}
          <button
            onClick={handleEndSession}
            className="px-8 py-4 rounded-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-sm tracking-wide shadow-lg shadow-red-600/30 flex items-center gap-2.5 transition-transform active:scale-95"
          >
            <PhoneOff size={20} />
            <span>Tugatish</span>
          </button>
        </div>

      </div>
    </div>
  );
}
