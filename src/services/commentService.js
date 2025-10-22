/**
 * Comment Service - Application Layer
 * Handles business logic and coordinates repository operations for comments
 * Single Responsibility: Business rules and orchestration
 */

import { ValidationError, NotFoundError } from "../utils/errors.js";
import { validateCreateComment } from "../utils/validation.js";
import { invalidateCommentCache } from "../utils/cache.js";

/**
 * Comment Service
 * Implements business logic for comment operations
 */
export class CommentService {
  constructor(commentRepository, env) {
    this.commentRepository = commentRepository;
    this.env = env;
  }

  /**
   * Get all comments for a specific post
   * @param {string|number} postId - Post ID
   * @returns {Promise<Array>} Array of formatted comments
   */
  async getCommentsByPostId(postId) {
    if (!postId) {
      throw new ValidationError("Post ID is required");
    }

    const id = parseInt(postId, 10);
    if (isNaN(id)) {
      throw new ValidationError("Invalid post ID");
    }

    // Verify post exists and is published
    const postExists = await this.commentRepository.postExists(id);
    if (!postExists) {
      throw new NotFoundError("Post not found");
    }

    // Fetch comments
    const comments = await this.commentRepository.findByPostId(id);

    // Format response (map snake_case to camelCase)
    return comments.map((comment) => ({
      id: comment.id,
      content: comment.content,
      authorName: comment.author_name,
      createdAt: comment.created_at,
      postId: comment.post_id,
    }));
  }

  /**
   * Create a new comment on a post
   * @param {string|number} postId - Post ID
   * @param {Object} commentData - Comment data
   * @param {string} commentData.content - Comment content
   * @param {string} commentData.author - Author name
   * @returns {Promise<Object>} Created comment
   */
  async createComment(postId, commentData) {
    if (!postId) {
      throw new ValidationError("Post ID is required");
    }

    const id = parseInt(postId, 10);
    if (isNaN(id)) {
      throw new ValidationError("Invalid post ID");
    }

    // Verify post exists and is published
    const postExists = await this.commentRepository.postExists(id);
    if (!postExists) {
      throw new NotFoundError("Post not found");
    }

    // Validate comment data
    const errors = validateCreateComment(commentData);
    if (errors.length > 0) {
      throw new ValidationError(errors.join(", "));
    }

    // Generate UUID and timestamp
    const commentId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Create comment
    await this.commentRepository.create({
      id: commentId,
      content: commentData.content,
      authorName: commentData.author,
      createdAt: now,
      postId: id,
    });

    // Invalidate comment cache for this post
    if (this.env.CACHE) {
      await invalidateCommentCache(this.env.CACHE, id);
    }

    // Return created comment
    return {
      id: commentId,
      content: commentData.content,
      authorName: commentData.author,
      createdAt: now,
      postId: id,
    };
  }
}

/**
 * Factory function to create CommentService
 * @param {Object} commentRepository - CommentRepository instance
 * @param {Object} env - Cloudflare Worker environment
 * @returns {CommentService}
 */
export function createCommentService(commentRepository, env) {
  return new CommentService(commentRepository, env);
}
