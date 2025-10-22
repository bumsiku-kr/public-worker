/**
 * Public Worker Router
 * URL routing logic for public API endpoints
 */

import { errorResponse } from './utils/response.js';
import { convertError } from './utils/errors.js';

// Import all handlers
import { handleGetPosts, handleGetPostBySlug, handleIncrementViews } from './handlers/posts.js';
import { handleGetComments, handleCreateComment } from './handlers/comments.js';
import { handleGetTags } from './handlers/tags.js';
import { handleGetSitemap } from './handlers/sitemap.js';

/**
 * Route configuration
 * Pattern format: "METHOD /path/pattern"
 * Path parameters: :paramName
 */
const routes = [
  // Public post endpoints
  { pattern: 'GET /posts', handler: handleGetPosts },
  { pattern: 'GET /posts/:slug', handler: handleGetPostBySlug },
  { pattern: 'PATCH /posts/:postId/views', handler: handleIncrementViews },

  // Public comment endpoints
  { pattern: 'GET /comments/:postId', handler: handleGetComments },
  { pattern: 'POST /comments/:postId', handler: handleCreateComment },

  // Public tag endpoints
  { pattern: 'GET /tags', handler: handleGetTags },

  // Public sitemap endpoint
  { pattern: 'GET /sitemap', handler: handleGetSitemap },
];

/**
 * Match a route pattern against a URL path
 * @param {string} pattern - Route pattern (e.g., "/posts/:id")
 * @param {string} path - URL path (e.g., "/posts/123")
 * @returns {Object|null} Match result with params, or null if no match
 */
function matchPattern(pattern, path) {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = path.split('/').filter(Boolean);

  // Must have same number of parts
  if (patternParts.length !== pathParts.length) {
    return null;
  }

  const params = {};

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    const pathPart = pathParts[i];

    // Parameter (starts with :)
    if (patternPart.startsWith(':')) {
      const paramName = patternPart.substring(1);
      params[paramName] = decodeURIComponent(pathPart);
    }
    // Literal match
    else if (patternPart !== pathPart) {
      return null;
    }
  }

  return { params };
}

/**
 * Find matching route for request
 * @param {string} method - HTTP method
 * @param {string} pathname - URL pathname
 * @returns {Object|null} Route match with handler and params
 */
function findRoute(method, pathname) {
  for (const route of routes) {
    const [routeMethod, routePattern] = route.pattern.split(' ', 2);

    // Method must match
    if (routeMethod !== method) {
      continue;
    }

    // Try to match pattern
    const match = matchPattern(routePattern, pathname);
    if (match) {
      return {
        handler: route.handler,
        params: match.params
      };
    }
  }

  return null;
}

/**
 * Parse request body as JSON
 * @param {Request} request - Request object
 * @returns {Promise<Object>} Parsed JSON body
 */
async function parseJsonBody(request) {
  try {
    const text = await request.text();
    return text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error('Invalid JSON in request body');
  }
}

/**
 * Extract query parameters from URL
 * @param {URL} url - URL object
 * @returns {Object} Query parameters as object
 */
function getQueryParams(url) {
  const params = {};
  for (const [key, value] of url.searchParams.entries()) {
    params[key] = value;
  }
  return params;
}

/**
 * Main router function
 * @param {Request} request - Request object
 * @param {Object} env - Environment bindings
 * @param {Object} ctx - Execution context
 * @returns {Promise<Response>} Response object
 */
export async function router(request, env, ctx) {
  try {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    // Find matching route
    const match = findRoute(method, pathname);

    if (!match) {
      return errorResponse('Not Found', 404);
    }

    // Parse request body for POST/PUT/PATCH
    let body = null;
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      body = await parseJsonBody(request);
    }

    // Extract query parameters
    const query = getQueryParams(url);

    // Call handler with parameters
    // Handler signature: handler(request, env, ctx, params, user)
    return await match.handler(request, env, ctx, match.params, null);

  } catch (error) {
    console.error('Router error:', error);

    // Convert to API error
    const apiError = convertError(error);
    return errorResponse(apiError.message, apiError.status);
  }
}

/**
 * Register a route
 * @param {string} pattern - Route pattern (e.g., "GET /posts/:id")
 * @param {Function} handler - Route handler function
 */
export function registerRoute(pattern, handler) {
  routes.push({ pattern, handler });
}

/**
 * Get all registered routes (for debugging)
 * @returns {Array} Array of routes
 */
export function getRoutes() {
  return routes.map(r => r.pattern);
}
