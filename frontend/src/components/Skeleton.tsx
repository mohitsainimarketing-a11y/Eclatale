import React from 'react';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  circle?: boolean;
  style?: React.CSSProperties;
}

export default function Skeleton({ className = '', width, height, circle, style }: SkeletonProps) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{
        width,
        height,
        borderRadius: circle ? '50%' : undefined,
        ...style,
      }}
    />
  );
}

export function SkeletonCard({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl p-5 ${className}`} style={{ border: '1.5px solid #EDE8FF' }}>
      <Skeleton height={16} className="mb-3" style={{ width: '60%' }} />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height={12} className="mb-2" style={{ width: i === lines - 1 ? '45%' : '100%' }} />
      ))}
    </div>
  );
}

export function SkeletonStat({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white rounded-2xl p-5 ${className}`} style={{ border: '1.5px solid #EDE8FF' }}>
      <Skeleton height={32} className="mb-2" style={{ width: '50%' }} />
      <Skeleton height={12} style={{ width: '70%' }} />
    </div>
  );
}
