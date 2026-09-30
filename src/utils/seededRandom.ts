// Mulberry32 PRNG - deterministic seeded random
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  // Returns a number between 0 and 1
  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Returns a number between min and max
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  // Returns an integer between min and max (inclusive)
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  // Returns a gaussian-ish random number (Box-Muller approximation)
  gaussian(mean: number, stddev: number): number {
    const u1 = this.next();
    const u2 = this.next();
    const z = Math.sqrt(-2 * Math.log(u1 || 0.0001)) * Math.cos(2 * Math.PI * u2);
    return mean + z * stddev;
  }

  // Returns true with given probability
  chance(probability: number): boolean {
    return this.next() < probability;
  }

  // Pick a random element from an array
  pick<T>(arr: T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }

  // Clone with same state
  clone(): SeededRandom {
    const clone = new SeededRandom(0);
    clone.state = this.state;
    return clone;
  }

  // Reset to a specific seed
  reset(seed: number): void {
    this.state = seed;
  }
}

export const DEFAULT_SEED = 42;
