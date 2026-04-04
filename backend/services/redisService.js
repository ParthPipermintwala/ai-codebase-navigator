import redisClient from "../config/redis.js";

const getCachedJson = async (key) => {
  try {
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error("Redis read failed:", error.message);
    return null;
  }
};

const setCachedJson = async (key, payload, ttlSeconds = 3600) => {
  try {
    await redisClient.set(key, JSON.stringify(payload), {
      EX: ttlSeconds,
    });
  } catch (error) {
    console.error("Redis write failed:", error.message);
  }
};

const deleteCachedKey = async (key) => {
  try {
    await redisClient.del(key);
  } catch (error) {
    console.error("Redis delete failed:", error.message);
  }
};

export { getCachedJson, setCachedJson, deleteCachedKey };
