# Public Worker - bumsiku.kr Blog

Public-facing CloudFlare Worker for read-only blog API operations.

## Overview

This worker handles all public (non-authenticated) operations:
- Post listing and retrieval
- Comment reading and creation
- Tag browsing
- View count tracking
- Sitemap generation for SEO

## API Endpoints

All endpoints are public and require no authentication:

### Post Endpoints
- `GET /posts` - List posts with pagination, filtering, and sorting
- `GET /posts/{slug}` - Get single post by slug or ID
- `PATCH /posts/{postId}/views` - Increment post view count

### Comment Endpoints
- `GET /comments/{postId}` - Get all comments for a post
- `POST /comments/{postId}` - Create new comment (public submission)

### Utility Endpoints
- `GET /tags` - List all tags with post counts
- `GET /sitemap` - Generate sitemap for SEO

## Query Parameters

### GET /posts
```
?tag=javascript           # Filter by tag
?page=0                   # Page number (0-indexed)
?size=10                  # Items per page
?sort=createdAt,desc     # Sort field and direction
```

## Configuration

### Environment Variables (wrangler.toml)
```toml
[vars]
ENVIRONMENT = "production"
ALLOWED_ORIGINS = "https://bumsiku.kr"
CACHE_TTL = "3600"  # 1 hour cache
```

### CloudFlare Bindings
- `DB` - D1 database (blog-db, read-only access)
- `CACHE` - KV namespace (optional, for caching)

### No Secrets Required
Public worker operates in read-only mode with no authentication.

## Local Development

```bash
# Install dependencies
npm install

# Run local dev server
npm run dev

# Access at http://localhost:8788
```

## Testing

```bash
# Run tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

## Deployment

```bash
# Deploy to production
npm run deploy

# Deploy to staging
wrangler deploy --env staging
```

## Project Structure

```
public-worker/
├── src/
│   ├── index.js              # Main entry point and fetch handler
│   ├── router.js             # URL routing logic
│   ├── handlers/
│   │   ├── posts.js          # Post retrieval handlers
│   │   ├── comments.js       # Comment CRUD handlers
│   │   ├── tags.js           # Tag listing handlers
│   │   └── sitemap.js        # Sitemap generation
│   └── utils/
│       ├── errors.js         # Custom error classes
│       ├── response.js       # Response formatting utilities
│       └── cache.js          # KV caching utilities
├── tests/
│   └── handlers.test.js      # Handler integration tests
├── package.json
├── wrangler.toml
└── README.md
```

## Caching Strategy

### KV Cache (Optional)
- Post listings: 1 hour TTL
- Individual posts: 1 hour TTL
- Tag listings: 1 hour TTL
- Cache invalidation on post updates (via admin worker)

### CloudFlare Edge Cache
- Static responses cached at edge locations
- Cache-Control headers for browser caching

## Performance Optimizations

1. **Pagination**: All list endpoints support pagination
2. **Caching**: Optional KV caching for frequently accessed data
3. **Edge Caching**: CloudFlare edge caching for static responses
4. **Query Optimization**: Indexed database queries for fast retrieval

## Error Handling

All errors follow standard format:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": 404,
    "message": "Post not found"
  }
}
```

## Response Format

All successful responses follow standard format:

```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

### Paginated Response
```json
{
  "success": true,
  "data": {
    "content": [...],
    "totalElements": 42,
    "pageNumber": 0,
    "pageSize": 10
  },
  "error": null
}
```

## Input Validation

### Comment Creation
- `content`: 1-500 characters, required
- `author`: 2-20 characters, required
- Basic XSS protection and sanitization

## CORS Configuration

Configured to allow requests from:
- `https://bumsiku.kr` (production)
- `http://localhost:*` (development)

## Implementation Status

- [ ] Phase 1: Project Setup ✅
- [ ] Phase 2: Core Infrastructure
- [ ] Phase 3: Handler Implementation
- [ ] Phase 4: Caching Implementation
- [ ] Phase 5: Testing
- [ ] Phase 6: Deployment

## Next Steps

1. Implement core utilities (response, error, cache)
2. Create route handlers for each endpoint
3. Implement caching strategy with KV
4. Write comprehensive tests
5. Deploy to staging for validation

## SEO Considerations

### Sitemap Endpoint
The `/sitemap` endpoint returns all post slugs for SEO tools:
```json
{
  "success": true,
  "data": [
    "my-first-post",
    "getting-started-serverless",
    "understanding-workers"
  ]
}
```

Use this to generate XML sitemaps or feed SEO indexing systems.

## Resources

- [Implementation Plan](../IMPLEMENTATION_PLAN.md) - Complete specification
- [Setup Guide](../SETUP_GUIDE.md) - Setup instructions
- [CloudFlare Workers Docs](https://developers.cloudflare.com/workers/)
