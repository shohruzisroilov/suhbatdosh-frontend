import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Mic,
  Send,
  Volume2,
  Sparkles,
  AlertCircle,
  BookOpen,
  BookmarkPlus,
  BookmarkCheck,
  RefreshCw,
  Sliders,
  BookMarked,
  Trash2,
  Flame,
  Check,
} from 'lucide-react';
import {
  sendAIPartnerTurn,
  saveVocabularyItem,
  getVocabularyItems,
  deleteVocabularyItem,
  getTTSAudio,
} from '../api/endpoints';
import { tapHaptic, notifyHaptic } from '../utils/haptics';

interface AIPartnerRephrase {
  simpleCorrect?: string;
  band75Style?: string;
  nativeStyle?: string;
}

interface MessageItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  transcription?: string;
  corrections?: Array<{ original: string; corrected: string; explanation: string }>;
  vocabularyTips?: Array<{ word: string; meaning: string; example: string }>;
  rephraseVariations?: AIPartnerRephrase;
}

interface SavedVocabItem {
  id: number;
  word: string;
  meaning: string;
  example: string;
  category: string;
  created_at: string;
}

interface AIPartnerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SPEAKING_MODES = [
  { id: 'general', label: 'General Practice' },
  { id: 'ielts_part1', label: 'IELTS Part 1' },
  { id: 'ielts_part2', label: 'IELTS Part 2 (Cue Card)' },
  { id: 'ielts_part3', label: 'IELTS Part 3 (Discussion)' },
  { id: 'job_interview', label: 'Job Interview' },
];

const TOPICS = [
  'General Conversation',
  'Travel & Tourism',
  'Technology & Future',
  'Work & Studies',
  'Hobbies & Sports',
  'Culture & Food',
];

