/**
 * Public Worker - Comment Handlers
 * Handles public comment operations
 */

import { jsonResponse, errorResponse } from "../utils/response.js";
import {
  ValidationError,
  NotFoundError,
  convertError,
} from "../utils/errors.js";
import { validateCreateComment } from "../utils/validation.js";
import { invalidateCommentCache } from "../utils/cache.js";

/**
 * GET /comments/:postId
 * Retrieve all comments for a specific post
 */
export async function handleGetComments(request, env, ctx, params, user) {
  try {
    const { postId } = params;

    if (!postId) {
      throw new ValidationError("Post ID is required");
    }

    const id = parseInt(postId, 10);
    if (isNaN(id)) {
      throw new ValidationError("Invalid post ID");
    }

    // Verify post exists and is published
    const post = await env.DB.prepare(
      `
      SELECT id FROM posts WHERE id = ? AND state = 'published'
    `,
    )
      .bind(id)
      .first();

    if (!post) {
      throw new NotFoundError("Post not found");
    }

    // Fetch comments for this post
    const result = await env.DB.prepare(
      `
      SELECT id, content, author_name, created_at, post_id
      FROM comments
      WHERE post_id = ?
      ORDER BY created_at ASC
    `,
    )
      .bind(id)
      .all();

    // Format response
    const comments = result.results.map((comment) => ({
      id: comment.id,
      content: comment.content,
      authorName: comment.author_name,
      createdAt: comment.created_at,
      postId: comment.post_id,
    }));

    const response = {
      success: true,
      data: comments,
      error: null,
    };

    return jsonResponse(response, 200);
  } catch (error) {
    console.error("Error in handleGetComments:", error);
    const apiError = convertError(error);
    return errorResponse(apiError.message, apiError.status);
  }
}

/**
 * POST /comments/:postId
 * Create a new comment on a post
 */
export async function handleCreateComment(request, env, ctx, params, user) {
  try {
    const { postId } = params;

    if (!postId) {
      throw new ValidationError("Post ID is required");
    }

    const id = parseInt(postId, 10);
    if (isNaN(id)) {
      throw new ValidationError("Invalid post ID");
    }

    // Verify post exists and is published
    const post = await env.DB.prepare(
      `
      SELECT id FROM posts WHERE id = ? AND state = 'published'
    `,
    )
      .bind(id)
      .first();

    if (!post) {
      throw new NotFoundError("Post not found");
    }

    // Parse and validate request body
    const body = await request.json();
    const errors = validateCreateComment(body);
    if (errors.length > 0) {
      throw new ValidationError(errors.join(", "));
    }

    // Generate UUID for comment ID
    const commentId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Insert comment
    await env.DB.prepare(
      `
      INSERT INTO comments (id, content, author_name, created_at, post_id)
      VALUES (?, ?, ?, ?, ?)
    `,
    )
      .bind(commentId, body.content, body.author, now, id)
      .run();

    // Invalidate comment cache for this post
    if (env.CACHE) {
      await invalidateCommentCache(env.CACHE, id);
    }

    // Return created comment
    const response = {
      success: true,
      data: {
        id: commentId,
        content: body.content,
        authorName: body.author,
        createdAt: now,
        postId: id,
      },
      error: null,
    };

    return jsonResponse(response, 200);
  } catch (error) {
    console.error("Error in handleCreateComment:", error);
    const apiError = convertError(error);
    return errorResponse(apiError.message, apiError.status);
  }
}
