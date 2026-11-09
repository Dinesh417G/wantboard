// Flags attempts to move a deal off-platform, where nobody protects the money. Pure.

export type ScamFlag = { kind: string; match: string };

const RULES: { kind: string; re: RegExp }[] = [
  { kind: "phone number", re: /(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g },
  { kind: "email address", re: /\b[\w.+-]+@[\w-]+\.[\w.]{2,}\b/g },
  { kind: "Venmo / Cash App handle", re: /(?:^|\s)[$@][A-Za-z][\w-]{2,}/g },
  { kind: "outside payment app", re: /\b(venmo|zelle|cash ?app|cashapp|wire transfer|western union|moneygram|gift ?cards?|crypto|bitcoin|usdt|btc)\b/gi },
  { kind: "pay-outside phrase", re: /\b(pay (me )?(directly|outside|off[- ]?(the )?(platform|site|app))|skip (the )?(fees?|platform)|friends (and|&) family|deposit first|advance payment|send (the )?money first)\b/gi },
  { kind: "payment link", re: /\bhttps?:\/\/(?:[\w-]+\.)*(?:paypal\.me|venmo\.com|cash\.app|buy\.stripe\.com|bit\.ly|tinyurl\.com)\S*/gi },
];

export function scanMessage(text: string): ScamFlag[] {
  const flags: ScamFlag[] = [];
  for (const { kind, re } of RULES) {
    for (const m of text.matchAll(re)) {
      const match = m[0].trim();
      if (match && !flags.some((f) => f.kind === kind)) flags.push({ kind, match });
    }
  }
  return flags;
}
