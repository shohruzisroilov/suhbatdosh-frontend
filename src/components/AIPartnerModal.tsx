import React, { useState, useRef, useEffect } from 'react';
import { X, Mic, MicOff, PhoneOff, Sparkles, RefreshCw, Volume2 } from 'lucide-react';
import { sendAIPartnerTurn, getTTSAudio } from '../api/endpoints';
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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const isComponentMounted = useRef(true);

  useEffect(() => {
    isComponentMounted.current = true;
    if (isOpen) {
      // Auto start recording when opened
      startRecording();
    } else {
      stopRecording();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    }
    return () => {
      isComponentMounted.current = false;
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, [isOpen]);

  if (!isOpen) return null;

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
      const msg = err?.response?.data?.error || err?.message || 'Suhbatdosh AI connection issue. Retrying...';
      setErrorMsg(msg);
      notifyHaptic('error');
      setStatus('idle');
    }
  }

  async function startRecording() {
    if (isMuted) {
      setStatus('idle');
      return;
    }
    try {
      setErrorMsg(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach((t) => t.stop());

        if (audioBlob.size > 100) {
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
      setErrorMsg('Microphone access was denied.');
      setStatus('idle');
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }

  function handleEndSession() {
    stopRecording();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
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

        {/* Center: ChatGPT Voice Orb Visualizer */}
        <div className="relative flex flex-col items-center justify-center my-auto z-10 space-y-8">
          
          {/* Animated Glowing Orb Container */}
          <div className="relative flex items-center justify-center w-48 h-48">
            
            {/* Outer Ripple Aura Rings */}
            {status === 'listening' && (
              <>
                <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping duration-1000" />
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
              className={`w-36 h-36 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl ${
                status === 'listening'
                  ? 'bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-500 shadow-emerald-500/50 scale-105'
                  : status === 'speaking'
                  ? 'bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 shadow-cyan-500/60 scale-110'
                  : status === 'thinking'
                  ? 'bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-600 shadow-purple-500/50 animate-pulse'
                  : 'bg-gradient-to-tr from-slate-700 to-slate-800 shadow-slate-900/50'
              }`}
            >
              {status === 'thinking' ? (
                <RefreshCw size={44} className="text-white animate-spin" />
              ) : status === 'speaking' ? (
                <Volume2 size={48} className="text-white animate-bounce" />
              ) : (
                <Mic size={48} className={`text-white ${status === 'listening' ? 'animate-pulse' : ''}`} />
              )}
            </div>
          </div>

          {/* Status Headline */}
          <div className="text-center space-y-1">
            <h4 className="text-lg font-extrabold text-white tracking-wide">
              {status === 'listening'
                ? 'Listening to you...'
                : status === 'thinking'
                ? 'Suhbatdosh AI is thinking...'
                : status === 'speaking'
                ? 'Suhbatdosh AI is speaking...'
                : 'Tap Mic to Start Practice'}
            </h4>
            <p className="text-xs text-slate-400 font-medium">
              {status === 'listening'
                ? 'Speak naturally in English'
                : status === 'thinking'
                ? 'Generating intelligent response'
                : status === 'speaking'
                ? 'Listen & reply naturally'
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
