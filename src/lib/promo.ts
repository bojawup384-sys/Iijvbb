/**
 * The ONLY codes that can activate "برق v5 Pro".
 * Every code works exactly ONCE (by one account), then it is permanently dead.
 */
export const PRO_CODES: readonly string[] = [
  "BQ2DZUXQ7A",
  "BQ2QBHN787",
  "BQ3HDL2AES",
  "BQ3QHTWKWF",
  "BQ44GS3N62",
  "BQ46SVCTNL",
  "BQ4K6EMQV9",
  "BQ59NWFB68",
  "BQ5PP3FM8P",
  "BQ5QR8KWD9",
  "BQ5UPW7QHV",
  "BQ9XFYH95B",
  "BQBA2RP4WM",
  "BQBWLNXBSC",
  "BQBZLVBFLQ",
  "BQCN6UB2PV",
  "BQD7YUCKZQ",
  "BQEB3FYGAA",
  "BQESUPFW94",
  "BQF8KJ9B6Y",
  "BQFUL3Z9YK",
  "BQG5PZLXH2",
  "BQG68BBGWH",
  "BQGGLB3TVM",
  "BQGJJD9YH3",
  "BQGPCY3GGF",
  "BQHF6SJF2P",
  "BQHMT2TAHZ",
  "BQHQFBV8VA",
  "BQHS8SKEWT",
  "BQJNS3TEPP",
  "BQJZX43EJM",
  "BQK3G3K37R",
  "BQK9SVHEZP",
  "BQKJGEJGV8",
  "BQKYTEYYNR",
  "BQKZV32QD2",
  "BQLM5KLRJS",
  "BQLMG768RF",
  "BQLMPNKXBW",
  "BQLP6PXGGQ",
  "BQNQW32DHR",
  "BQP9JP56SU",
  "BQPESTW8RW",
  "BQPMDNX29J",
  "BQPWD3L5T2",
  "BQPX3PK8T5",
  "BQQMJF5K5V",
  "BQR77G7F9X",
  "BQS5SP6L32",
  "BQSNAVNJ6R",
  "BQTQCDN663",
  "BQU74VSXGU",
  "BQUMFVFXZG",
  "BQUZ5LP784",
  "BQW4XKVWUY",
  "BQZ33S8289",
  "BQZ53HFT2J",
  "BQZZ4ZPU2X",
  "BQZZAU2QQY",
];

/** How long one redeemed code keeps Pro active. */
export const PRO_DAYS = 30;

/** Each code can be redeemed a single time, by a single account. */
export const PRO_CODE_MAX_USES = 1;

export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

const ALLOWED = new Set(PRO_CODES);

export function isAllowedCode(code: string): boolean {
  return ALLOWED.has(code);
}
