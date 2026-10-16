import { redis } from "../config/redis";

export class CacheService {
  // ── Generic cache operations ──────────────────────────────────────────────

  static async get(key: string) {
    try {
      if (redis.status !== "ready") return null;
      const data = await redis.get(key);
      if (!data) return null;
      return JSON.parse(data);
    } catch (error) {
      console.warn(`[RedisCache] get failed for key ${key}:`, (error as Error).message);
      return null;
    }
  }

  static async set(key: string, value: any, ttl = 300) {
    try {
      if (redis.status !== "ready") return;
      await redis.set(key, JSON.stringify(value), "EX", ttl);
    } catch (error) {
      console.warn(`[RedisCache] set failed for key ${key}:`, (error as Error).message);
    }
  }

  static async del(key: string) {
    try {
      if (redis.status !== "ready") return;
      await redis.del(key);
    } catch (error) {
      console.warn(`[RedisCache] del failed for key ${key}:`, (error as Error).message);
    }
  }

  /**
   * HIGH-5 fix: Use cursor-based SCAN instead of blocking KEYS command.
   * KEYS is O(N) and blocks the entire Redis event loop.
   */
  static async delPattern(pattern: string) {
    try {
      if (redis.status !== "ready") return;
      let cursor = "0";
      do {
        const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } while (cursor !== "0");
    } catch (error) {
      console.warn(`[RedisCache] delPattern failed for pattern ${pattern}:`, (error as Error).message);
    }
  }

  // ── Refresh token rotation store ─────────────────────────────────────────
  // Implements single-session refresh token rotation for HIGH-1.
  // Key: rt:{userId}, Value: raw refresh token string, TTL: 7 days.

  static async setRefreshToken(userId: string, token: string): Promise<void> {
    try {
      if (redis.status !== "ready") return;
      await redis.set(`rt:${userId}`, token, "EX", 24 * 60 * 60);
    } catch (error) {
      console.warn(`[RedisCache] setRefreshToken failed for user ${userId}:`, (error as Error).message);
    }
  }

  static async getRefreshToken(userId: string): Promise<string | null> {
    try {
      if (redis.status !== "ready") return null;
      return await redis.get(`rt:${userId}`);
    } catch (error) {
      console.warn(`[RedisCache] getRefreshToken failed for user ${userId}:`, (error as Error).message);
      return null;
    }
  }

  static async deleteRefreshToken(userId: string): Promise<void> {
    try {
      if (redis.status !== "ready") return;
      await redis.del(`rt:${userId}`);
    } catch (error) {
      console.warn(`[RedisCache] deleteRefreshToken failed for user ${userId}:`, (error as Error).message);
    }
  }

  // ── Customer refresh token store ──────────────────────────────────────────
  // Separate namespace `crt:` to avoid collision with admin tokens.
  // Key: crt:{customerId}, Value: raw refresh token string, TTL: 30 days.

  static async setCustomerRefreshToken(customerId: string, token: string): Promise<void> {
    try {
      if (redis.status !== "ready") return;
      await redis.set(`crt:${customerId}`, token, "EX", 365 * 24 * 60 * 60);
    } catch (error) {
      console.warn(`[RedisCache] setCustomerRefreshToken failed for customer ${customerId}:`, (error as Error).message);
    }
  }

  static async getCustomerRefreshToken(customerId: string): Promise<string | null> {
    try {
      if (redis.status !== "ready") return null;
      return await redis.get(`crt:${customerId}`);
    } catch (error) {
      console.warn(`[RedisCache] getCustomerRefreshToken failed for customer ${customerId}:`, (error as Error).message);
      return null;
    }
  }

  static async deleteCustomerRefreshToken(customerId: string): Promise<void> {
    try {
      if (redis.status !== "ready") return;
      await redis.del(`crt:${customerId}`);
    } catch (error) {
      console.warn(`[RedisCache] deleteCustomerRefreshToken failed for customer ${customerId}:`, (error as Error).message);
    }
  }
}