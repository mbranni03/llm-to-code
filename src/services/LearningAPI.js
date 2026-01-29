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
 * @property {number} totalTime - Total learning time in seconds
 * @property {Record<string, number>} topicLevels - Mastery level per topic
 * @property {number} overallLevel - Overall level from 1 to 4
 * @property {number} total - Total concepts
 * @property {number} mastered - Mastered concepts
 * @property {number} inProgress - Concepts in progress
 * @property {number} notStarted - Concepts not started
 * @property {number} averageMastery - Average mastery score (0-1)
 * @property {Record<string, { total: number, mastered: number, inProgress: number, notStarted: number, averageMastery: number, overallLevel: number, totalTime: number }>} languages - Detailed stats per language
 */

/**
 * @typedef {Object} CompileOutput
 * @property {boolean} success
 * @property {string} stdout
 * @property {string} stderr
 * @property {number} exitCode
 * @property {{ stdout: string, stderr: string }|null} runOutput
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
// LESSON NAVIGATION ENDPOINTS
// =====================================================

/**
 * Get the next lesson based on current progress
 * @param {string} userId
 * @param {string} [currentConceptId] - Current concept ID (e.g., "rust.basics.functions")
 * @param {string} [language='rust'] - Language to get lessons for (required by backend)
 * @returns {Promise<{ lesson: GeneratedLesson, lastCode?: string, cached: boolean }>}
 */
export async function getNextLesson(userId, currentConceptId, language = 'rust') {
  return apiRequest('/lesson/next', {
    method: 'POST',
    body: JSON.stringify({ userId, currentConceptId, language }),
  })
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
 * @param {string} [language] - Optional language filter (e.g., 'python')
 * @returns {Promise<string>}
 */
export async function getVisualization(userId, language) {
  const queryParams = []
  if (userId) queryParams.push(`userId=${encodeURIComponent(userId)}`)
  if (language) queryParams.push(`language=${encodeURIComponent(language)}`)
  const params = queryParams.length > 0 ? `?${queryParams.join('&')}` : ''
  return apiRequest(`/visualize${params}`)
}

// =====================================================
// LESSON ENDPOINTS
// =====================================================

/**
 * @typedef {Object} LessonsByLanguageResponse
 * @property {string} language - The language identifier
 * @property {number} count - Number of lessons
 * @property {GeneratedLesson[]} lessons - Array of generated lessons
 */

/**
 * Get all generated lessons for a language
 * @param {string} language - The language to fetch lessons for (e.g., 'rust')
 * @param {string} [userId] - Optional user ID for completion status
 * @returns {Promise<GeneratedLesson[]>}
 */
export async function getLessonsByLanguage(language, userId) {
  const params = userId ? `?userId=${encodeURIComponent(userId)}` : ''
  const response = await apiRequest(`/lessons/${encodeURIComponent(language)}${params}`)
  return {
    lessons: response.lessons || [],
    intro: response.intro || null,
  }
}

/**
 * Get a lesson by its lesson ID
 * @param {string} lessonId - Lesson ID (e.g., "004_rust.basics.functions")
 * @param {string} [userId] - Optional user ID for completion status
 * @returns {Promise<{ lesson: GeneratedLesson, lastCode?: string, cached: boolean }>}
 */
export async function getLessonById(lessonId, userId) {
  const params = userId ? `?userId=${encodeURIComponent(userId)}` : ''
  return apiRequest(`/lesson/${encodeURIComponent(lessonId)}${params}`)
}

/**
 * Submit code for comprehensive evaluation
 * @param {{ userId: string, conceptId: string, code: string, timeSpent: number, compiledResult?: { terminal: Array<{type: string, data: string}>, exitCode: number } }} request
 * @typedef {Object} SubmitResponse
 * @property {boolean} passed
 * @property {Object} analysis
 * @property {string} analysis.feedback
 * @property {string[]} [analysis.hintsForNextAttempt]
 * @property {Object} masteryUpdate
 * @property {boolean} masteryUpdate.mastered
 * @property {number} masteryUpdate.newScore
 * @property {number} masteryUpdate.previousScore
 * @property {Object|null} [nextConcept]
 * @property {string} nextConcept.id
 * @property {string} nextConcept.label
 * @property {string} nextConcept.category
 * @property {number} nextConcept.complexity
 * @returns {Promise<SubmitResponse>}
 */
export async function submit(request) {
  return apiRequest('/submit', {
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

/**
 * Ask a question to the AI Mentor
 * @param {{ userId: string, lessonId: string, question: string, code: string, lastOutput?: string }} request
 * @returns {Promise<{ answer: string }>}
 */
export async function askQuestion(request) {
  return apiRequest('/ask', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

export { LearningAPIError }
