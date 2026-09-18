const CENTS = 100n;

export function parseMoney(amount: string): bigint {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(amount);
  if (!match) {
    throw new Error(`Invalid money amount: ${amount}`);
  }
  const whole = BigInt(match[1]);
  const fraction = BigInt((match[2] ?? "00").padEnd(2, "0"));
  return whole * CENTS + fraction;
}

export function formatMoney(cents: bigint): string {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const whole = abs / CENTS;
  const fraction = abs % CENTS;
  return `${negative ? "-" : ""}${whole.toString()}.${fraction.toString().padStart(2, "0")}`;
}

export function compareMoney(a: string, b: string): number {
  const left = parseMoney(a);
  const right = parseMoney(b);
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function addMoney(a: string, b: string): string {
  return formatMoney(parseMoney(a) + parseMoney(b));
}

export function maxMoney(a: string, b: string): string {
  return compareMoney(a, b) >= 0 ? a : b;
}
