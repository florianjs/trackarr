/**
 * Input Validation Utilities
 * Strict validation for user inputs to prevent injection attacks
 */

/**
 * Validate and sanitize an info hash
 * Must be exactly 40 hex characters
 */
export function validateInfoHash(hash: unknown): string {
  if (typeof hash !== 'string') {
    throw createError({
      statusCode: 400,
      message: 'Invalid info hash type',
    });
  }

  const normalized = hash.toLowerCase().trim();

  if (!/^[a-f0-9]{40}$/.test(normalized)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid info hash format. Expected 40 hex characters.',
    });
  }

  return normalized;
}

/**
 * Validate and sanitize a UUID
 */
export function validateUUID(id: unknown): string {
  if (typeof id !== 'string') {
    throw createError({
      statusCode: 400,
      message: 'Invalid ID type',
    });
  }

  const normalized = id.toLowerCase().trim();

  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
      normalized
    )
  ) {
    throw createError({
      statusCode: 400,
      message: 'Invalid ID format',
    });
  }

  return normalized;
}

/**
 * Validate pagination parameters
 */
export function validatePagination(query: Record<string, unknown>): {
  page: number;
  limit: number;
} {
  const page = Math.max(1, parseInt(String(query.page || '1'), 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(String(query.limit || '50'), 10) || 50)
  );

  return { page, limit };
}

/**
 * Sanitize search query
 * Remove potentially dangerous characters while preserving search functionality
 */
export function sanitizeSearch(query: unknown): string {
  if (typeof query !== 'string') return '';

  // Remove control characters, dangerous HTML chars, SQL separators, and limit length
  return query
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .replace(/[<>'"]/g, '') // Block dangerous HTML characters
    .replace(/[;\\]/g, '') // Block SQL separators
    .slice(0, 200)
    .trim();
}

/**
 * Validate category name
 */
export function validateCategoryName(name: unknown): string {
  if (typeof name !== 'string') {
    throw createError({
      statusCode: 400,
      message: 'Category name must be a string',
    });
  }

  const trimmed = name.trim();

  if (trimmed.length < 2 || trimmed.length > 50) {
    throw createError({
      statusCode: 400,
      message: 'Category name must be 2-50 characters',
    });
  }

  // Only allow alphanumeric, spaces, and basic punctuation
  if (!/^[\w\s\-&.]+$/i.test(trimmed)) {
    throw createError({
      statusCode: 400,
      message: 'Category name contains invalid characters',
    });
  }

  return trimmed;
}
