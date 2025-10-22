/**
 * Tag Repository - Persistence Layer
 * Handles all database operations for tags
 * Single Responsibility: Data access only, no business logic
 */

/**
 * Tag Repository
 * Encapsulates all database operations for tags
 */
export class TagRepository {
  constructor(db) {
    this.db = db;
  }

  /**
   * Find all active tags with post counts
   * @returns {Promise<Array>} Array of tag objects
   */
  async findAllActive() {
    const query = `
      SELECT id, name, created_at, post_count
      FROM tags
      WHERE post_count > 0
      ORDER BY name ASC
    `;

    const result = await this.db.prepare(query).all();
    return result.results;
  }

  /**
   * Find all published post slugs for sitemap
   * @returns {Promise<Array<string>>} Array of post slugs
   */
  async findAllPublishedSlugs() {
    const query = `
      SELECT slug
      FROM posts
      WHERE state = 'published'
      ORDER BY created_at DESC
    `;

    const result = await this.db.prepare(query).all();
    return result.results.map((post) => post.slug);
  }
}

/**
 * Factory function to create TagRepository
 * @param {Object} env - Cloudflare Worker environment
 * @returns {TagRepository}
 */
export function createTagRepository(env) {
  return new TagRepository(env.DB);
}
