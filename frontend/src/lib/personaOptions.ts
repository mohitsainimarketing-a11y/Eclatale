export const STYLES = [
  { id: 'direct', label: 'Direct', emoji: '🎯', desc: 'Straight to the point' },
  { id: 'warm', label: 'Warm', emoji: '🤝', desc: 'Empathetic and personal' },
  { id: 'analytical', label: 'Analytical', emoji: '🔬', desc: 'Data and logic first' },
  { id: 'witty', label: 'Witty', emoji: '😏', desc: 'Clever and sharp' },
  { id: 'visionary', label: 'Visionary', emoji: '🔮', desc: 'Big-picture thinking' },
  { id: 'contrarian', label: 'Contrarian', emoji: '⚡', desc: 'Against the grain' },
  { id: 'storyteller', label: 'Storyteller', emoji: '📖', desc: 'Narrative-driven' },
];

export function formalityLabel(v: number): string {
  if (v <= 20) return 'Very casual';
  if (v <= 40) return 'Casual';
  if (v <= 60) return 'Balanced';
  if (v <= 80) return 'Professional';
  return 'Very formal';
}
