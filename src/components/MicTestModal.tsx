import React, { useState, useEffect, useRef } from 'react';
import Modal from './Modal';
import { Mic, Volume2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { notifyHaptic, tapHaptic } from '../utils/haptics';

interface MicTestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MicTestModal({ isOpen, onClose }: MicTestModalProps) {
  const [status, setStatus] = useState<'requesting' | 'listening' | 'ok' | 'denied'>('requesting');
  const [volume, setVolume] = useState(0);
  const [bars, setBars] = useState<number[]>(new Array(16).fill(4));

  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number | null>(null);
  const soundDetectedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      cleanup();
      return;
    }

    startMicTest();

    return () => {
      cleanup();
    };
  }, [isOpen]);

  function cleanup() {
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setVolume(0);
    setBars(new Array(16).fill(4));
    soundDetectedRef.current = false;
  }

  async function startMicTest() {
    setStatus('requesting');
    soundDetectedRef.current = false;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Unsupported');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioCtxRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.8;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      setStatus('listening');

      function checkAudio() {
        if (!isOpen) return;
        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        const newBars: number[] = [];
        for (let i = 0; i < 16; i++) {
          const val = dataArray[i] || 0;
          sum += val;
          // Scale 0-255 to 4px-48px height
          const barHeight = Math.max(4, Math.round((val / 255) * 44));
          newBars.push(barHeight);
        }

        const avg = Math.round(sum / 16);
        const normVol = Math.min(100, Math.round((avg / 128) * 100));
        setVolume(normVol);
        setBars(newBars);

        if (normVol > 12 && !soundDetectedRef.current) {
          soundDetectedRef.current = true;
          setStatus('ok');
          notifyHaptic('success');
        }

        animRef.current = requestAnimationFrame(checkAudio);
      }

      animRef.current = requestAnimationFrame(checkAudio);
    } catch {
      setStatus('denied');
      notifyHaptic('error');
    }
  }

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="mic-test-sheet">
      <div className="mic-test-container">
        <div className="mic-test-head">
          <div className="mic-test-badge">
            <Mic size={16} />
            <span>Microphone Test</span>
          </div>
          <button
            type="button"
            className="mic-test-close"
            onClick={() => {
              tapHaptic('light');
              onClose();
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="mic-test-body">
          {status === 'requesting' && (
            <div className="mic-test-status requesting">
              <span className="mic-test-spinner" />
              <p>Connecting to microphone…</p>
            </div>
          )}

          {status === 'denied' && (
            <div className="mic-test-status denied">
              <AlertCircle size={36} className="text-danger" />
              <h4>Microphone access denied</h4>
              <p>Please allow microphone access in Telegram or browser settings.</p>
              <button
                type="button"
                className="btn-primary mt-3"
                onClick={() => {
                  tapHaptic('medium');
                  startMicTest();
                }}
              >
                Try Again
              </button>
            </div>
          )}

          {(status === 'listening' || status === 'ok') && (
            <div className="mic-test-active">
              <div className="mic-visualizer-bars">
                {bars.map((h, i) => (
                  <span
                    key={i}
                    className={`mic-bar ${status === 'ok' ? 'ok' : ''}`}
                    style={{ height: `${h}px` }}
                  />
                ))}
              </div>

              <div className="mic-volume-track">
                <div
                  className={`mic-volume-fill ${status === 'ok' ? 'ok' : ''}`}
                  style={{ width: `${Math.max(5, volume)}%` }}
                />
              </div>

              <div className="mic-state-label">
                {status === 'ok' ? (
                  <span className="mic-tag ok">
                    <CheckCircle2 size={16} />
                    <span>Microphone is working great!</span>
                  </span>
                ) : (
                  <span className="mic-tag listening">
                    <Volume2 size={16} />
                    <span>Say something into your microphone…</span>
                  </span>
                )}
              </div>

              <p className="mic-test-hint">
                Volume: <strong>{volume}%</strong> · Your voice will be clear during calls.
              </p>

              <button
                type="button"
                className="btn-primary w-full mt-4"
                onClick={() => {
                  tapHaptic('light');
                  onClose();
                }}
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .mic-test-sheet {
          width: 100%; max-width: 380px; margin: 0 auto;
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-xl); padding: 20px;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4);
        }
        .mic-test-container { display: flex; flex-direction: column; gap: 16px; }
        .mic-test-head {
          display: flex; align-items: center; justify-content: space-between;
        }
        .mic-test-badge {
          display: inline-flex; align-items: center; gap: 6px;
          background: var(--primary-subtle); color: var(--primary);
          padding: 6px 12px; border-radius: var(--radius-full);
          font-size: 12px; font-weight: var(--weight-bold);
          text-transform: uppercase; letter-spacing: 0.05em;
        }
        .mic-test-close {
          background: var(--surface-2); border: 1px solid var(--border);
          color: var(--text-secondary); width: 32px; height: 32px;
          border-radius: 50%; display: flex; align-items: center; justify-content: center;
          cursor: pointer;
        }
        .mic-test-body { text-align: center; }
        .mic-test-status {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 12px; padding: 24px 12px;
        }
        .mic-test-status.denied h4 {
          font-size: 16px; font-weight: var(--weight-bold); color: var(--text-primary);
        }
        .mic-test-status.denied p {
          font-size: 13px; color: var(--text-secondary); line-height: 1.4;
        }
        .mic-test-spinner {
          width: 36px; height: 36px; border-radius: 50%;
          border: 3px solid var(--border); border-top-color: var(--primary);
          animation: spin 0.8s linear infinite;
        }
        .mic-test-active {
          display: flex; flex-direction: column; align-items: center; gap: 14px;
          padding: 10px 0;
        }
        .mic-visualizer-bars {
          display: flex; align-items: center; justify-content: center; gap: 4px;
          height: 52px; width: 100%;
        }
        .mic-bar {
          width: 8px; border-radius: 4px; background: var(--border-strong);
          transition: height 0.05s ease, background-color 0.2s ease;
        }
        .mic-bar.ok {
          background: var(--primary);
          box-shadow: 0 0 10px rgba(0, 168, 255, 0.4);
        }
        .mic-volume-track {
          width: 100%; height: 8px; border-radius: var(--radius-full);
          background: var(--surface-2); border: 1px solid var(--border);
          overflow: hidden;
        }
        .mic-volume-fill {
          height: 100%; background: var(--grad-primary); border-radius: var(--radius-full);
          transition: width 0.08s ease;
        }
        .mic-volume-fill.ok {
          background: linear-gradient(90deg, #00A8FF, #34C759);
        }
        .mic-tag {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 14px; border-radius: var(--radius-full);
          font-size: 13px; font-weight: var(--weight-bold);
        }
        .mic-tag.listening {
          background: var(--surface-2); color: var(--text-secondary);
        }
        .mic-tag.ok {
          background: rgba(52, 199, 89, 0.15); color: var(--success);
          border: 1px solid rgba(52, 199, 89, 0.3);
        }
        .mic-test-hint {
          font-size: 12px; color: var(--text-tertiary);
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </Modal>
  );
}
