export class TagService {
  constructor(tagRepository) {
    this.tagRepository = tagRepository;
  }

  /**
   * Get all active tags with post counts
   * @returns {Promise<Array>} Array of formatted tags
   */
  async getActiveTags() {
    const tags = await this.tagRepository.findAllActive();

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
