import { defineStore, acceptHMRUpdate } from 'pinia'
import * as LearningAPI from '../services/LearningAPI'

// Fallback mock lesson for offline mode
const FALLBACK_LESSON = {
  id: 'offline',
  title: 'Offline Mode',
  description: 'Backend is not available',
  isCompleted: false,
  isLocked: false,
  content: `
# Backend Unavailable

The learning server is not running. Please start the backend server to load lessons.

\`\`\`bash
# Start the backend server
bun run /learn
\`\`\`
  `,
  files: [
    {
      name: 'src/main.rs',
      language: 'rust',
      code: `fn main() {\n    println!("Hello, world!");\n}`,
    },
  ],
}

export const useLessonStore = defineStore('lesson', {
  state: () => ({
    // User identity
    userId: 'default_user',

    // Current lesson (API-driven or fallback)
    currentLessonId: null, // lessonId (e.g., "004_rust.basics.functions")
    currentLessonData: null, // GeneratedLesson from API

    // Loading states
    isLoadingLesson: false,
    isGeneratingLesson: false,
    lessonError: null,
    isBackendOnline: true,

    // Current language being learned
    currentLanguage: 'rust',

    // Generated lessons by language (course content)
    // These are lessons that have been generated and are available
    generatedLessons: [], // Array of GeneratedLesson objects
    isLoadingLessons: false,

    // Progress stats
    progress: {
      totalTime: 0,
      topicLevels: {},
      overallLevel: 1,
      total: 0,
      mastered: 0,
      inProgress: 0,
      notStarted: 0,
      averageMastery: 0,
    },

    // Compilation
    isCompiling: false,
    compileResult: null,
    attempts: 0,

    // Editor code
    editorCode: '',

    // UI State
    isSidebarOpen: false,
    showSystemUpdate: false,

    // Submission
    isSubmitting: false,
    lastSubmission: null,

    // User profile (static for now, could be API-driven later)
    userProfile: {
      name: 'User',
      level: 5,
      xp: 1250,
      totalTime: '12h 30m',
      languages: [
        {
          id: 'rust',
          name: 'Rust',
          description: 'Systems programming with safety and speed.',
          color: '#dea584',
          icon: 'fab fa-rust',
          comingSoon: false,
          disabled: false,
        },
        {
          id: 'python',
          name: 'Python',
          description: 'Great for data science and rapid prototyping.',
          color: '#3572A5',
          icon: 'fab fa-python',
          comingSoon: true,
          disabled: true,
        },
        {
          id: 'javascript',
          name: 'JavaScript',
          description: 'The language of the web.',
          color: '#f1e05a',
          icon: 'fab fa-square-js',
          comingSoon: true,
          disabled: true,
        },
      ],
    },
  }),

  getters: {
    // Current lesson object (compatible with existing UI)
    currentLesson(state) {
      if (!state.isBackendOnline) {
        return FALLBACK_LESSON
      }

      if (!state.currentLessonData) {
        return null
      }

      // Transform API lesson to UI-compatible format
      return {
        id: state.currentLessonData.conceptId,
        lessonId: state.currentLessonData.lessonId,
        lessonNumber: state.currentLessonData.lessonNumber,
        title: state.currentLessonData.title,
        description: extractCategoryFromConceptId(state.currentLessonData.conceptId),
        content: state.currentLessonData.markdown,
        isCompleted: state.currentLessonData.completed === true,
        isLocked: false,
        files: state.currentLessonData.verificationTask?.starterFiles?.map((f) => ({
          name: f.path,
          language: f.path.endsWith('.rs') ? 'rust' : 'text',
          code: f.content,
        })) || [
          {
            name: 'src/main.rs',
            language: 'rust',
            code: extractStarterCode(state.currentLessonData.markdown),
          },
        ],
        verificationTask: state.currentLessonData.verificationTask,
        isIntro: !!state.currentLessonData.isIntro,
      }
    },

    currentLessonIndex(state) {
      if (!state.currentLessonId || this.lessons.length === 0) return 0
      const idx = this.lessons.findIndex((l) => l.lessonId === state.currentLessonId)
      return idx >= 0 ? idx : 0
    },

    totalSteps(state) {
      // Don't count intro in total steps
      return state.generatedLessons.filter((l) => !l.isIntro).length || 1
    },

    currentStep() {
      const idx = this.currentLessonIndex
      const current = this.lessons[idx]

      if (current?.isIntro) return 'Intro'

      // If there is an intro, offset the index so the first real lesson is 1
      const hasIntro = this.lessons.some((l) => l.isIntro)
      return hasIntro ? idx : idx + 1
    },

    isFirstLesson() {
      return this.currentLessonIndex === 0
    },

    isLastLesson(state) {
      return this.currentLessonIndex === state.generatedLessons.length - 1
    },

    formattedTotalTime(state) {
      const seconds = state.progress?.totalTime / 1000 || 0
      const h = Math.floor(seconds / 3600)
      const m = Math.floor((seconds % 3600) / 60)
      if (h > 0) return `${h}h ${m}m`
      return `${m}m`
    },

    overallLevel(state) {
      return state.progress?.overallLevel || 1
    },

    // Lessons array for sidebar display
    // Transforms generatedLessons into a format compatible with LessonSidebar
    // Response fields: lessonId, lessonNumber, conceptId, title, markdown, verificationTask, generatedAt, completed
    lessons(state) {
      return [...state.generatedLessons]
        .sort((a, b) => {
          // Intro always comes first
          if (a.isIntro) return -1
          if (b.isIntro) return 1
          return (a.lessonNumber || 0) - (b.lessonNumber || 0)
        })
        .map((lesson) => ({
          id: lesson.conceptId,
          lessonId: lesson.lessonId,
          lessonNumber: lesson.lessonNumber,
          title: lesson.title,
          description: lesson.isIntro
            ? 'Introduction'
            : extractCategoryFromConceptId(lesson.conceptId),
          isCompleted: lesson.completed === true && !lesson.isIntro,
          isLocked: false, // All generated lessons are available
          generatedAt: lesson.generatedAt,
          isIntro: !!lesson.isIntro,
        }))
    },
  },

  actions: {
    // =====================================================
    // INITIALIZATION
    // =====================================================

    async initialize() {
      this.isBackendOnline = await LearningAPI.isBackendAvailable()

      if (this.isBackendOnline) {
        await Promise.all([this.loadProgress(), this.loadLessonsForLanguage(this.currentLanguage)])

        // Load the last lesson if available and no lesson is currently loaded
        if (this.generatedLessons.length > 0 && !this.currentLessonId) {
          const lastLesson = this.generatedLessons[this.generatedLessons.length - 1]
          await this.loadLesson(lastLesson.lessonId)
        }
      } else {
        this.lessonError = 'Backend server is not running'
      }
    },

    // =====================================================
    // LESSON LOADING (API-driven)
    // =====================================================

    /**
     * Load all generated lessons for a language
     * @param {string} language - The language to fetch lessons for (e.g., 'rust')
     */
    async loadLessonsForLanguage(language = 'rust') {
      this.isLoadingLessons = true

      try {
        const { lessons, intro } = await LearningAPI.getLessonsByLanguage(language, this.userId)

        const allLessons = [...(lessons || [])]

        // Prepend intro if available
        if (intro) {
          intro.conceptId = intro.lessonId // Ensure conceptId exists for compatibility
          intro.isIntro = true
          // Check if intro is already in the list to avoid duplicates if backend returns it in both places (unlikely but safe)
          if (!allLessons.find((l) => l.lessonId === intro.lessonId)) {
            allLessons.unshift(intro)
          }
        }

        this.generatedLessons = allLessons
        this.currentLanguage = language
      } catch (error) {
        console.error('Failed to load lessons for language:', error)
        // Non-fatal error - continue with empty lessons
        this.generatedLessons = []
      } finally {
        this.isLoadingLessons = false
      }
    },

    /**
     * Resume course for a specific language
     * - Loads lessons for the language
     * - Navigates to the latest lesson (or intro)
     * @param {string} languageId
     * @param {Object} router - Vue Router instance
     */
    async resumeCourse(languageId, router) {
      if (!languageId || !router) return

      try {
        // Ensure we load lessons for the selected language
        // This ensures we can find the latest one to navigate to
        if (this.currentLanguage !== languageId || this.generatedLessons.length === 0) {
          await this.loadLessonsForLanguage(languageId)
        }

        const lessons = this.generatedLessons
        if (lessons && lessons.length > 0) {
          // Navigate to the latest (last) lesson
          const latestLesson = lessons[lessons.length - 1]
          router.push({ name: 'learn', params: { lessonId: latestLesson.lessonId } })
        } else {
          // Fallback if no lessons found
          router.push('/learn')
        }
      } catch (e) {
        console.error('Failed to resume course:', e)
        router.push('/learn')
      }
    },

    /**
     * Add a lesson to the generated lessons list if not already present
     * Preserves completed status when updating existing lessons
     * @param {Object} lessonData - The generated lesson data
     */
    addGeneratedLesson(lessonData) {
      if (!lessonData?.conceptId) return

      // Check if lesson already exists
      const idx = this.generatedLessons.findIndex((l) => l.conceptId === lessonData.conceptId)

      if (idx === -1) {
        // New lesson - add to list
        this.generatedLessons.push(lessonData)
      } else {
        // Update existing lesson, preserving completed status
        const existingLesson = this.generatedLessons[idx]
        this.generatedLessons[idx] = {
          ...lessonData,
          // Preserve completed status - only mark complete, never un-complete
          completed: existingLesson.completed === true || lessonData.completed === true,
        }
      }
    },

    async loadNextLesson(currentLessonId) {
      this.isLoadingLesson = true
      this.isGeneratingLesson = true
      this.lessonError = null

      try {
        const response = await LearningAPI.getNextLesson(this.userId, currentLessonId)

        if (!response.lesson) {
          this.lessonError = response.message || 'No lessons available'
          this.currentLessonData = null
          return
        }

        const lessonData = response.lesson

        // Store both lessonId and conceptId
        this.currentLessonId = lessonData.lessonId
        this.currentLessonData = lessonData

        // Add the new lesson to generated lessons list
        this.addGeneratedLesson(lessonData)

        // Load starter code from verification task or markdown
        const starterFiles = lessonData.verificationTask?.starterFiles
        if (starterFiles && starterFiles.length > 0) {
          const mainFile = starterFiles.find((f) => f.path.endsWith('main.rs')) || starterFiles[0]
          this.editorCode = mainFile.content
        } else if (!lessonData.isIntro) {
          // Only extract code if it's not an intro
          this.editorCode = extractStarterCode(lessonData.markdown)
        } else {
          this.editorCode = ''
        }
        this.attempts = 0
        this.compileResult = null
        this.lastSubmission = null
      } catch (error) {
        this.handleApiError(error)
      } finally {
        this.isLoadingLesson = false
        this.isGeneratingLesson = false
      }
    },

    async loadLesson(lessonId) {
      // Check if full lesson is already in memory (has markdown content)
      const existing = this.generatedLessons.find((l) => l.lessonId === lessonId)
      const hasFullContent = existing?.markdown && existing.markdown.length > 0

      if (existing && hasFullContent) {
        this.currentLessonId = existing.lessonId
        this.currentLessonData = existing

        // Load starter code from verification task or markdown
        const starterFiles = existing.verificationTask?.starterFiles
        if (starterFiles && starterFiles.length > 0) {
          const mainFile = starterFiles.find((f) => f.path.endsWith('main.rs')) || starterFiles[0]
          this.editorCode = mainFile.content
        } else if (!existing.isIntro) {
          this.editorCode = extractStarterCode(existing.markdown)
        } else {
          this.editorCode = ''
        }
        this.attempts = 0
        this.compileResult = null
        this.lastSubmission = null
        return
      }

      // Fetch full content from API (cached data is minimal)
      this.isLoadingLesson = true
      this.isGeneratingLesson = true
      this.lessonError = null

      try {
        const lessonResponse = await LearningAPI.getLessonById(lessonId, this.userId)

        const lessonData = lessonResponse.lesson
        this.currentLessonId = lessonData.lessonId
        this.currentLessonData = lessonData

        // Update generated lessons list with full content
        this.addGeneratedLesson(lessonData)

        // Load starter code from verification task or markdown
        const starterFiles = lessonData.verificationTask?.starterFiles
        if (starterFiles && starterFiles.length > 0) {
          const mainFile = starterFiles.find((f) => f.path.endsWith('main.rs')) || starterFiles[0]
          this.editorCode = mainFile.content
        } else if (!lessonData.isIntro) {
          this.editorCode = extractStarterCode(lessonData.markdown)
        } else {
          this.editorCode = ''
        }
        this.attempts = 0
        this.compileResult = null
        this.lastSubmission = null
      } catch (error) {
        this.handleApiError(error)
      } finally {
        this.isLoadingLesson = false
        this.isGeneratingLesson = false
      }
    },

    // =====================================================
    // PROGRESS
    // =====================================================

    async loadProgress() {
      try {
        const data = await LearningAPI.getProgress(this.userId)

        // Ensure averageMastery is calculated if not provided by backend
        // This handles cases where only topicLevels is returned
        if (
          data?.topicLevels &&
          (data.averageMastery === undefined || data.averageMastery === null)
        ) {
          const scores = Object.values(data.topicLevels)
          if (scores.length > 0) {
            data.averageMastery = scores.reduce((a, b) => a + b, 0) / scores.length
          } else {
            data.averageMastery = 0
          }
        }

        this.progress = {
          ...this.progress, // Keep defaults
          ...data,
        }
      } catch (error) {
        console.error('Failed to load progress:', error)
      }
    },

    // =====================================================
    // COMPILATION
    // =====================================================

    async compileCode() {
      this.isCompiling = true
      this.attempts++

      try {
        const result = await LearningAPI.compile({
          language: 'rust',
          code: this.editorCode,
        })

        // Normalize result
        if (result.success === undefined) {
          result.success = result.exitCode === 0
        }

        this.compileResult = result
        return result
      } catch (error) {
        this.compileResult = {
          success: false,
          stdout: '',
          stderr: error.message,
          exitCode: 1,
        }
        return this.compileResult
      } finally {
        this.isCompiling = false
      }
    },

    // =====================================================
    // MASTERY & SUBMISSION
    // =====================================================

    async submitCode(code, timeSpent = 0) {
      if (!this.currentLessonData?.conceptId) return

      this.isSubmitting = true
      try {
        const payload = {
          userId: this.userId,
          conceptId: this.currentLessonData.conceptId,
          code,
          timeSpent,
        }

        const response = await LearningAPI.submit(payload)

        // Update state with result
        this.lastSubmission = response

        // Mark as completed if passed and not an intro
        if (response.passed && !this.currentLesson?.isIntro) {
          this.markLessonCompleted(this.currentLessonData.conceptId)
        }

        // Sync attempt number if available
        if (typeof response.attemptNumber === 'number') {
          this.attempts = response.attemptNumber
        }

        // Always refresh progress after submission to get updated totalTime and overallLevel
        await this.loadProgress()

        return response
      } catch (error) {
        console.error('Submission failed:', error)
        throw error
      } finally {
        this.isSubmitting = false
      }
    },

    // =====================================================
    // NAVIGATION (backward compatibility)
    // =====================================================

    async nextLesson() {
      const lessons = this.lessons
      const currentIndex = this.currentLessonIndex
      if (currentIndex < lessons.length - 1) {
        const nextLesson = lessons[currentIndex + 1]
        await this.loadLesson(nextLesson.lessonId)
      }
    },

    async prevLesson() {
      const lessons = this.lessons
      const currentIndex = this.currentLessonIndex
      if (currentIndex > 0) {
        const prevLesson = lessons[currentIndex - 1]
        await this.loadLesson(prevLesson.lessonId)
      }
    },

    markLessonCompleted(conceptId) {
      const lesson = this.generatedLessons.find((l) => l.conceptId === conceptId)
      if (lesson) {
        lesson.completed = true
      }
    },

    async setCurrentLesson(id) {
      await this.loadLesson(id)
    },

    // =====================================================
    // UI ACTIONS
    // =====================================================

    setEditorCode(code) {
      this.editorCode = code
    },

    toggleSidebar() {
      this.isSidebarOpen = !this.isSidebarOpen
    },

    setSidebarOpen(isOpen) {
      this.isSidebarOpen = isOpen
    },

    triggerSystemUpdate() {
      this.showSystemUpdate = true
    },

    // =====================================================
    // ERROR HANDLING
    // =====================================================

    handleApiError(error) {
      if (error.isOffline) {
        this.isBackendOnline = false
        this.lessonError = error.message
      } else {
        this.lessonError = error.message
      }
      console.error('API Error:', error)
    },
  },
})

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Extract category from conceptId
 * e.g., "rust.basics.variables" → "Basics"
 * @param {string} conceptId
 * @returns {string}
 */
function extractCategoryFromConceptId(conceptId) {
  if (!conceptId) return 'General'
  const parts = conceptId.split('.')
  // Take the second part (e.g., "basics" from "rust.basics.variables")
  if (parts.length >= 2) {
    return parts[1].charAt(0).toUpperCase() + parts[1].slice(1)
  }
  return 'General'
}

/**
 * Extract starter code from lesson markdown
 * Looks for code blocks with `rust` language
 */
function extractStarterCode(markdown) {
  if (!markdown) return 'fn main() {\n    // Start coding here\n}'

  // Look for "Starting Code" section
  const startingMatch = markdown.match(/\*\*Starting Code:\*\*\s*\n```rust\s*\n([\s\S]*?)\n```/i)
  if (startingMatch?.[1]) {
    return startingMatch[1].trim()
  }

  // Fallback: find the first rust code block
  const codeMatch = markdown.match(/```rust\s*\n([\s\S]*?)\n```/)
  if (codeMatch?.[1]) {
    return codeMatch[1].trim()
  }

  return 'fn main() {\n    // Start coding here\n}'
}

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useLessonStore, import.meta.hot))
}
