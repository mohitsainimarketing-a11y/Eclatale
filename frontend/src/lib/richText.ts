// Unicode "fake formatting" for LinkedIn — LinkedIn's post body is plain text
// with no real bold/italic, so creators fake it using the Mathematical
// Alphanumeric Symbols block (and a few standalone letter-like symbols for
// glyphs that were never assigned in that block). This mirrors that trick.

type CharMap = { upperBase?: number; lowerBase?: number; digitBase?: number; exceptions?: Record<string, number> };

function mapChar(ch: string, def: CharMap): string {
  const code = ch.charCodeAt(0);
  if (def.exceptions && def.exceptions[ch] !== undefined) return String.fromCodePoint(def.exceptions[ch]);
  if (def.upperBase && code >= 65 && code <= 90) return String.fromCodePoint(def.upperBase + (code - 65));
  if (def.lowerBase && code >= 97 && code <= 122) return String.fromCodePoint(def.lowerBase + (code - 97));
  if (def.digitBase && code >= 48 && code <= 57) {
    if (def.digitBase === CIRCLED_DIGIT_BASE) {
      // Circled digits: 1-9 are contiguous from ①, but 0 is the separate ⓪.
      if (ch === '0') return '⓪';
      return String.fromCodePoint(def.digitBase + (code - 49));
    }
    return String.fromCodePoint(def.digitBase + (code - 48));
  }
  return ch;
}

function transform(text: string, def: CharMap): string {
  return Array.from(text).map(ch => mapChar(ch, def)).join('');
}

const CIRCLED_DIGIT_BASE = 0x2460; // used as a sentinel to trigger the 0 → ⓪ special case above

export interface RichTextStyle {
  id: string;
  label: string;
  apply: (text: string) => string;
}

export const RICH_TEXT_STYLES: RichTextStyle[] = [
  { id: 'normal', label: 'Normal', apply: t => t },
  { id: 'bold', label: 'Bold', apply: t => transform(t, { upperBase: 0x1D400, lowerBase: 0x1D41A, digitBase: 0x1D7CE }) },
  { id: 'italic', label: 'Italic', apply: t => transform(t, { upperBase: 0x1D434, lowerBase: 0x1D44E, exceptions: { h: 0x210E } }) },
  { id: 'bold-italic', label: 'Bold Italic', apply: t => transform(t, { upperBase: 0x1D468, lowerBase: 0x1D482 }) },
  { id: 'sans', label: 'Sans', apply: t => transform(t, { upperBase: 0x1D5A0, lowerBase: 0x1D5BA, digitBase: 0x1D7E2 }) },
  { id: 'sans-bold', label: 'Sans Bold', apply: t => transform(t, { upperBase: 0x1D5D4, lowerBase: 0x1D5EE, digitBase: 0x1D7EC }) },
  { id: 'sans-italic', label: 'Sans Italic', apply: t => transform(t, { upperBase: 0x1D608, lowerBase: 0x1D622 }) },
  { id: 'sans-bold-italic', label: 'Sans Bold Italic', apply: t => transform(t, { upperBase: 0x1D63C, lowerBase: 0x1D656 }) },
  { id: 'monospace', label: 'Monospace', apply: t => transform(t, { upperBase: 0x1D670, lowerBase: 0x1D68A, digitBase: 0x1D7F6 }) },
  {
    id: 'double-struck', label: 'Double Struck',
    apply: t => transform(t, {
      upperBase: 0x1D538, lowerBase: 0x1D552, digitBase: 0x1D7D8,
      exceptions: { C: 0x2102, H: 0x210D, N: 0x2115, P: 0x2119, Q: 0x211A, R: 0x211D, Z: 0x2124 },
    }),
  },
  {
    id: 'script', label: 'Script',
    apply: t => transform(t, {
      upperBase: 0x1D49C, lowerBase: 0x1D4B6,
      exceptions: { B: 0x212C, E: 0x2130, F: 0x2131, H: 0x210B, I: 0x2110, L: 0x2112, M: 0x2133, R: 0x211B, e: 0x212F, g: 0x210A, o: 0x2134 },
    }),
  },
  { id: 'bold-script', label: 'Bold Script', apply: t => transform(t, { upperBase: 0x1D4D0, lowerBase: 0x1D4EA }) },
  {
    id: 'fraktur', label: 'Fraktur',
    apply: t => transform(t, {
      upperBase: 0x1D504, lowerBase: 0x1D51E,
      exceptions: { C: 0x212D, H: 0x210C, I: 0x2111, R: 0x211C, Z: 0x2128 },
    }),
  },
  { id: 'bold-fraktur', label: 'Bold Fraktur', apply: t => transform(t, { upperBase: 0x1D56C, lowerBase: 0x1D586 }) },
  { id: 'fullwidth', label: 'Fullwidth', apply: t => transform(t, { upperBase: 0xFF21, lowerBase: 0xFF41, digitBase: 0xFF10 }) },
  { id: 'circled', label: 'Circled', apply: t => transform(t, { upperBase: 0x24B6, lowerBase: 0x24D0, digitBase: CIRCLED_DIGIT_BASE }) },
  {
    id: 'circled-negative', label: 'Circled Negative',
    apply: t => Array.from(t).map(ch => {
      const code = ch.charCodeAt(0);
      if (code >= 65 && code <= 90) return String.fromCodePoint(0x1F150 + (code - 65));
      if (code >= 97 && code <= 122) return String.fromCodePoint(0x1F150 + (code - 97));
      return ch;
    }).join(''),
  },
];
