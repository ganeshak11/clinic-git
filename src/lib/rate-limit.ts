/**
 * Simple in-memory sliding window rate limiter.
 * Note: Suitable for single-instance deployments only. 
 * For distributed systems, use Redis or infrastructure layer (e.g., Cloudflare, API Gateway).
 */
const WINDOW_SIZE_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 100;

class RateLimiter {
  private requests = new Map<string, number[]>();

  /**
   * Checks if the given key (e.g. IP address or user ID) has exceeded the rate limit.
   * @param key Identifier for the client
   * @returns boolean - True if the request is allowed, false if rate limited
   */
  check(key: string): boolean {
    const now = Date.now();
    const timestamps = this.requests.get(key) ?? [];
    
    // Filter out timestamps older than WINDOW_SIZE_MS
    const validTimestamps = timestamps.filter(t => now - t < WINDOW_SIZE_MS);
    
    if (validTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
      this.requests.set(key, validTimestamps);
      return false; // Rate limit exceeded
    }
    
    validTimestamps.push(now);
    this.requests.set(key, validTimestamps);
    return true;
  }
}

export const rateLimiter = new RateLimiter();
