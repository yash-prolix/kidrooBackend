import Redis from "ioredis";

const redisURL = process.env.REDIS_URL || "redis://localhost:6379";

export const redis = new Redis(redisURL, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 3) {
      return null; // Stop retrying after 3 attempts to avoid console log spam
    }
    return Math.min(times * 200, 2000);
  },
});

redis.on("error", (err) => {
  // Only log if redis is not in a stopped retry state
  if (redis.status !== "end") {
    console.error("Redis error:", err.message);
  }
});

redis.on("end", () => {
  console.warn("Redis connection ended");
});

export const connectRedis = async () => {
  try {
    await redis.connect();
    console.log("Redis connection established");
  } catch (err) {
    // Log the error but DON'T crash the server — let requests
    // that don't need Redis still work. Redis failures are handled
    // gracefully by the CacheService (operations return null / no-op).
    console.error("Redis connection ERROR! ==> ", err);
    console.warn("⚠️  Server will continue without Redis cache. OTP and caching features may be unavailable.");
  }
};

export const disconnectRedis = async () => {
  try {
    if (redis.status === "ready" || redis.status === "connecting") {
      console.log("Closing Redis connection...");
      await redis.quit();
      console.log("Redis connection closed");
    }
  } catch (error) {
    console.error("Error closing Redis connection", error);
  }
};
