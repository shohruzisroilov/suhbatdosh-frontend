import React, { useState, useRef, useEffect } from 'react';
import { X, Mic, Send, Volume2, Sparkles, RefreshCw } from 'lucide-react';
import { sendAIPartnerTurn, getTTSAudio } from '../api/endpoints';
import { tapHaptic, notifyHaptic } from '../utils/haptics';

interface MessageItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
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
      content: "Hello! I'm your AI Speaking Partner. Let's have a friendly conversation to practice your English! How are you doing today?",
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ttsLoadingId, setTtsLoadingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  if (!isOpen) return null;

  async function speakText(text: string, msgId: string) {
    tapHaptic('light');
    setTtsLoadingId(msgId);
    try {
      const res = await getTTSAudio(text);
      if (res?.ok && res?.audioUrl) {
        const audio = new Audio(res.audioUrl);
        audio.play();
        setTtsLoadingId(null);
        return;
      }
    } catch {
      // Fallback to browser SpeechSynthesis
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    }
    setTtsLoadingId(null);
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

      const userMsgItem: MessageItem = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: userText,
      };

      const aiMsgItem: MessageItem = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: res.aiResponse,
      };

      setMessages((prev) => [...prev, userMsgItem, aiMsgItem]);
      speakText(res.aiResponse, aiMsgItem.id);
      notifyHaptic('success');
    } catch (err: any) {
      console.error('[AI Partner Error]:', err);
      const msg = err?.response?.data?.error || err?.message || 'Suhbatdosh AI is currently unavailable. Please try again.';
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
      setErrorMsg('Microphone access was denied or is not supported.');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md fade-in">
      <div className="relative w-full max-w-lg h-[88vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-3xl overflow-hidden shadow-2xl">
        
        {/* Simple Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-800/90 border-b border-slate-700/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="font-bold text-white text-base leading-tight">AI Speaking Partner</h3>
              <p className="text-xs text-cyan-400 font-medium">Natural Conversation Practice</p>
            </div>
          </div>

          <button
            onClick={() => {
              if ('speechSynthesis' in window) window.speechSynthesis.cancel();
              onClose();
            }}
            className="p-2 text-slate-400 hover:text-white rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Clean Messages List */}
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

                {/* Listen Voice button for AI */}
                {msg.role === 'assistant' && (
                  <button
                    onClick={() => speakText(msg.content, msg.id)}
                    disabled={ttsLoadingId === msg.id}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-700/70 hover:bg-slate-700 text-xs font-semibold text-cyan-300 transition-colors"
                  >
                    {ttsLoadingId === msg.id ? (
                      <RefreshCw size={12} className="animate-spin text-cyan-400" />
                    ) : (
                      <Volume2 size={13} />
                    )}
                    <span>Listen Voice</span>
                  </button>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 w-fit text-xs font-semibold text-cyan-300">
              <RefreshCw size={14} className="animate-spin text-cyan-400" />
              <span>AI is thinking & listening...</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-xs text-red-300 font-medium">
              ⚠️ {errorMsg}
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Simple Controls / Inputs Footer */}
        <div className="p-4 bg-slate-800/90 border-t border-slate-700/80 space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Type in English or tap microphone..."
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
                <span>{isRecording ? 'Recording...' : 'Voice Practice'}</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
