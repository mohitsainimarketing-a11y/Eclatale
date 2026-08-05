import React, { useState } from 'react';

interface AvatarProps {
  src?: string | null;
  initials: string;
  alt?: string;
  size?: number;
  className?: string;
}

// Bulletproof avatar: falls back to an initials badge if src is missing OR
// fails to load (revoked LinkedIn/Google photo URL, 404, etc.) — never
// shows a broken image icon.
export default function Avatar({ src, initials, alt, size = 32, className = '' }: AvatarProps) {
  const [errored, setErrored] = useState(false);
  const showImage = !!src && !errored;

  if (showImage) {
    return (
      <img
        src={src as string}
        alt={alt || initials}
        loading="lazy"
        onError={() => setErrored(true)}
        className={`rounded-full object-cover flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={`rounded-full gradient-primary flex items-center justify-center text-white font-bold flex-shrink-0 ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.4) }}
    >
      {initials}
    </div>
  );
}
