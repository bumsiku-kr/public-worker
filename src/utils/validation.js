/**
 * Input Validation Utilities
 * Common validation functions for request data
 */

import { ValidationError } from './errors.js';

/**
 * Validate required fields are present
 * @param {Object} data - Data to validate
 * @param {Array<string>} requiredFields - Array of required field names
 * @throws {ValidationError} If any required field is missing
 */
export function validateRequired(data, requiredFields) {
  const missing = requiredFields.filter(field => {
    const value = data[field];
    return value === undefined || value === null || value === '';
  });

  if (missing.length > 0) {
    throw new ValidationError(`Missing required fields: ${missing.join(', ')}`);
  }
}

/**
 * Validate string length
 * @param {string} value - String to validate
 * @param {string} fieldName - Field name for error message
 * @param {number} min - Minimum length
 * @param {number} max - Maximum length
 * @throws {ValidationError} If string length is invalid
 */
export function validateStringLength(value, fieldName, min, max) {
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`);
  }

  const length = value.trim().length;

  if (length < min) {
    throw new ValidationError(`${fieldName} must be at least ${min} characters`);
  }

  if (length > max) {
    throw new ValidationError(`${fieldName} must not exceed ${max} characters`);
  }
}

/**
 * Validate slug format (lowercase alphanumeric with hyphens)
 * @param {string} slug - Slug to validate
 * @throws {ValidationError} If slug format is invalid
 */
export function validateSlug(slug) {
  const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  if (!slugPattern.test(slug)) {
    throw new ValidationError(
      'Slug must contain only lowercase letters, numbers, and hyphens (pattern: a-z0-9-)'
    );
  }
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @throws {ValidationError} If email format is invalid
 */
export function validateEmail(email) {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(email)) {
    throw new ValidationError('Invalid email format');
  }
}

/**
 * Validate enum value
 * @param {*} value - Value to validate
 * @param {string} fieldName - Field name for error message
 * @param {Array} allowedValues - Array of allowed values
 * @throws {ValidationError} If value is not in allowed values
 */
export function validateEnum(value, fieldName, allowedValues) {
  if (!allowedValues.includes(value)) {
    throw new ValidationError(
      `${fieldName} must be one of: ${allowedValues.join(', ')}`
    );
  }
}

/**
 * Validate array
 * @param {*} value - Value to validate
 * @param {string} fieldName - Field name for error message
 * @param {number} maxItems - Maximum number of items (optional)
 * @throws {ValidationError} If value is not a valid array
 */
export function validateArray(value, fieldName, maxItems = null) {
  if (!Array.isArray(value)) {
    throw new ValidationError(`${fieldName} must be an array`);
  }

  if (maxItems && value.length > maxItems) {
    throw new ValidationError(`${fieldName} must not exceed ${maxItems} items`);
  }
}

/**
 * Validate number range
 * @param {number} value - Value to validate
 * @param {string} fieldName - Field name for error message
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @throws {ValidationError} If value is not in valid range
 */
export function validateNumberRange(value, fieldName, min, max) {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new ValidationError(`${fieldName} must be a number`);
  }

  if (value < min || value > max) {
    throw new ValidationError(`${fieldName} must be between ${min} and ${max}`);
  }
}

/**
 * Validate post creation/update request
 * @param {Object} data - Post data to validate
 * @throws {ValidationError} If validation fails
 */
export function validatePostRequest(data) {
  validateRequired(data, ['title', 'content', 'summary', 'state']);

  validateStringLength(data.title, 'title', 1, 100);
  validateStringLength(data.content, 'content', 1, 10000);
  validateStringLength(data.summary, 'summary', 1, 200);
  validateEnum(data.state, 'state', ['published', 'draft']);

  if (data.slug) {
    validateSlug(data.slug);
  }

  if (data.tags) {
    validateArray(data.tags, 'tags', 20);
    data.tags.forEach((tag, index) => {
      if (typeof tag !== 'string' || tag.trim().length === 0) {
        throw new ValidationError(`Tag at index ${index} must be a non-empty string`);
      }
    });
  }
}

/**
 * Validate comment creation request
 * @param {Object} data - Comment data to validate
 * @throws {ValidationError} If validation fails
 */
export function validateCommentRequest(data) {
  validateRequired(data, ['content', 'author']);

  validateStringLength(data.content, 'content', 1, 500);
  validateStringLength(data.author, 'author', 2, 20);
}

/**
 * Validate login request
 * @param {Object} data - Login data to validate
 * @throws {ValidationError} If validation fails
 */
export function validateLoginRequest(data) {
  validateRequired(data, ['username', 'password']);

  validateStringLength(data.username, 'username', 2, 50);
  validateStringLength(data.password, 'password', 1, 100);
}

/**
 * Validate pagination parameters
 * @param {Object} params - Query parameters
 * @returns {Object} Validated pagination params
 */
export function validatePaginationParams(params) {
  const page = parseInt(params.page || '0', 10);
  const size = parseInt(params.size || '10', 10);

  if (isNaN(page) || page < 0) {
    throw new ValidationError('Page must be a non-negative integer');
  }

  if (isNaN(size) || size < 1 || size > 100) {
    throw new ValidationError('Size must be between 1 and 100');
  }

  return { page, size };
}

/**
 * Validate sort parameter
 * @param {string} sort - Sort parameter (format: "field,direction")
 * @param {Array<string>} allowedFields - Allowed sort fields
 * @returns {Object} Validated sort params
 */
export function validateSortParam(sort = 'createdAt,desc', allowedFields = ['createdAt', 'updatedAt', 'views', 'title']) {
  const [field, direction = 'desc'] = sort.split(',');

  if (!allowedFields.includes(field)) {
    throw new ValidationError(`Sort field must be one of: ${allowedFields.join(', ')}`);
  }

  if (!['asc', 'desc'].includes(direction.toLowerCase())) {
    throw new ValidationError('Sort direction must be "asc" or "desc"');
  }

  return { field, direction: direction.toLowerCase() };
}
