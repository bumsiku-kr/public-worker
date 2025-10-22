/**
 * Tag Service - Application Layer
 * Handles business logic for tag operations
 * Single Responsibility: Business rules and orchestration
 */

/**
 * Tag Service
 * Implements business logic for tag operations
 */
export class TagService {
  constructor(tagRepository) {
    this.tagRepository = tagRepository;
  }

  /**
   * Get all active tags with post counts
   * @returns {Promise<Array>} Array of formatted tags
   */
  async getActiveTags() {
    // Fetch all active tags
    const tags = await this.tagRepository.findAllActive();

    // Format response (map snake_case to camelCase)
    return tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      postCount: tag.post_count,
      createdAt: tag.created_at,
    }));
  }
}

/**
 * Factory function to create TagService
 * @param {Object} tagRepository - TagRepository instance
 * @returns {TagService}
 */
export function createTagService(tagRepository) {
  return new TagService(tagRepository);
}
