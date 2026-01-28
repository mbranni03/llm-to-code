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
    currentLessonId: null,
    currentLessonData: null, // GeneratedLesson from API
    currentConcept: null, // FrontierConcept from API

    // Loading states
    isLoadingLesson: false,
    isGeneratingLesson: false,
    lessonError: null,
    isBackendOnline: true,

    // Frontier (available lessons)
    frontier: [],
    lessons: [], // For backward compatibility with sidebar

    // Progress stats
    progress: null,

    // Compilation
    isCompiling: false,
    compileResult: null,
    attempts: 0,

    // Editor code
    editorCode: '',

    // UI State
    isSidebarOpen: false,
    showSystemUpdate: false,

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
        title: state.currentLessonData.title,
        description: state.currentConcept?.label || '',
        content: state.currentLessonData.markdown,
        isCompleted: (state.currentConcept?.current_score || 0) >= 0.8,
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
        complexity: state.currentConcept?.complexity || 1,
        category: state.currentConcept?.category || 'Basics',
      }
    },

    currentLessonIndex(state) {
      if (!state.currentConcept || state.frontier.length === 0) return 0
      const idx = state.frontier.findIndex((c) => c.id === state.currentConcept.id)
      return idx >= 0 ? idx : 0
    },

    totalSteps(state) {
      return state.frontier.length || 1
    },

    currentStep() {
      return this.currentLessonIndex + 1
    },

    isFirstLesson() {
      return this.currentLessonIndex === 0
    },

    isLastLesson(state) {
      return this.currentLessonIndex === state.frontier.length - 1
    },

    masteryPercent(state) {
      return state.progress ? Math.round(state.progress.averageMastery * 100) : 0
    },
  },

  actions: {
    // =====================================================
    // INITIALIZATION
    // =====================================================

    async initialize() {
      this.isBackendOnline = await LearningAPI.isBackendAvailable()

      if (this.isBackendOnline) {
        await Promise.all([this.loadFrontier(), this.loadProgress()])

        // Load first available lesson
        if (this.frontier.length > 0) {
          await this.loadNextLesson()
        }
      } else {
        this.lessonError = 'Backend server is not running'
      }
    },

    // =====================================================
    // LESSON LOADING (API-driven)
    // =====================================================

    async loadNextLesson(category) {
      this.isLoadingLesson = true
      this.isGeneratingLesson = true
      this.lessonError = null

      try {
        const response = await LearningAPI.getNextLesson(this.userId, category)

        if (!response.lesson) {
          this.lessonError = response.message || 'No lessons available'
          this.currentConcept = null
          this.currentLessonData = null
          return
        }

        this.currentConcept = response.lesson
        this.currentLessonId = response.lesson.id

        // Fetch full lesson content
        const lessonResponse = await LearningAPI.getLesson(response.lesson.id)

        this.currentLessonData = lessonResponse.lesson

        // Load starter code from verification task or markdown
        const starterFiles = lessonResponse.lesson.verificationTask?.starterFiles
        if (starterFiles && starterFiles.length > 0) {
          const mainFile = starterFiles.find((f) => f.path.endsWith('main.rs')) || starterFiles[0]
          this.editorCode = mainFile.content
        } else {
          this.editorCode = extractStarterCode(lessonResponse.lesson.markdown)
        }
        this.attempts = 0
        this.compileResult = null
      } catch (error) {
        this.handleApiError(error)
      } finally {
        this.isLoadingLesson = false
        this.isGeneratingLesson = false
      }
    },

    async loadLesson(conceptId) {
      this.isLoadingLesson = true
      this.isGeneratingLesson = true
      this.lessonError = null

      try {
        // Get concept details
        const concept = await LearningAPI.getConcept(conceptId)

        // Get/generate lesson
        const lessonResponse = await LearningAPI.getLesson(conceptId)

        this.currentConcept = { ...concept, current_score: 0 }
        this.currentLessonId = conceptId
        this.currentLessonData = lessonResponse.lesson

        // Load starter code from verification task or markdown
        const starterFiles = lessonResponse.lesson.verificationTask?.starterFiles
        if (starterFiles && starterFiles.length > 0) {
          const mainFile = starterFiles.find((f) => f.path.endsWith('main.rs')) || starterFiles[0]
          this.editorCode = mainFile.content
        } else {
          this.editorCode = extractStarterCode(lessonResponse.lesson.markdown)
        }
        this.attempts = 0
        this.compileResult = null
      } catch (error) {
        this.handleApiError(error)
      } finally {
        this.isLoadingLesson = false
        this.isGeneratingLesson = false
      }
    },

    // =====================================================
    // FRONTIER & PROGRESS
    // =====================================================

    async loadFrontier() {
      try {
        this.frontier = await LearningAPI.getFrontier(this.userId)

        // Also populate lessons array for sidebar compatibility
        this.lessons = this.frontier.map((concept) => ({
          id: concept.id,
          title: concept.label,
          description: concept.category || '',
          isCompleted: concept.current_score >= 0.8,
          isLocked: false,
        }))
      } catch (error) {
        console.error('Failed to load frontier:', error)
      }
    },

    async loadProgress() {
      try {
        this.progress = await LearningAPI.getProgress(this.userId)
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

    async submitLesson(success, errorCode) {
      if (!this.currentConcept) {
        throw new Error('No current concept')
      }

      try {
        const result = await LearningAPI.updateMastery({
          userId: this.userId,
          conceptId: this.currentConcept.id,
          success,
          attempts: this.attempts,
          errorCode,
        })

        // Refresh data
        await Promise.all([this.loadProgress(), this.loadFrontier()])

        // Auto-advance if mastered
        if (result.mastered) {
          await this.loadNextLesson()
        }

        return result
      } catch (error) {
        console.error('Failed to update mastery:', error)
        throw error
      }
    },

    // =====================================================
    // NAVIGATION (backward compatibility)
    // =====================================================

    async nextLesson() {
      const currentIndex = this.currentLessonIndex
      if (currentIndex < this.frontier.length - 1) {
        const nextConcept = this.frontier[currentIndex + 1]
        await this.loadLesson(nextConcept.id)
      }
    },

    async prevLesson() {
      const currentIndex = this.currentLessonIndex
      if (currentIndex > 0) {
        const prevConcept = this.frontier[currentIndex - 1]
        await this.loadLesson(prevConcept.id)
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
