import React, { Suspense } from 'react';

// Lazy-load emoji-mart only in the browser (never during react-snap prerender)
const PickerInner = React.lazy(async () => {
  const [{ default: Picker }, { default: data }] = await Promise.all([
    import('@emoji-mart/react') as Promise<{ default: React.ComponentType<Record<string, unknown>> }>,
    import('@emoji-mart/data') as Promise<{ default: unknown }>,
  ]);
  const Component = ({ onSelect }: { onSelect: (emoji: string) => void }) => (
    <Picker
      data={data}
      onEmojiSelect={(e: { native: string }) => onSelect(e.native)}
      theme="light"
      skinTonePosition="search"
      previewPosition="none"
      maxFrequentRows={1}
    />
  );
  return { default: Component };
});

export default function EmojiPickerLazy({ onSelect }: { onSelect: (emoji: string) => void }) {
  return (
    <Suspense
      fallback={
        <div
          className="flex items-center justify-center rounded-2xl"
          style={{ width: 352, height: 435, background: '#F4F0FF' }}
        >
          <div className="text-[12px]" style={{ color: '#9CA3AF' }}>Loading emoji picker...</div>
        </div>
      }
    >
      <PickerInner onSelect={onSelect} />
    </Suspense>
  );
}
