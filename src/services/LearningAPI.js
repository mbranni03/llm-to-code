/**
 * Learning Platform API Client
 *
 * Centralized service for all learning platform API calls.
 * Handles backend connectivity errors gracefully.
 */

const API_BASE = 'http://localhost:3000'

/**
 * @typedef {Object} Concept
 * @property {string} id
 * @property {string} label
 * @property {string|null} category
 * @property {number} complexity
 * @property {Object|null} metadata
 */

/**
 * @typedef {Concept & { current_score: number }} FrontierConcept
 */

/**
 * @typedef {Object} GeneratedLesson
 * @property {string} conceptId
 * @property {string} title
 * @property {string} markdown
 * @property {{ description: string, expectedOutput: string, validationCriteria: string[], starterFiles?: Array<{path: string, content: string}> }} verificationTask
 * @property {string} generatedAt
 */

/**
 * @typedef {Object} UserProgress
 * @property {number} total
 * @property {number} mastered
 * @property {number} inProgress
 * @property {number} notStarted
 * @property {number} averageMastery
 */

/**
 * @typedef {Object} CompileOutput
 * @property {boolean} success
 * @property {string} stdout
 * @property {string} stderr
 * @property {number} exitCode
 * @property {{ stdout: string, stderr: string }|null} runOutput
 */

/**
 * @typedef {Object} MasteryUpdateResult
 * @property {number} previousScore
 * @property {number} newScore
 * @property {boolean} mastered
 */

class LearningAPIError extends Error {
  constructor(message, isOffline = false) {
    super(message)
    this.name = 'LearningAPIError'
    this.isOffline = isOffline
  }
}

/**
 * Make an API request with error handling
 * @template T
 * @param {string} endpoint
 * @param {RequestInit} [options]
 * @returns {Promise<T>}
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`

  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))

      // Treat 404 as "endpoint not available" - likely backend not configured
      if (response.status === 404) {
        throw new LearningAPIError(
          `Endpoint not found: ${endpoint}. Ensure the backend /learn plugin is running.`,
          true, // treat as offline for UI purposes
        )
      }

      throw new LearningAPIError(error.error || `Request failed: ${response.status}`)
    }

    // Handle text responses (e.g., Mermaid graph)
    const contentType = response.headers.get('content-type')
    if (contentType?.includes('text/plain')) {
      return await response.text()
    }

    return response.json()
  } catch (error) {
    // Re-throw our custom errors
    if (error instanceof LearningAPIError) {
      throw error
    }

    // Handle network errors (backend not running)
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new LearningAPIError(
        'Cannot connect to learning server. Please ensure the backend is running on localhost:3000.',
        true,
      )
    }
    throw error
  }
}

// =====================================================
// KNOWLEDGE GRAPH ENDPOINTS
// =====================================================

/**
 * Get the learning frontier - concepts available to learn
 * @param {string} userId
 * @returns {Promise<FrontierConcept[]>}
 */
export async function getFrontier(userId) {
  return apiRequest(`/frontier/${userId}`)
}

/**
 * Get the next recommended lesson for a user
 * @param {string} userId
 * @param {string} [category]
 * @returns {Promise<{ lesson: FrontierConcept|null, context: string|null, message?: string }>}
 */
export async function getNextLesson(userId, category) {
  const params = category ? `?category=${encodeURIComponent(category)}` : ''
  return apiRequest(`/next/${userId}${params}`)
}

/**
 * Get user progress statistics
 * @param {string} userId
 * @returns {Promise<UserProgress>}
 */
export async function getProgress(userId) {
  return apiRequest(`/progress/${userId}`)
}

/**
 * Get Mermaid diagram of knowledge graph
 * @param {string} [userId]
 * @returns {Promise<string>}
 */
export async function getVisualization(userId) {
  const params = userId ? `?userId=${encodeURIComponent(userId)}` : ''
  return apiRequest(`/visualize${params}`)
}

// =====================================================
// CONCEPT ENDPOINTS
// =====================================================

/**
 * Get a specific concept by ID
 * @param {string} conceptId
 * @returns {Promise<Concept>}
 */
export async function getConcept(conceptId) {
  return apiRequest(`/concept/${conceptId}`)
}

/**
 * Get all concepts
 * @returns {Promise<Concept[]>}
 */
export async function getAllConcepts() {
  return apiRequest('/concepts')
}

// =====================================================
// LESSON ENDPOINTS
// =====================================================

/**
 * Get or generate a lesson for a concept
 * @param {string} conceptId
 * @param {string} [model]
 * @returns {Promise<{ lesson: GeneratedLesson, cached: boolean }>}
 */
export async function getLesson(conceptId, model) {
  const params = model ? `?model=${encodeURIComponent(model)}` : ''
  return apiRequest(`/lesson/${conceptId}${params}`)
}

/**
 * Force regenerate a lesson
 * @param {string} conceptId
 * @param {{ model?: string, force?: boolean }} [options]
 * @returns {Promise<{ lesson: GeneratedLesson, regenerated: boolean }>}
 */
export async function regenerateLesson(conceptId, options = {}) {
  return apiRequest('/lesson/generate', {
    method: 'POST',
    body: JSON.stringify({
      conceptId,
      model: options.model,
      force: options.force ?? true,
    }),
  })
}

/**
 * Delete a cached lesson
 * @param {string} conceptId
 * @returns {Promise<{ deleted: boolean }>}
 */
export async function deleteLesson(conceptId) {
  return apiRequest(`/lesson/${conceptId}`, {
    method: 'DELETE',
  })
}

// =====================================================
// MASTERY ENDPOINTS
// =====================================================

/**
 * Update mastery after completing a lesson
 * @param {{ userId: string, conceptId: string, success: boolean, attempts: number, errorCode?: string }} request
 * @returns {Promise<MasteryUpdateResult>}
 */
export async function updateMastery(request) {
  return apiRequest('/mastery', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

// =====================================================
// COMPILATION ENDPOINTS
// =====================================================

/**
 * Compile and run code
 * @param {{ language: string, code: string }} request
 * @returns {Promise<CompileOutput>}
 */
export async function compile(request) {
  return apiRequest('/compile', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

// =====================================================
// HEALTH CHECK
// =====================================================

/**
 * Check if the backend is running
 * @returns {Promise<boolean>}
 */
export async function isBackendAvailable() {
  try {
    await apiRequest('/')
    return true
  } catch {
    return false
  }
}

export { LearningAPIError }
