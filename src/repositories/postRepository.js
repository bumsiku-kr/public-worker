export class PostRepository {
  constructor(db) {
    this.db = db;
  }

  /**
   * Find all published posts with filtering, pagination, and sorting
   * @param {Object} options - Query options
   * @param {string|null} options.tag - Filter by tag name
   * @param {number} options.offset - Pagination offset
   * @param {number} options.limit - Pagination limit
   * @param {string} options.orderClause - SQL ORDER BY clause (e.g., "created_at DESC")
   * @returns {Promise<Array>} Array of post objects
   */
  async findAll({
    tag = null,
    offset = 0,
    limit = 10,
    orderClause = "created_at DESC",
  }) {
    let query;
    let bindings;

    if (tag) {
      query = `
        SELECT DISTINCT p.id, p.slug, p.title, p.summary, p.created_at, p.updated_at, p.views
        FROM posts p
        INNER JOIN post_tags pt ON p.id = pt.post_id
        INNER JOIN tags t ON pt.tag_id = t.id
        WHERE t.name = ? AND p.state = 'published'
        ORDER BY ${orderClause}
        LIMIT ? OFFSET ?
      `;
      bindings = [tag, limit, offset];
    } else {
      query = `
        SELECT id, slug, title, summary, created_at, updated_at, views
        FROM posts
        WHERE state = 'published'
        ORDER BY ${orderClause}
        LIMIT ? OFFSET ?
      `;
      bindings = [limit, offset];
    }

    const result = await this.db
      .prepare(query)
      .bind(...bindings)
      .all();
    return result.results;
  }

  /**
   * Count total published posts with optional tag filter
   * @param {string|null} tag - Filter by tag name
   * @returns {Promise<number>} Total count
   */
  async count(tag = null) {
    let query;
    let bindings;

    if (tag) {
      query = `
        SELECT COUNT(DISTINCT p.id) as total
        FROM posts p
        INNER JOIN post_tags pt ON p.id = pt.post_id
        INNER JOIN tags t ON pt.tag_id = t.id
        WHERE t.name = ? AND p.state = 'published'
      `;
      bindings = [tag];
    } else {
      query = `
        SELECT COUNT(*) as total
        FROM posts
        WHERE state = 'published'
      `;
      bindings = [];
    }

    const result = await this.db
      .prepare(query)
      .bind(...bindings)
      .first();
    return result.total;
  }

  /**
   * Find post by slug
   * @param {string} slug - Post slug
   * @returns {Promise<Object|null>} Post object or null if not found
   */
  async findBySlug(slug) {
    const query = `
      SELECT id, slug, title, content, summary, state, created_at, updated_at, views
      FROM posts
      WHERE slug = ? AND state = 'published'
    `;

    const result = await this.db.prepare(query).bind(slug).first();
    return result;
  }

  /**
   * Find post by ID
   * @param {number} id - Post ID
   * @returns {Promise<Object|null>} Post object or null if not found
   */
  async findById(id) {
    const query = `
      SELECT id, slug, title, content, summary, state, created_at, updated_at, views
      FROM posts
      WHERE id = ? AND state = 'published'
    `;

    const result = await this.db.prepare(query).bind(id).first();
    return result;
  }

  /**
   * Increment view count for a post
   * @param {number} id - Post ID
   * @returns {Promise<void>}
   */
  async incrementViews(id) {
    const query = `
      UPDATE posts
      SET views = views + 1
      WHERE id = ? AND state = 'published'
    `;

    await this.db.prepare(query).bind(id).run();
  }

  /**
   * Get current view count for a post
   * @param {number} id - Post ID
   * @returns {Promise<number|null>} View count or null if not found
   */
  async getViews(id) {
    const query = `
      SELECT views
      FROM posts
      WHERE id = ?
    `;

    const result = await this.db.prepare(query).bind(id).first();
    return result ? result.views : null;
  }

  /**
   * Get all tags for a post
   * @param {number} postId - Post ID
   * @returns {Promise<Array<string>>} Array of tag names
   */
  async getTagsForPost(postId) {
    const query = `
      SELECT t.name
      FROM tags t
      INNER JOIN post_tags pt ON t.id = pt.tag_id
      WHERE pt.post_id = ?
      ORDER BY t.name
    `;

    const result = await this.db.prepare(query).bind(postId).all();
    return result.results.map((t) => t.name);
  }

  /**
   * Get tags for multiple posts (batch operation)
   * @param {Array<number>} postIds - Array of post IDs
   * @returns {Promise<Map<number, Array<string>>>} Map of postId to tag names
   */
  async getTagsForPosts(postIds) {
    if (!postIds || postIds.length === 0) {
      return new Map();
    }

    const placeholders = postIds.map(() => "?").join(",");
    const query = `
      SELECT pt.post_id, t.name
      FROM tags t
      INNER JOIN post_tags pt ON t.id = pt.tag_id
      WHERE pt.post_id IN (${placeholders})
      ORDER BY pt.post_id, t.name
    `;

    const result = await this.db
      .prepare(query)
      .bind(...postIds)
      .all();

    const tagsByPost = new Map();
    for (const row of result.results) {
      if (!tagsByPost.has(row.post_id)) {
        tagsByPost.set(row.post_id, []);
      }
      tagsByPost.get(row.post_id).push(row.name);
    }

    return tagsByPost;
  }
}

/**
 * Factory function to create PostRepository
 * @param {Object} env - Cloudflare Worker environment
 * @returns {PostRepository}
 */
export function createPostRepository(env) {
  return new PostRepository(env.DB);
}
