import React from 'react';
import Skeleton from './Skeleton';

interface SkeletonRowProps {
  rank?: boolean;
  avatar?: number;
  trailing?: boolean;
}

export default function SkeletonRow({ rank = false, avatar = 38, trailing = true }: SkeletonRowProps) {
  return (
    <div className="skel-row">
      {rank && <Skeleton width={16} height={16} radius="5px" />}
      <Skeleton circle size={avatar} />
      <div className="skel-row__lines">
        <Skeleton width="52%" height={13} />
        <Skeleton width="30%" height={10} />
      </div>
      {trailing && <Skeleton width={52} height={12} radius="6px" />}

      <style>{`
        .skel-row {
          display: flex; align-items: center; gap: var(--space-3);
          padding: var(--space-3) var(--space-3);
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
        }
        .skel-row__lines {
          flex: 1; display: flex; flex-direction: column; gap: var(--space-1-5); min-width: 0;
        }
      `}</style>
    </div>
  );
}
