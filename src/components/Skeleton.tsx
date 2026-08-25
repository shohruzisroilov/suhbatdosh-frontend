import React from 'react';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  circle?: boolean;
  size?: number;
  radius?: string | number;
  style?: React.CSSProperties;
}

export default function Skeleton({
  width = '100%',
  height = 12,
  circle = false,
  size,
  radius,
  style = {},
}: SkeletonProps) {
  const dim = circle ? (size ?? 40) : undefined;
  return (
    <span
      className="skeleton"
      style={{
        width: circle ? dim : width,
        height: circle ? dim : height,
        borderRadius: circle ? '50%' : (radius ?? 'var(--radius-sm)'),
        ...style,
      }}
    />
  );
}
