export class SitemapService {
  constructor(tagRepository) {
    this.tagRepository = tagRepository;
  }

  /**
   * Generate sitemap with all published post slugs
   * @returns {Promise<Array<string>>} Array of post slugs for SEO
   */
  async generateSitemap() {
    const slugs = await this.tagRepository.findAllPublishedSlugs();
    return slugs;
  }
}

/**
 * Factory function to create SitemapService
 * @param {Object} tagRepository - TagRepository instance
 * @returns {SitemapService}
 */
export function createSitemapService(tagRepository) {
  return new SitemapService(tagRepository);
}
