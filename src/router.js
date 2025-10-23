import { errorResponse } from "./utils/response.js";
import { toAPIError } from "./utils/errors.js";
import { createLogger } from "./utils/logger.js";
import {
  handleGetPosts,
  handleGetPostBySlug,
  handleIncrementViews,
} from "./handlers/posts.js";
import { handleGetComments, handleCreateComment } from "./handlers/comments.js";
import { handleGetTags } from "./handlers/tags.js";
import { handleGetSitemap } from "./handlers/sitemap.js";

const routes = [
  { pattern: "GET /posts", handler: handleGetPosts },
  { pattern: "GET /posts/:slug", handler: handleGetPostBySlug },
  { pattern: "PATCH /posts/:postId/views", handler: handleIncrementViews },
  { pattern: "GET /comments/:postId", handler: handleGetComments },
  { pattern: "POST /comments/:postId", handler: handleCreateComment },
  { pattern: "GET /tags", handler: handleGetTags },
  { pattern: "GET /sitemap", handler: handleGetSitemap },
];

/**
 * Match a route pattern against a URL path
 * @param {string} pattern - Route pattern (e.g., "/posts/:id")
 * @param {string} path - URL path (e.g., "/posts/123")
 * @returns {Object|null} Match result with params, or null if no match
 */
function matchPattern(pattern, path) {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = path.split("/").filter(Boolean);

  if (patternParts.length !== pathParts.length) {
    return null;
  }

  const params = {};

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    const pathPart = pathParts[i];

    if (patternPart.startsWith(":")) {
      const paramName = patternPart.substring(1);
      params[paramName] = decodeURIComponent(pathPart);
    } else if (patternPart !== pathPart) {
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
    const [routeMethod, routePattern] = route.pattern.split(" ", 2);

    if (routeMethod !== method) {
      continue;
    }

    const match = matchPattern(routePattern, pathname);
    if (match) {
      return {
        handler: route.handler,
        params: match.params,
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
    throw new Error("Invalid JSON in request body");
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
 * @param {string} requestId - Request correlation ID
 * @returns {Promise<Response>} Response object
 */
export async function router(request, env, ctx, requestId) {
  const logger = createLogger(requestId);

  try {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    const match = findRoute(method, pathname);

    if (!match) {
      logger.warn("Route not found", {
        type: "routing",
        method,
        pathname,
      });
      return errorResponse("Not Found", 404);
    }

    // Log route match
    logger.debug("Route matched", {
      type: "routing",
      route: `${method} ${pathname}`,
      params: match.params,
    });

    let body = null;
    if (["POST", "PUT", "PATCH"].includes(method)) {
      body = await parseJsonBody(request);
      logger.debug("Request body parsed", {
        type: "routing",
        bodySize: JSON.stringify(body).length,
      });
    }

    const query = getQueryParams(url);

    // Pass requestId to handler for consistent logging
    const handlerStartTime = Date.now();
    const response = await match.handler(request, env, ctx, match.params, null, requestId);
    const handlerDuration = Date.now() - handlerStartTime;

    logger.debug("Handler completed", {
      type: "routing",
      handler: match.handler.name,
      performance: {
        duration: `${handlerDuration}ms`,
        durationMs: handlerDuration,
      },
    });

    return response;
  } catch (error) {
    logger.error("Router error", {
      type: "routing",
      error: {
        message: error.message,
        name: error.name,
        stack: error.stack,
      },
    });

    const apiError = toAPIError(error);
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
  return routes.map((r) => r.pattern);
}
