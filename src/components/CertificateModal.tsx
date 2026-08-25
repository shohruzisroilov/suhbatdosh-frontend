import React, { useRef, useEffect } from 'react';
import { Download, Share2, X, Award } from 'lucide-react';
import { tapHaptic, notifyHaptic } from '../utils/haptics';
import { User, IeltsFeedback } from '../types';

const BOT_HANDLE = (import.meta.env.VITE_BOT_USERNAME as string) || 'suhbatdosh_app_bot';
const BOT_URL = `https://t.me/${BOT_HANDLE}`;

interface CertificateModalProps {
  user?: User | null;
  feedback?: IeltsFeedback | null;
  onClose: () => void;
}

export default function CertificateModal({ user, feedback, onClose }: CertificateModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const overall = feedback?.overall || '6.5';
  const userName = user?.displayName || user?.username || 'Suhbatdosh Candidate';
  const dateStr = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const subScores = [
    { label: 'Fluency & Coherence', score: feedback?.fluency?.band || overall },
    { label: 'Lexical Resource', score: feedback?.lexical?.band || overall },
    { label: 'Grammar & Accuracy', score: feedback?.grammar?.band || overall },
    { label: 'Pronunciation', score: feedback?.pronunciation?.band || overall },
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 1080;
    const height = 1920;

    canvas.width = width;
    canvas.height = height;

    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#0B0F19');
    bgGrad.addColorStop(0.5, '#111827');
    bgGrad.addColorStop(1, '#070A12');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const orb1 = ctx.createRadialGradient(250, 350, 10, 250, 350, 500);
    orb1.addColorStop(0, 'rgba(42, 171, 238, 0.25)');
    orb1.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = orb1;
    ctx.beginPath();
    ctx.arc(250, 350, 500, 0, Math.PI * 2);
    ctx.fill();

    const orb2 = ctx.createRadialGradient(850, 1300, 10, 850, 1300, 550);
    orb2.addColorStop(0, 'rgba(233, 135, 63, 0.20)');
    orb2.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = orb2;
    ctx.beginPath();
    ctx.arc(850, 1300, 550, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 3;
    drawRoundedRect(ctx, 80, 100, 920, 1720, 48);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = 'rgba(42, 171, 238, 0.3)';
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, 100, 120, 880, 1680, 40);
    ctx.stroke();
    ctx.restore();

    ctx.font = 'bold 34px sans-serif';
    ctx.fillStyle = '#2AABEE';
    ctx.textAlign = 'center';
    ctx.fillText('SUHBATDOSH AI MOCK EXAM', 540, 220);

    ctx.font = '600 24px sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillText('OFFICIAL SPEAKING TEST CERTIFICATE', 540, 265);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(180, 310);
    ctx.lineTo(900, 310);
    ctx.stroke();

    ctx.font = '500 26px sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText('THIS CERTIFICATE IS AWARDED TO', 540, 380);

    ctx.font = 'bold 56px sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(userName, 540, 450);

    ctx.font = '500 24px sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fillText(`Tested on ${dateStr}`, 540, 495);

    const badgeGrad = ctx.createLinearGradient(240, 560, 840, 920);
    badgeGrad.addColorStop(0, 'rgba(42, 171, 238, 0.2)');
    badgeGrad.addColorStop(1, 'rgba(233, 135, 63, 0.18)');
    ctx.fillStyle = badgeGrad;
    ctx.strokeStyle = 'rgba(42, 171, 238, 0.5)';
    ctx.lineWidth = 3;
    drawRoundedRect(ctx, 240, 550, 600, 360, 36);
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 30px sans-serif';
    ctx.fillStyle = '#2AABEE';
    ctx.fillText('OVERALL BAND SCORE', 540, 630);

    ctx.font = 'bold 150px sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(42, 171, 238, 0.6)';
    ctx.shadowBlur = 30;
    ctx.fillText(String(overall), 540, 780);
    ctx.shadowBlur = 0;

    ctx.font = 'bold 28px sans-serif';
    ctx.fillStyle = '#E9873F';
    ctx.fillText('CEFR / IELTS EVALUATED', 540, 855);

    const gridY = 980;
    const gridItems = [
      { label: 'Fluency & Coherence', score: subScores[0].score, x: 180, y: gridY },
      { label: 'Lexical Resource', score: subScores[1].score, x: 560, y: gridY },
      { label: 'Grammar Accuracy', score: subScores[2].score, x: 180, y: gridY + 180 },
      { label: 'Pronunciation', score: subScores[3].score, x: 560, y: gridY + 180 },
    ];

    gridItems.forEach((item) => {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 2;
      drawRoundedRect(ctx, item.x, item.y, 340, 150, 24);
      ctx.fill();
      ctx.stroke();

      ctx.font = '500 22px sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.textAlign = 'left';
      ctx.fillText(item.label, item.x + 24, item.y + 55);

      ctx.font = 'bold 48px sans-serif';
      ctx.fillStyle = '#2AABEE';
      ctx.fillText(String(item.score), item.x + 24, item.y + 118);
    });

    ctx.textAlign = 'center';
    ctx.font = '600 26px sans-serif';
    ctx.fillStyle = '#35C88A';
    ctx.fillText('AI Examiner Verified • IELTS Band Descriptor', 540, 1430);

    ctx.font = '500 24px sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillText('Practise English every day with real partners', 540, 1480);

    ctx.fillStyle = 'rgba(42, 171, 238, 0.12)';
    ctx.strokeStyle = 'rgba(42, 171, 238, 0.4)';
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, 220, 1540, 640, 110, 28);
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 36px sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`Telegram: @${BOT_HANDLE}`, 540, 1610);
  }, [user, feedback, overall, userName, dateStr]);

  const handleDownload = () => {
    tapHaptic('medium');
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const fileName = `Suhbatdosh_IELTS_Band_${overall}.png`;

      const file = new File([blob], fileName, { type: 'image/png' });
      if ((navigator as any).canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'IELTS Speaking result' });
          notifyHaptic('success');
          return;
        } catch (err: any) {
          if (err?.name === 'AbortError') return;
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      notifyHaptic('success');
    }, 'image/png');
  };

  const handleShare = () => {
    tapHaptic('medium');
    const shareText = `I took an IELTS Speaking Mock on Suhbatdosh and got Band ${overall}!\nTest your score now: @${BOT_HANDLE}`;

    const tg = (window as any).Telegram?.WebApp;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(
        `https://t.me/share/url?url=${encodeURIComponent(BOT_URL)}&text=${encodeURIComponent(shareText)}`
      );
    } else if (navigator.share) {
      navigator
        .share({
          title: 'IELTS Speaking Certificate',
          text: shareText,
          url: BOT_URL,
        })
        .catch(() => {});
    } else {
      navigator.clipboard?.writeText(shareText);
      alert('Certificate link copied! Share it on Telegram or Instagram Story.');
    }
  };

  return (
    <div className="cert-overlay fade-in">
      <div className="cert-modal scale-in">
        <header className="cert-modal__head">
          <div className="cert-modal__title">
            <Award size={20} className="text-accent" />
            <span>IELTS Certificate (Story / Post)</span>
          </div>
          <button className="cert-modal__close" onClick={onClose}>
            <X size={20} />
          </button>
        </header>

        <div className="cert-modal__preview">
          <canvas ref={canvasRef} className="cert-canvas" />
        </div>

        <footer className="cert-modal__foot">
          <button className="cert-btn cert-btn--primary" onClick={handleDownload}>
            <Download size={18} />
            <span>Download Certificate (PNG)</span>
          </button>
          <button className="cert-btn cert-btn--secondary" onClick={handleShare}>
            <Share2 size={18} />
            <span>Share to Story / Post</span>
          </button>
        </footer>
      </div>

      <style>{`
        .cert-overlay {
          position: fixed; inset: 0; z-index: 9999;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(12px);
          display: flex; align-items: center; justify-content: center;
          padding: var(--space-4);
        }
        .cert-modal {
          width: 100%; max-width: 420px; max-height: 90vh;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          display: flex; flex-direction: column;
          overflow: hidden;
          box-shadow: 0 20px 50px rgba(0,0,0,0.6);
        }
        .cert-modal__head {
          display: flex; align-items: center; justify-content: space-between;
          padding: var(--space-3) var(--space-4);
          border-bottom: 1px solid var(--border);
        }
        .cert-modal__title {
          display: flex; align-items: center; gap: var(--space-2);
          font-size: var(--text-base); font-weight: var(--weight-bold);
          color: var(--text-primary);
        }
        .cert-modal__close {
          color: var(--text-secondary);
          padding: var(--space-1); border-radius: var(--radius-full);
          transition: background 0.12s;
        }
        .cert-modal__close:active { background: var(--surface-2); }

        .cert-modal__preview {
          flex: 1; min-height: 0; overflow-y: auto;
          padding: var(--space-4);
          display: flex; justify-content: center; align-items: center;
          background: #060911;
        }
        .cert-canvas {
          width: 100%; max-width: 320px; height: auto;
          border-radius: 16px;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .cert-modal__foot {
          padding: var(--space-4);
          display: flex; flex-direction: column; gap: var(--space-2);
          border-top: 1px solid var(--border);
          background: var(--bg);
        }
        .cert-btn {
          width: 100%; min-height: 48px;
          display: flex; align-items: center; justify-content: center; gap: var(--space-2);
          border-radius: var(--radius-md);
          font-size: var(--text-base); font-weight: var(--weight-bold);
          transition: transform 0.1s, opacity 0.12s;
        }
        .cert-btn:active { transform: scale(0.98); opacity: 0.9; }
        .cert-btn--primary {
          background: var(--grad-primary); color: var(--btn-text);
          box-shadow: 0 4px 14px rgba(42, 171, 238, 0.3);
        }
        .cert-btn--secondary {
          background: var(--surface-2); color: var(--text-primary);
          border: 1px solid var(--border);
        }
      `}</style>
    </div>
  );
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
