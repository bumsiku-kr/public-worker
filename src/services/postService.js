/**
 * Post Service - Application Layer
 * Handles business logic and coordinates repository operations
 * Single Responsibility: Business rules and orchestration
 */

import { NotFoundError, ValidationError } from "../utils/errors.js";
import { validatePagination, validateSorting } from "../utils/validation.js";
import { invalidatePostCache } from "../utils/cache.js";

/**
 * Post Service
 * Implements business logic for post operations
 */
export class PostService {
  constructor(postRepository, env) {
    this.postRepository = postRepository;
    this.env = env;
  }

  /**
   * Get paginated list of posts with optional filtering and sorting
   * @param {Object} options - Query options
   * @param {string|null} options.tag - Filter by tag name
   * @param {number} options.page - Page number (0-indexed)
   * @param {number} options.size - Page size
   * @param {string} options.sort - Sort parameter (e.g., "createdAt,desc")
   * @returns {Promise<Object>} Paginated response with posts
   */
  async getPosts({ tag = null, page = 0, size = 10, sort = "createdAt,desc" }) {
    // Validate pagination parameters
    const paginationErrors = validatePagination({ page, size });
    if (paginationErrors.length > 0) {
      throw new ValidationError(paginationErrors.join(", "));
    }

    // Validate and parse sorting
    const allowedSortFields = ["createdAt", "updatedAt", "views", "title"];
    const sortErrors = validateSorting(sort, allowedSortFields);
    if (sortErrors.length > 0) {
      throw new ValidationError(sortErrors.join(", "));
    }

    const [sortField, sortDirection] = sort.split(",");

    // Map camelCase to snake_case for DB
    const fieldMapping = {
      createdAt: "created_at",
      updatedAt: "updated_at",
      views: "views",
      title: "title",
    };

    const dbSortField = fieldMapping[sortField] || sortField;
    const orderClause = `${dbSortField} ${sortDirection.toUpperCase()}`;

    // Calculate offset
    const offset = page * size;

    // Fetch posts and total count in parallel
    const [posts, totalElements] = await Promise.all([
      this.postRepository.findAll({ tag, offset, limit: size, orderClause }),
      this.postRepository.count(tag),
    ]);

    // Enrich posts with tags (batch operation for efficiency)
    const postIds = posts.map((p) => p.id);
    const tagsByPost = await this.postRepository.getTagsForPosts(postIds);

    const postsWithTags = posts.map((post) => ({
      id: post.id,
      slug: post.slug,
      title: post.title,
      summary: post.summary,
      tags: tagsByPost.get(post.id) || [],
      createdAt: post.created_at,
      updatedAt: post.updated_at,
      views: post.views,
    }));

    // Build paginated response
    return {
      content: postsWithTags,
      totalElements,
      pageNumber: page,
      pageSize: size,
    };
  }

  /**
   * Get single post by slug or ID
   * If ID is provided, returns redirect information
   * @param {string} slug - Post slug or numeric ID
   * @returns {Promise<Object>} Post data or redirect info
   */
  async getPostBySlug(slug) {
    if (!slug) {
      throw new ValidationError("Slug parameter is required");
    }

    // Check if slug is numeric (ID)
    const isNumericId = /^\d+$/.test(slug);

    if (isNumericId) {
      // Fetch by ID to get slug for redirect
      const post = await this.postRepository.findById(parseInt(slug, 10));

      if (!post) {
        throw new NotFoundError("Post not found");
      }

      // Return redirect information
      return {
        redirect: true,
        slug: post.slug,
      };
    }

    // Fetch by slug
    const post = await this.postRepository.findBySlug(slug);

    if (!post) {
      throw new NotFoundError("Post not found");
    }

    // Fetch tags for this post
    const tags = await this.postRepository.getTagsForPost(post.id);

    // Build response
    return {
      redirect: false,
      data: {
        id: post.id,
        slug: post.slug,
        title: post.title,
        content: post.content,
        summary: post.summary,
        tags,
        createdAt: post.created_at,
        updatedAt: post.updated_at,
        views: post.views,
      },
    };
  }

  /**
   * Increment view count for a post
   * @param {string|number} postId - Post ID
   * @returns {Promise<Object>} Updated view count
   */
  async incrementPostViews(postId) {
    if (!postId) {
      throw new ValidationError("Post ID is required");
    }

    const id = parseInt(postId, 10);
    if (isNaN(id)) {
      throw new ValidationError("Invalid post ID");
    }

    // Increment views
    await this.postRepository.incrementViews(id);

    // Fetch updated view count
    const views = await this.postRepository.getViews(id);

    if (views === null) {
      throw new NotFoundError("Post not found");
    }

    // Invalidate cache for this post
    if (this.env.CACHE) {
      await invalidatePostCache(this.env.CACHE, id);
    }

    return { views };
  }
}

/**
 * Factory function to create PostService
 * @param {Object} postRepository - PostRepository instance
 * @param {Object} env - Cloudflare Worker environment
 * @returns {PostService}
 */
export function createPostService(postRepository, env) {
  return new PostService(postRepository, env);
}