export default function AIPartnerModal({ isOpen, onClose }: AIPartnerModalProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'notebook'>('chat');
  const [selectedMode, setSelectedMode] = useState<string>('general');
  const [selectedTopic, setSelectedTopic] = useState<string>('General Conversation');
  const [showFilters, setShowFilters] = useState<boolean>(false);

  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: 'init-1',
      role: 'assistant',
      content:
        "Hello! I'm your AI Speaking Partner & IELTS Examiner. Choose a mode or topic above, and let's practice natural speaking!",
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ttsLoadingId, setTtsLoadingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  // Notebook state
  const [notebookItems, setNotebookItems] = useState<SavedVocabItem[]>([]);
  const [loadingNotebook, setLoadingNotebook] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (activeTab === 'chat') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else if (activeTab === 'notebook') {
      fetchNotebook();
    }
  }, [messages, loading, activeTab]);

  if (!isOpen) return null;

  async function fetchNotebook() {
    try {
      setLoadingNotebook(true);
      const res = await getVocabularyItems();
      if (res.ok) {
        setNotebookItems(res.items || []);
      }
    } catch (err) {
      console.error('Failed to fetch vocabulary bank:', err);
    } finally {
      setLoadingNotebook(false);
    }
  }

  async function handleDeleteSavedWord(id: number) {
    tapHaptic('medium');
    try {
      await deleteVocabularyItem(id);
      setNotebookItems((prev) => prev.filter((item) => item.id !== id));
      notifyHaptic('success');
    } catch {
      notifyHaptic('error');
    }
  }

  async function handleSaveWord(item: { word: string; meaning?: string; example?: string; category?: string }, itemKey: string) {
    tapHaptic('light');
    try {
      await saveVocabularyItem(item);
      setSavedIds((prev) => new Set(prev).add(itemKey));
      notifyHaptic('success');
    } catch (err) {
      console.error('Failed to save word:', err);
      notifyHaptic('error');
    }
  }

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
      // Fallback to browser SpeechSynthesis if API fails
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
        topic: selectedTopic !== 'General Conversation' ? selectedTopic : undefined,
        speakingMode: selectedMode,
      });

      const userText = res.transcription || params.text || 'Audio speech message';

      const userMsgItem: MessageItem = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: userText,
      };

      const aiMsgItem: MessageItem = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: res.aiResponse,
        corrections: res.corrections,
        vocabularyTips: res.vocabularyTips,
        rephraseVariations: res.rephraseVariations,
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
      setErrorMsg('Microphone access was denied or is not supported in your browser.');
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
      <div className="relative w-full max-w-lg h-[92vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-3xl overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="px-4 py-3 bg-slate-800/90 border-b border-slate-700/80 backdrop-blur-md space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20">
                <Sparkles size={18} />
              </div>
              <div>
                <h3 className="font-bold text-white text-base leading-tight flex items-center gap-2">
                  AI Speaking Partner
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">PRO</span>
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">IELTS Examiner & Grammar Coach</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2 rounded-xl border transition-colors ${
                  showFilters
                    ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                }`}
                title="Practice Mode & Topic"
              >
                <Sliders size={16} />
              </button>

              <button
                onClick={() => {
                  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
                  onClose();
                }}
                className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Navigation Tabs (Chat vs Notebook) */}
          <div className="flex items-center gap-2 p-1 bg-slate-950/60 rounded-xl border border-slate-800">
            <button
              onClick={() => {
                setActiveTab('chat');
                tapHaptic('light');
              }}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'chat'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles size={13} />
              <span>Practice Chat</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('notebook');
                tapHaptic('light');
              }}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'notebook'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BookMarked size={13} />
              <span>My Notebook</span>
            </button>
          </div>

          {/* Mode & Topic Selector Panel */}
          {showFilters && activeTab === 'chat' && (
            <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Practice Mode</label>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {SPEAKING_MODES.map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => {
                        setSelectedMode(mode.id);
                        tapHaptic('light');
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all border ${
                        selectedMode === mode.id
                          ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Topic</label>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {TOPICS.map((topic) => (
                    <button
                      key={topic}
                      onClick={() => {
                        setSelectedTopic(topic);
                        tapHaptic('light');
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all border ${
                        selectedTopic === topic
                          ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {topic}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tab 1: Chat View */}
        {activeTab === 'chat' && (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} gap-1`}
                >
                  <div
                    className={`max-w-[88%] p-3.5 rounded-2xl text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-medium rounded-tr-none shadow-md shadow-blue-500/10'
                        : 'bg-slate-800/90 border border-slate-700/80 text-slate-100 rounded-tl-none shadow-sm'
                    }`}
                  >
                    <p>{msg.content}</p>

                    {/* Voice audio replay for AI */}
                    {msg.role === 'assistant' && (
                      <button
                        onClick={() => speakText(msg.content, msg.id)}
                        disabled={ttsLoadingId === msg.id}
                        className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-700/60 hover:bg-slate-700 text-xs font-semibold text-cyan-300 transition-colors"
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

                  {/* 3-Tier Rephrase Variations Card */}
                  {msg.rephraseVariations && (
                    <div className="w-[88%] mt-1.5 p-3 rounded-2xl bg-indigo-950/30 border border-indigo-500/40 text-xs text-indigo-200 space-y-2">
                      <div className="flex items-center gap-1.5 font-bold text-indigo-400 uppercase tracking-wider text-[10px]">
                        <Flame size={13} />
                        <span>3 Rephrase Variations:</span>
                      </div>
                      <div className="space-y-1.5">
                        {msg.rephraseVariations.simpleCorrect && (
                          <div className="p-2 rounded-xl bg-emerald-950/40 border border-emerald-500/30">
                            <span className="font-bold text-emerald-400 block text-[10px] uppercase">🟢 Simple & Correct</span>
                            <p className="text-emerald-200 text-xs">{msg.rephraseVariations.simpleCorrect}</p>
                          </div>
                        )}
                        {msg.rephraseVariations.band75Style && (
                          <div className="p-2 rounded-xl bg-cyan-950/40 border border-cyan-500/30">
                            <span className="font-bold text-cyan-400 block text-[10px] uppercase">🔵 IELTS Band 7.5+ Style</span>
                            <p className="text-cyan-200 text-xs">{msg.rephraseVariations.band75Style}</p>
                          </div>
                        )}
                        {msg.rephraseVariations.nativeStyle && (
                          <div className="p-2 rounded-xl bg-purple-950/40 border border-purple-500/30">
                            <span className="font-bold text-purple-400 block text-[10px] uppercase">🟣 Native Speaker Style</span>
                            <p className="text-purple-200 text-xs">{msg.rephraseVariations.nativeStyle}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Grammar Corrections Card */}
                  {msg.corrections && msg.corrections.length > 0 && (
                    <div className="w-[88%] mt-1.5 p-3 rounded-2xl bg-amber-950/30 border border-amber-500/40 text-xs text-amber-200 space-y-2">
                      <div className="flex items-center justify-between font-bold text-amber-400 uppercase tracking-wider text-[10px]">
                        <span className="flex items-center gap-1.5">
                          <AlertCircle size={13} />
                          Grammar Feedback:
                        </span>
                      </div>
                      {msg.corrections.map((corr, idx) => {
                        const itemKey = `corr-${msg.id}-${idx}`;
                        const isSaved = savedIds.has(itemKey);
                        return (
                          <div key={idx} className="bg-amber-900/20 p-2.5 rounded-xl border border-amber-500/20 space-y-1 relative">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="line-through text-red-300/80 font-mono text-[11px]">❌ "{corr.original}"</p>
                                <p className="text-emerald-300 font-semibold font-mono text-xs">✅ "{corr.corrected}"</p>
                              </div>
                              <button
                                onClick={() =>
                                  handleSaveWord(
                                    { word: corr.corrected, meaning: corr.explanation, example: corr.original, category: 'correction' },
                                    itemKey
                                  )
                                }
                                disabled={isSaved}
                                className={`p-1.5 rounded-lg border transition-colors ${
                                  isSaved
                                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                                    : 'bg-amber-900/40 border-amber-500/30 text-amber-300 hover:bg-amber-800/60'
                                }`}
                                title="Save to Notebook"
                              >
                                {isSaved ? <BookmarkCheck size={13} /> : <BookmarkPlus size={13} />}
                              </button>
                            </div>
                            <p className="text-[11px] text-amber-200/80 italic">{corr.explanation}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Vocabulary Tips */}
                  {msg.vocabularyTips && msg.vocabularyTips.length > 0 && (
                    <div className="w-[88%] mt-1.5 p-3 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 text-xs text-emerald-200 space-y-2">
                      <div className="flex items-center justify-between font-bold text-emerald-400 uppercase tracking-wider text-[10px]">
                        <span className="flex items-center gap-1.5">
                          <BookOpen size={13} />
                          Band 7.5+ Vocabulary Tips:
                        </span>
                      </div>
                      {msg.vocabularyTips.map((tip, idx) => {
                        const itemKey = `vocab-${msg.id}-${idx}`;
                        const isSaved = savedIds.has(itemKey);
                        return (
                          <div key={idx} className="bg-emerald-900/20 p-2.5 rounded-xl border border-emerald-500/20 space-y-1">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-bold text-emerald-300 text-xs">
                                  {tip.word} <span className="font-normal text-emerald-200/70">— {tip.meaning}</span>
                                </p>
                              </div>
                              <button
                                onClick={() =>
                                  handleSaveWord(
                                    { word: tip.word, meaning: tip.meaning, example: tip.example, category: 'vocab' },
                                    itemKey
                                  )
                                }
                                disabled={isSaved}
                                className={`p-1.5 rounded-lg border transition-colors ${
                                  isSaved
                                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                                    : 'bg-emerald-900/40 border-emerald-500/30 text-emerald-300 hover:bg-emerald-800/60'
                                }`}
                                title="Save to Notebook"
                              >
                                {isSaved ? <BookmarkCheck size={13} /> : <BookmarkPlus size={13} />}
                              </button>
                            </div>
                            <p className="text-[11px] text-slate-300 italic">"{tip.example}"</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 w-fit text-xs font-semibold text-cyan-300">
                  <RefreshCw size={14} className="animate-spin text-cyan-400" />
                  <span>AI Coach is analyzing & preparing feedback...</span>
                </div>
              )}

              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-xs text-red-300 font-medium">
                  ⚠️ {errorMsg}
                </div>
              )}

              <div ref={chatBottomRef} />
            </div>

            {/* Controls Footer */}
            <div className="p-4 bg-slate-800/90 border-t border-slate-700/80 space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Type English message or tap microphone..."
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
          </>
        )}

        {/* Tab 2: Personal Notebook / Vocabulary Bank View */}
        {activeTab === 'notebook' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <BookMarked size={14} className="text-emerald-400" />
                Saved Vocabulary & Corrections ({notebookItems.length})
              </h4>
              <button
                onClick={fetchNotebook}
                className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <RefreshCw size={13} className={loadingNotebook ? 'animate-spin' : ''} />
              </button>
            </div>

            {loadingNotebook ? (
              <div className="text-center py-12 text-xs text-slate-400 space-y-2">
                <RefreshCw size={20} className="animate-spin text-emerald-400 mx-auto" />
                <p>Loading your notebook...</p>
              </div>
            ) : notebookItems.length === 0 ? (
              <div className="text-center py-12 px-4 rounded-2xl bg-slate-800/40 border border-slate-800 space-y-3">
                <BookOpen size={32} className="text-slate-600 mx-auto" />
                <p className="text-xs font-semibold text-slate-300">Your vocabulary bank is empty!</p>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  Practice chatting with AI Partner and tap ➕ to save Band 7.5+ words and grammar fixes here.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {notebookItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-1.5 relative group hover:border-emerald-500/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span
                          className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full inline-block mb-1 ${
                            item.category === 'correction'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {item.category === 'correction' ? 'Grammar Fix' : 'Vocab Tip'}
                        </span>
                        <h5 className="font-bold text-white text-sm">{item.word}</h5>
                      </div>

                      <button
                        onClick={() => handleDeleteSavedWord(item.id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/40 transition-colors"
                        title="Delete word"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {item.meaning && (
                      <p className="text-xs text-slate-300">{item.meaning}</p>
                    )}

                    {item.example && (
                      <p className="text-[11px] text-slate-400 italic">"{item.example}"</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
