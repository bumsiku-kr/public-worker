/**
 * Response Utilities
 * Standard response formatting and CORS handling
 */

/**
 * Create a JSON response with standard headers
 * @param {Object} data - Response data
 * @param {number} status - HTTP status code
 * @param {Object} additionalHeaders - Additional headers to include
 * @returns {Response}
 */
export function jsonResponse(data, status = 200, additionalHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...additionalHeaders
    }
  });
}

/**
 * Create a standardized success response
 * @param {*} data - Response data payload
 * @param {number} status - HTTP status code (default: 200)
 * @returns {Response}
 */
export function successResponse(data, status = 200) {
  return jsonResponse({
    success: true,
    data,
    error: null
  }, status);
}

/**
 * Create a standardized error response
 * @param {string} message - Error message
 * @param {number} status - HTTP status code (default: 400)
 * @returns {Response}
 */
export function errorResponse(message, status = 400) {
  return jsonResponse({
    success: false,
    data: null,
    error: {
      code: status,
      message
    }
  }, status);
}

/**
 * Generate CORS headers
 * @param {string} allowedOrigins - Allowed origins (default: '*')
 * @returns {Object} CORS headers
 */
export function corsHeaders(allowedOrigins = '*') {
  return {
    'Access-Control-Allow-Origin': allowedOrigins,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  };
}

/**
 * Handle CORS preflight requests
 * @param {string} allowedOrigins - Allowed origins
 * @returns {Response}
 */
export function handleCORS(allowedOrigins = '*') {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(allowedOrigins)
  });
}

/**
 * Add CORS headers to an existing response
 * @param {Response} response - Original response
 * @param {string} allowedOrigins - Allowed origins
 * @returns {Response} Response with CORS headers
 */
export function addCORSHeaders(response, allowedOrigins = '*') {
  const newHeaders = new Headers(response.headers);
  const cors = corsHeaders(allowedOrigins);

  Object.entries(cors).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}
