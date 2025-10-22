export class CommentRepository {
  constructor(db) {
    this.db = db;
  }

  /**
   * Find all comments for a specific post
   * @param {number} postId - Post ID
   * @returns {Promise<Array>} Array of comment objects
   */
  async findByPostId(postId) {
    const query = `
      SELECT id, content, author_name, created_at, post_id
      FROM comments
      WHERE post_id = ?
      ORDER BY created_at ASC
    `;

    const result = await this.db.prepare(query).bind(postId).all();
    return result.results;
  }

  /**
   * Create a new comment
   * @param {Object} comment - Comment data
   * @param {string} comment.id - Comment UUID
   * @param {string} comment.content - Comment content
   * @param {string} comment.authorName - Author name
   * @param {string} comment.createdAt - ISO timestamp
   * @param {number} comment.postId - Post ID
   * @returns {Promise<void>}
   */
  async create({ id, content, authorName, createdAt, postId }) {
    const query = `
      INSERT INTO comments (id, content, author_name, created_at, post_id)
      VALUES (?, ?, ?, ?, ?)
    `;

    await this.db
      .prepare(query)
      .bind(id, content, authorName, createdAt, postId)
      .run();
  }

  /**
   * Check if a post exists and is published
   * @param {number} postId - Post ID
   * @returns {Promise<boolean>} True if post exists and is published
   */
  async postExists(postId) {
    const query = `
      SELECT id FROM posts WHERE id = ? AND state = 'published'
    `;

    const result = await this.db.prepare(query).bind(postId).first();
    return result !== null;
  }
}

/**
 * Factory function to create CommentRepository
 * @param {Object} env - Cloudflare Worker environment
 * @returns {CommentRepository}
 */
export function createCommentRepository(env) {
  return new CommentRepository(env.DB);
}
