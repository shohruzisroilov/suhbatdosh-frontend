import { useCallback, useEffect, useRef, useState } from 'react';

const SpeechRecognitionCtor =
  typeof window !== 'undefined'
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

export function useSpeech({ lang = 'en-US' } = {}) {
  const sttSupported = Boolean(SpeechRecognitionCtor);
  const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [interim, setInterim] = useState('');
  const [micError, setMicError] = useState<'denied' | 'failed' | null>(null);

  const recognitionRef = useRef<any>(null);
  const finalRef = useRef('');
  const onResultRef = useRef<((text: string) => void) | null>(null);
  const onSilenceRef = useRef<(() => void) | null>(null);
  const listeningRef = useRef(false);
  const unlockedRef = useRef(false);
  const speakTokenRef = useRef(0);

  const stop = useCallback(() => {
    onSilenceRef.current = null;
    onResultRef.current = null;
    try {
      recognitionRef.current?.stop();
    } catch {}
  }, []);

  const start = useCallback(
    (onResult: (text: string) => void, onSilence?: () => void) => {
      if (!sttSupported || listeningRef.current) return;

      setMicError(null);
      setInterim('');
      finalRef.current = '';
      onResultRef.current = onResult;
      onSilenceRef.current = onSilence || null;

      const recognition = new SpeechRecognitionCtor();
      recognition.lang = lang;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        let live = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const chunk = event.results[i][0].transcript;
          if (event.results[i].isFinal) finalRef.current += chunk;
          else live += chunk;
        }
        setInterim(live);
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'aborted' || event.error === 'no-speech') return;
        setMicError(
          event.error === 'not-allowed' || event.error === 'service-not-allowed'
            ? 'denied'
            : 'failed'
        );
      };

      recognition.onend = () => {
        listeningRef.current = false;
        setListening(false);
        setInterim('');
        const text = finalRef.current.trim();
        finalRef.current = '';
        recognitionRef.current = null;
        if (text) onResultRef.current?.(text);
        else onSilenceRef.current?.();
      };

      recognition.current = recognition;
      try {
        recognition.start();
        listeningRef.current = true;
        setListening(true);
      } catch {
        recognitionRef.current = null;
        listeningRef.current = false;
        setMicError('failed');
      }
    },
    [sttSupported, lang]
  );

  const cancelSpeech = useCallback(() => {
    if (!ttsSupported) return;
    speakTokenRef.current += 1;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [ttsSupported]);

  const speak = useCallback(
    (text: string, onEnd?: () => void) => {
      if (!ttsSupported || !text) {
        onEnd?.();
        return;
      }

      speakTokenRef.current += 1;
      const token = speakTokenRef.current;
      window.speechSynthesis.cancel();

      const finish = () => {
        if (token !== speakTokenRef.current) return;
        setSpeaking(false);
        onEnd?.();
      };

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = 0.95;

      const voices = window.speechSynthesis.getVoices();
      const preferred =
        voices.find((v) => v.lang === lang) || voices.find((v) => v.lang?.startsWith('en'));
      if (preferred) utterance.voice = preferred;

      utterance.onstart = () => {
        if (token === speakTokenRef.current) setSpeaking(true);
      };
      utterance.onend = finish;
      utterance.onerror = finish;

      window.speechSynthesis.speak(utterance);
    },
    [ttsSupported, lang]
  );

  const unlockAudio = useCallback(() => {
    if (!ttsSupported || unlockedRef.current) return;
    unlockedRef.current = true;
    try {
      const silent = new SpeechSynthesisUtterance('');
      silent.volume = 0;
      window.speechSynthesis.speak(silent);
    } catch {}
  }, [ttsSupported]);

  useEffect(
    () => () => {
      try {
        recognitionRef.current?.abort();
      } catch {}
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    },
    []
  );

  return {
    sttSupported,
    ttsSupported,
    listening,
    speaking,
    interim,
    micError,
    start,
    stop,
    speak,
    cancelSpeech,
    unlockAudio,
  };
}
