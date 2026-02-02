import { v4 as uuidv4 } from 'uuid'

/**
 * Generate a unique ID for elements, slides, etc.
 */
export function generateId(): string {
  return uuidv4()
}

/**
 * Generate a short ID for display purposes
 */
export function generateShortId(): string {
  return uuidv4().slice(0, 8)
}
