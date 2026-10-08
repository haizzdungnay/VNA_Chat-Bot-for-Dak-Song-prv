export class InMemoryRateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private windowMs: number = 60_000,
    private maxRequests: number = 30
  ) {}

  check(key: string): { allowed: boolean; remaining: number; retryAfterSec: number } {
    const now = Date.now();
    const entry = this.hits.get(key);

    if (!entry || now > entry.resetAt) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      this.cleanExpired(now);
      return { allowed: true, remaining: this.maxRequests - 1, retryAfterSec: 0 };
    }

    if (entry.count >= this.maxRequests) {
      const retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      return { allowed: false, remaining: 0, retryAfterSec };
    }

    entry.count += 1;
    return {
      allowed: true,
      remaining: this.maxRequests - entry.count,
      retryAfterSec: 0,
    };
  }

  reset(): void {
    this.hits.clear();
  }

  private cleanExpired(now: number): void {
    if (this.hits.size > 1000) {
      for (const [k, v] of this.hits.entries()) {
        if (now > v.resetAt) this.hits.delete(k);
      }
    }
  }
}

export const chatRateLimiter = new InMemoryRateLimiter(60_000, 30);
