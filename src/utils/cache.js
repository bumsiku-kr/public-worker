/**
 * Generate a cache key from request details
 * @param {string} path - Request path
 * @param {Object} params - Query parameters
 * @returns {string} Cache key
 */
export function generateCacheKey(path, params = {}) {
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  return sortedParams ? `${path}?${sortedParams}` : path;
}

/**
 * Get cached response from KV
 * @param {KVNamespace} cache - KV namespace binding
 * @param {string} key - Cache key
 * @returns {Promise<Object|null>} Cached data or null
 */
export async function getCached(cache, key) {
  if (!cache) {
    return null;
  }

  try {
    const cached = await cache.get(key, "json");
    return cached;
  } catch (error) {
    console.error("Cache read error:", error);
    return null;
  }
}

/**
 * Set cached response in KV
 * @param {KVNamespace} cache - KV namespace binding
 * @param {string} key - Cache key
 * @param {Object} data - Data to cache
 * @param {number} ttl - Time to live in seconds (default: 3600)
 * @returns {Promise<void>}
 */
export async function setCached(cache, key, data, ttl = 3600) {
  if (!cache) {
    return;
  }

  try {
    await cache.put(key, JSON.stringify(data), {
      expirationTtl: ttl,
    });
  } catch (error) {
    console.error("Cache write error:", error);
  }
}

/**
 * Invalidate cache entry
 * @param {KVNamespace} cache - KV namespace binding
 * @param {string} key - Cache key
 * @returns {Promise<void>}
 */
export async function invalidateCache(cache, key) {
  if (!cache) {
    return;
  }

  try {
    await cache.delete(key);
  } catch (error) {
    console.error("Cache invalidation error:", error);
  }
}

/**
 * Invalidate multiple cache entries by prefix
 * @param {KVNamespace} cache - KV namespace binding
 * @param {string} prefix - Cache key prefix
 * @returns {Promise<void>}
 */
export async function invalidateCacheByPrefix(cache, prefix) {
  if (!cache) {
    return;
  }

  try {
    const list = await cache.list({ prefix });
    const deletePromises = list.keys.map((key) => cache.delete(key.name));
    await Promise.all(deletePromises);
  } catch (error) {
    console.error("Cache prefix invalidation error:", error);
  }
}

/**
 * Create a cached response wrapper
 * @param {KVNamespace} cache - KV namespace binding
 * @param {string} key - Cache key
 * @param {Function} dataFetcher - Function to fetch data if not cached
 * @param {number} ttl - Time to live in seconds
 * @returns {Promise<Object>} Data from cache or fetcher
 */
export async function withCache(cache, key, dataFetcher, ttl = 3600) {
  const cached = await getCached(cache, key);
  if (cached) {
    return cached;
  }

  const data = await dataFetcher();
  await setCached(cache, key, data, ttl);

  return data;
}

export const CacheInvalidationPatterns = {
  /**
   * Invalidate post-related caches when a post is created/updated/deleted
   * @param {KVNamespace} cache - KV namespace binding
   * @param {string} slug - Post slug (optional, for specific post)
   */
  async invalidatePostCaches(cache, slug = null) {
    await invalidateCacheByPrefix(cache, "/posts");

    if (slug) {
      await invalidateCache(cache, `/posts/${slug}`);
    }

    await invalidateCache(cache, "/sitemap");
  },

  /**
   * Invalidate comment-related caches
   * @param {KVNamespace} cache - KV namespace binding
   * @param {number} postId - Post ID
   */
  async invalidateCommentCaches(cache, postId) {
    await invalidateCache(cache, `/comments/${postId}`);
  },

  /**
   * Invalidate tag-related caches
   * @param {KVNamespace} cache - KV namespace binding
   */
  async invalidateTagCaches(cache) {
    await invalidateCache(cache, "/tags");
  },
};

/**
 * Convenience function to invalidate post cache
 * @param {KVNamespace} cache - KV namespace binding
 * @param {number|string} postIdOrSlug - Post ID or slug
 */
export async function invalidatePostCache(cache, postIdOrSlug) {
  if (!cache) return;

  await invalidateCache(cache, `/posts/${postIdOrSlug}`);
  await invalidateCacheByPrefix(cache, "/posts?");
}

/**
 * Convenience function to invalidate comment cache
 * @param {KVNamespace} cache - KV namespace binding
 * @param {number} postId - Post ID
 */
export async function invalidateCommentCache(cache, postId) {
  if (!cache) return;
  await invalidateCache(cache, `/comments/${postId}`);
}
