/** Same output on server and browser (no locale/timezone dependence): "09 Nov 2026, 10:12 IST". */
export function formatIST(iso: string): string {
  const d = new Date(Date.parse(iso) + 330 * 60_000);
  const m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()];
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())} ${m} ${d.getUTCFullYear()}, ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} IST`;
}
