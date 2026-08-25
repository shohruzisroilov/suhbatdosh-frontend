import React, { useState } from 'react';

const COLORS = [
  '#2481cc', '#34c759', '#ff9500', '#ff3b30',
  '#af52de', '#5856d6', '#00a8ff', '#30d158'
];

interface AvatarProps {
  name?: string;
  avatarUrl?: string;
  size?: number;
}

export default function Avatar({ name, avatarUrl, size = 40 }: AvatarProps) {
  const [imgError, setImgError] = useState(false);

  const initials = name
    ? name
        .split(' ')
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?';

  const colorIndex = name ? name.charCodeAt(0) % COLORS.length : 0;

  const baseStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  };

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt={name || 'Avatar'}
        style={{ ...baseStyle, objectFit: 'cover' }}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div
      aria-label={name}
      style={{
        ...baseStyle,
        background: `linear-gradient(135deg, ${COLORS[colorIndex]}, ${COLORS[(colorIndex + 2) % COLORS.length]})`,
        color: '#fff',
        fontSize: size * 0.36,
        fontWeight: 800,
        letterSpacing: '-0.02em',
        textShadow: '0 1px 3px rgba(0,0,0,0.25)',
      }}
    >
      {initials}
    </div>
  );
}
