import React, { useState, useRef, useEffect } from 'react';
import { X, Mic, Send, Volume2, Sparkles, AlertCircle, BookOpen, CheckCircle2, RefreshCw } from 'lucide-react';
import { sendAIPartnerTurn } from '../api/endpoints';
import { tapHaptic, notifyHaptic } from '../utils/haptics';

interface MessageItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  transcription?: string;
  corrections?: Array<{ original: string; corrected: string; explanation: string }>;
  vocabularyTips?: Array<{ word: string; meaning: string; example: string }>;
}

interface AIPartnerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AIPartnerModal({ isOpen, onClose }: AIPartnerModalProps) {
  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: 'init-1',
      role: 'assistant',
      content: "Hello! I'm your AI Speaking Partner & Examiner. What topic would you like to practice today, or shall we start with everyday life?",
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  if (!isOpen) return null;

  function speakText(text: string) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    }
  }

  async function handleSendTurn(params: { text?: string; audioBase64?: string; audioMimeType?: string }) {
    if (loading) return;
    setErrorMsg(null);
    setLoading(true);
    tapHaptic('medium');

    const historyPayload = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const res = await sendAIPartnerTurn({
        text: params.text,
        audioBase64: params.audioBase64,
        audioMimeType: params.audioMimeType,
        history: historyPayload,
      });

      const userText = res.transcription || params.text || 'Audio message';

      // 1. Add User Message
      const userMsgItem: MessageItem = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: userText,
      };

      // 2. Add AI Assistant Message
      const aiMsgItem: MessageItem = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: res.aiResponse,
        corrections: res.corrections,
        vocabularyTips: res.vocabularyTips,
      };

      setMessages((prev) => [...prev, userMsgItem, aiMsgItem]);
      speakText(res.aiResponse);
      notifyHaptic('success');
    } catch (err: any) {
      console.error('[AI Partner Error]:', err);
      const msg = err?.response?.data?.error || err?.message || 'AI bilan muloqotda xatolik yuz berdi.';
      setErrorMsg(msg);
      notifyHaptic('error');
    } finally {
      setLoading(false);
      setInputText('');
    }
  }

  async function startRecording() {
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

        // Convert blob to base64
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Data = (reader.result as string).split(',')[1];
          handleSendTurn({ audioBase64: base64Data, audioMimeType: 'audio/webm' });
        };
      };

      mediaRecorder.start();
      setIsRecording(true);
      tapHaptic('heavy');
    } catch {
      setErrorMsg("Mikrofonga ruxsat berilmadi yoki u qo'llab-quvvatlanmaydi.");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      tapHaptic('medium');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md fade-in">
      <div className="relative w-full max-w-lg h-[90vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-3xl overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-800/80 border-b border-slate-700/60 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="font-bold text-white text-base leading-tight">AI Speaking Partner</h3>
              <p className="text-xs text-cyan-400 font-medium">Real-time Grammar & IELTS Feedback</p>
            </div>
          </div>
          <button
            onClick={() => {
              if ('speechSynthesis' in window) window.speechSynthesis.cancel();
              onClose();
            }}
            className="p-2 text-slate-400 hover:text-white rounded-full bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} gap-1`}
            >
              <div
                className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-medium rounded-tr-none shadow-md shadow-blue-500/10'
                    : 'bg-slate-800/90 border border-slate-700/80 text-slate-100 rounded-tl-none shadow-sm'
                }`}
              >
                <p>{msg.content}</p>

                {/* Speaker button for AI */}
                {msg.role === 'assistant' && (
                  <button
                    onClick={() => speakText(msg.content)}
                    className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-700/60 hover:bg-slate-700 text-xs font-semibold text-cyan-300 transition-colors"
                  >
                    <Volume2 size={13} />
                    <span>Eshitish</span>
                  </button>
                )}
              </div>

              {/* Grammar Corrections Card */}
              {msg.corrections && msg.corrections.length > 0 && (
                <div className="w-[85%] mt-1.5 p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/40 text-xs text-amber-200 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-amber-400 uppercase tracking-wider text-[10px]">
                    <AlertCircle size={13} />
                    <span>Grammatika va Talaffuz Xatolari:</span>
                  </div>
                  {msg.corrections.map((corr, idx) => (
                    <div key={idx} className="space-y-1 bg-amber-900/20 p-2.5 rounded-lg border border-amber-500/20">
                      <p className="line-through text-red-300/80 font-mono">❌ "{corr.original}"</p>
                      <p className="text-emerald-300 font-semibold font-mono">✅ "{corr.corrected}"</p>
                      <p className="text-[11px] text-amber-200/80 italic">{corr.explanation}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Vocabulary Tips */}
              {msg.vocabularyTips && msg.vocabularyTips.length > 0 && (
                <div className="w-[85%] mt-1.5 p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-xs text-emerald-200 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-400 uppercase tracking-wider text-[10px]">
                    <BookOpen size={13} />
                    <span>IELTS Band 7.5+ So'z boyligi:</span>
                  </div>
                  {msg.vocabularyTips.map((tip, idx) => (
                    <div key={idx} className="bg-emerald-900/20 p-2.5 rounded-lg border border-emerald-500/20 space-y-0.5">
                      <p className="font-bold text-emerald-300">{tip.word} <span className="font-normal text-emerald-200/70">— {tip.meaning}</span></p>
                      <p className="text-[11px] text-slate-300 italic">"{tip.example}"</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 w-fit text-xs font-semibold text-cyan-300">
              <RefreshCw size={14} className="animate-spin text-cyan-400" />
              <span>AI Partner tahlil qilmoqda...</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-xs text-red-300 font-medium">
              ⚠️ {errorMsg}
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Controls / Inputs Footer */}
        <div className="p-4 bg-slate-800/90 border-t border-slate-700/80 space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Inglizcha matn yozing yoki mikrofondan foydalaning..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && inputText.trim()) {
                  handleSendTurn({ text: inputText.trim() });
                }
              }}
              disabled={loading || isRecording}
              className="flex-1 h-11 px-4 text-xs text-white bg-slate-900 border border-slate-700 rounded-xl focus:outline-none focus:border-cyan-500 transition-colors"
            />
            {inputText.trim() ? (
              <button
                onClick={() => handleSendTurn({ text: inputText.trim() })}
                disabled={loading}
                className="h-11 px-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold rounded-xl flex items-center justify-center transition-transform active:scale-95 shadow-md shadow-cyan-500/20"
              >
                <Send size={16} />
              </button>
            ) : (
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={loading}
                className={`h-11 px-4 font-bold rounded-xl flex items-center justify-center gap-2 text-xs transition-all active:scale-95 ${
                  isRecording
                    ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse shadow-lg shadow-red-600/30'
                    : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-600/20'
                }`}
              >
                <Mic size={16} />
                <span>{isRecording ? 'Yozilmoqda...' : 'Ovozli Mashq'}</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
