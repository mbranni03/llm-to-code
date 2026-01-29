<template>
  <div class="split-layout">
    <!-- Loading Overlay for lesson generation -->
    <LoadingOverlay
      :model-value="isGeneratingLesson"
      :status-message="isBackendOnline ? 'GENERATING' : 'OFFLINE'"
    />

    <!-- Intro Page Mode -->
    <IntroPage
      v-if="currentLesson && currentLesson.isIntro"
      :title="currentLesson.title"
      :content="currentLesson.content"
      @continue="handleNextLesson"
      @toggle-sidebar="toggleSidebar"
    />

    <!-- Left Pane: Instructions (Standard Lesson) -->
    <div class="pane left-pane" ref="leftPane" v-else>
      <div class="pane-header">
        <div class="header-top-row">
          <div class="module-info">
            <span class="module-overline">Module: {{ moduleName }}</span>
            <span class="step-indicator">Lesson {{ currentStep }}</span>
          </div>
          <button
            class="btn-map-toggle"
            @click="isSidebarOpen = !isSidebarOpen"
            :class="{ 'is-active': isSidebarOpen }"
            title="Toggle Learning Path"
          >
            <span class="material-icons">map</span>
            <span class="btn-label">Path</span>
          </button>
        </div>
      </div>

      <!-- Error state -->
      <div v-if="lessonError" class="error-state">
        <span class="material-icons error-icon">error_outline</span>
        <h3>{{ isBackendOnline ? 'Error Loading Lesson' : 'Backend Offline' }}</h3>
        <p>{{ lessonError }}</p>
        <button class="btn btn-retry" @click="retryLoad">
          <span class="material-icons">refresh</span>
          Retry
        </button>
      </div>

      <!-- Lesson content -->
      <div v-else-if="currentLesson" v-html="renderedMarkdown" class="markdown-body col-grow"></div>

      <!-- Loading placeholder -->
      <div v-else class="loading-placeholder">
        <span class="material-icons rotating">hourglass_empty</span>
        <p>Loading lesson content...</p>
      </div>
    </div>

    <!-- Right Pane: Code Editor & Console -->
    <div class="pane right-pane" v-if="!(currentLesson && currentLesson.isIntro)">
      <!-- Editor Toolbar -->
      <div class="editor-header">
        <div class="file-tabs" v-if="currentLesson && currentLesson.files">
          <button
            v-for="(file, index) in currentLesson.files"
            :key="index"
            class="file-tab"
            :class="{ 'is-active': activeFileIndex === index }"
            @click="activeFileIndex = index"
          >
            <span class="material-icons file-icon">description</span>
            <span class="file-name">{{ file.name }}</span>
          </button>
        </div>
        <div class="editor-actions">
          <button
            class="btn btn-run"
            :class="{ 'is-loading': isRunning }"
            @click="runCode"
            :disabled="isRunning || !isBackendOnline"
          >
            <span v-if="isRunning" class="spinner"></span>
            <span v-else class="material-icons btn-icon">play_arrow</span>
            {{ isRunning ? 'Running...' : 'Run Code' }}
          </button>
          <button
            class="btn btn-submit"
            :class="{ 'is-loading': isSubmitting }"
            @click="submitWork"
            :disabled="isRunning || isSubmitting || !isBackendOnline || !hasCompiledSuccessfully"
            :title="
              !hasCompiledSuccessfully
                ? 'Run your code successfully first'
                : 'Submit for evaluation'
            "
          >
            <span v-if="isSubmitting" class="spinner"></span>
            <span v-else class="material-icons btn-icon">{{
              hasCompiledSuccessfully ? 'check' : 'lock'
            }}</span>
            {{ isSubmitting ? 'Submitting...' : 'Submit' }}
          </button>
        </div>
      </div>

      <!-- Editor Area -->
      <div class="editor-wrapper">
        <div ref="editorRef" class="editor-container"></div>
      </div>

      <!-- Output Console -->
      <div class="console-pane" :class="{ 'is-expanded': consoleExpanded }">
        <div class="console-header">
          <div class="console-status">
            <span class="console-title">Terminal Output</span>
            <span
              v-if="compileResult"
              :class="['status-badge', compileResult.success ? 'success' : 'error']"
            >
              {{ compileResult.success ? '✓ Success' : '✗ Error' }}
            </span>
          </div>
          <div class="console-actions">
            <button class="btn-icon-only" @click="consoleExpanded = !consoleExpanded">
              <span class="material-icons">{{
                consoleExpanded ? 'expand_more' : 'expand_less'
              }}</span>
            </button>
          </div>
        </div>
        <div class="console-content">
          <!-- Submission Feedback Mode -->
          <div
            v-if="lastSubmission"
            class="feedback-panel"
            :class="lastSubmission.passed ? 'success' : 'error'"
          >
            <div class="feedback-header">
              <div class="feedback-status">
                <span class="material-icons">{{
                  lastSubmission.passed ? 'check_circle' : 'info'
                }}</span>
                <h3>{{ lastSubmission.passed ? 'Target Achieved' : 'Needs Improvement' }}</h3>
              </div>
              <div class="score-badge" v-if="lastSubmission.attemptNumber">
                <span class="label">Attempt</span>
                <span class="val">{{ lastSubmission.attemptNumber }}</span>
              </div>
              <div class="score-badge" v-if="lastSubmission.masteryUpdate">
                <span class="label">Mastery</span>
                <span class="val"
                  >{{ Math.round(lastSubmission.masteryUpdate.newScore * 100) }}%</span
                >
              </div>
            </div>

            <div class="feedback-content" v-if="parsedAnalysis">
              <p class="feedback-message">{{ parsedAnalysis.feedback }}</p>
            </div>
            <div class="feedback-content" v-else>
              <p class="feedback-message">{{ lastSubmission.analysis.feedback }}</p>
            </div>

            <!-- Hints -->
            <div
              v-if="
                !lastSubmission.passed &&
                parsedAnalysis &&
                parsedAnalysis.hintsForNextAttempt?.length
              "
              class="hints-section"
            >
              <h4>Hints:</h4>
              <ul>
                <li v-for="(hint, i) in parsedAnalysis.hintsForNextAttempt" :key="i">
                  {{ hint }}
                </li>
              </ul>
            </div>

            <!-- Next Lesson Action -->
            <div v-if="lastSubmission.passed" class="actions-row">
              <button class="btn btn-primary" @click="handleNextLesson">
                <span>Next Lesson</span>
                <span class="material-icons">arrow_forward</span>
              </button>
            </div>

            <!-- Compiler Error (if any, specifically for failures) -->
            <div
              v-if="
                lastSubmission.compileResult?.stderr && lastSubmission.compileResult?.exitCode !== 0
              "
              class="compiler-error"
            >
              <h4>Compiler Output:</h4>
              <pre>{{ lastSubmission.compileResult.stderr }}</pre>
            </div>
          </div>

          <!-- Standard Output Mode -->
          <div v-else-if="showOutput" class="console-scroll-area" ref="consoleScrollRef">
            <!-- Interactive Output -->
            <div
              v-if="outputMode === 'interactive'"
              class="terminal-output"
              :class="{
                'is-empty': interactiveOutput.length === 0 && interactiveStatus === 'idle',
              }"
            >
              <div
                v-if="interactiveOutput.length === 0 && interactiveStatus === 'idle'"
                class="terminal-placeholder"
              >
                <span class="material-icons placeholder-icon">terminal</span>
                <p>Terminal ready</p>
                <span class="placeholder-hint">Click "Run Code" to execute your program</span>
              </div>

              <div
                v-for="(line, i) in interactiveOutput"
                :key="i"
                :class="['term-line', line.type]"
              >
                <span v-if="line.type === 'stdin'" class="prompt-char">$ </span>
                <span>{{ formatOutput(line.data) }}</span>
              </div>

              <!-- Input Line -->
              <div v-if="interactiveStatus === 'running'" class="input-line">
                <span class="prompt-char">&gt; </span>
                <input
                  v-model="userInput"
                  @keydown.enter="handleInput"
                  type="text"
                  class="terminal-input"
                  placeholder="Type input..."
                  autoFocus
                />
              </div>

              <div v-if="interactiveStatus === 'exited'" class="process-status">
                > Process exited
              </div>
            </div>

            <!-- Legacy/Static Output -->
            <div
              v-else
              class="output-text"
              :class="{ 'has-error': compileResult && !compileResult.success, 'is-empty': !output }"
            >
              <div v-if="!output" class="terminal-placeholder">
                <span class="material-icons placeholder-icon">description</span>
                <p>No output yet</p>
                <span class="placeholder-hint">Submit your code to see evaluation results</span>
              </div>
              {{ output }}
            </div>
          </div>
          <div v-else class="terminal-placeholder">
            <span class="material-icons placeholder-icon">hourglass_empty</span>
            <p>Waiting for output...</p>
          </div>
        </div>
      </div>
    </div>
    <AIAssistant />
  </div>
</template>

<script>
import { defineComponent, onMounted, ref, computed, watch, shallowRef, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import MarkdownIt from 'markdown-it'
import { EditorState } from '@codemirror/state'
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLineGutter,
  highlightSpecialChars,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  highlightActiveLine,
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { rust } from '@codemirror/lang-rust'
import { python } from '@codemirror/lang-python'
import { javascript } from '@codemirror/lang-javascript'
import { bracketMatching, foldGutter, foldKeymap, indentOnInput } from '@codemirror/language'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import {
  autocompletion,
  completionKeymap,
  closeBrackets,
  closeBracketsKeymap,
} from '@codemirror/autocomplete'
import { lintKeymap } from '@codemirror/lint'
import { oneDark } from '@codemirror/theme-one-dark'
import AIAssistant from 'components/AIAssistant.vue'
import LoadingOverlay from 'components/LoadingOverlay.vue'
import IntroPage from 'pages/IntroPage.vue'
import { useInteractiveCompiler } from 'src/composables/useInteractiveCompiler'
import { useLessonStore } from '../stores/store'
import hljs from 'highlight.js'
import 'highlight.js/styles/atom-one-dark.css'

export default defineComponent({
  name: 'LessonPage',
  components: {
    AIAssistant,
    LoadingOverlay,
    IntroPage,
  },
  setup() {
    const editorRef = ref(null)
    const leftPane = ref(null)
    const editorView = shallowRef(null)
    const activeFileIndex = ref(0)
    const lessonStartTime = ref(Date.now())
    const consoleScrollRef = ref(null)

    // Interactive Compiler
    const {
      runCode: runInteractive,
      sendInput,
      kill,
      output: interactiveOutput,
      status: interactiveStatus,
      exitCode,
    } = useInteractiveCompiler('http://localhost:3000')

    const lessonStore = useLessonStore()
    const {
      currentLesson,
      currentLessonIndex,
      lessons,
      isSidebarOpen,
      currentStep,
      isGeneratingLesson,
      lessonError,
      isBackendOnline,
      compileResult,
      editorCode,
      isSubmitting,
      lastSubmission,
      currentLanguage,
    } = storeToRefs(lessonStore)
    const {
      nextLesson,
      prevLesson,
      toggleSidebar,
      initialize,
      submitCode,
      setEditorCode,
      loadNextLesson,
    } = lessonStore

    // Handle route params for direct linking
    const route = useRoute()
    const router = useRouter()

    // Watch for route changes to load the correct lesson
    watch(
      () => route.params.lessonId,
      async (newId) => {
        if (newId && newId !== currentLesson.value?.lessonId) {
          await lessonStore.loadLesson(newId)
        }
      },
    )

    // Handle next lesson navigation (updates URL)
    const handleNextLesson = async () => {
      const currentLessonData = currentLesson.value
      if (currentLessonData) {
        if (currentLessonData.isIntro) {
          lessonStore.markLessonCompleted(currentLessonData.id)
        }
        await loadNextLesson(currentLessonData.conceptId)

        // Update URL to match new lesson
        if (currentLesson.value?.lessonId) {
          router.push({
            name: 'learn',
            params: { language: currentLanguage.value, lessonId: currentLesson.value.lessonId },
          })
        }
      }
    }

    // State
    // activeFileIndex is already defined at top of setup
    const showOutput = ref(true)
    const legacyOutput = ref('')
    const outputMode = ref('interactive') // 'interactive' | 'legacy'
    const userInput = ref('')
    const consoleExpanded = ref(false)
    const hasCompiledSuccessfully = ref(false)
    const codeRunning = ref('')

    // Computed
    const activeFile = computed(() => {
      if (currentLesson.value && currentLesson.value.files) {
        return currentLesson.value.files[activeFileIndex.value] || currentLesson.value.files[0]
      }
      return null
    })

    const moduleName = computed(() => currentLesson.value?.category || 'Rust Fundamentals')

    // Markdown Configuration
    const md = new MarkdownIt({
      html: true,
      linkify: true,
      highlight: function (str, lang) {
        if (lang && hljs.getLanguage(lang)) {
          try {
            return (
              '<pre class="hljs"><code>' +
              hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
              '</code></pre>'
            )
          } catch (err) {
            console.error('Highlight.js error:', err)
          }
        }
        return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>'
      },
    })

    const renderedMarkdown = computed(() => {
      if (!currentLesson.value?.content) return ''
      return md.render(currentLesson.value.content)
    })

    // Helper to strip ANSI codes for now
    const formatOutput = (text) => {
      // Simple ANSI stripper
      return text.replace(
        /* eslint-disable-next-line no-control-regex */
        /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
        '',
      )
    }

    // Scroll to bottom of console
    const scrollToBottom = () => {
      nextTick(() => {
        if (consoleScrollRef.value) {
          consoleScrollRef.value.scrollTop = consoleScrollRef.value.scrollHeight
        }
      })
    }

    // Actions
    const runCode = async () => {
      showOutput.value = true
      outputMode.value = 'interactive'
      lessonStore.$patch({ lastSubmission: null })
      consoleExpanded.value = true

      const code = editorView.value ? editorView.value.state.doc.toString() : editorCode.value
      codeRunning.value = code
      runInteractive(currentLanguage.value, code)
    }

    const handleInput = () => {
      if (!userInput.value) return
      sendInput(userInput.value + '\n') // Add newline as standard terminal behavior
      userInput.value = ''
    }

    const submitWork = async () => {
      showOutput.value = true
      outputMode.value = 'legacy'
      lessonStore.$patch({ lastSubmission: null })
      // Kill any running interactive process
      if (interactiveStatus.value === 'running') {
        kill()
      }

      try {
        const code = editorView.value ? editorView.value.state.doc.toString() : editorCode.value
        legacyOutput.value = '> Submitting for evaluation...'

        const now = Date.now()
        const timeSpent = now - lessonStartTime.value

        const compiledResult = {
          terminal: [...interactiveOutput.value],
          exitCode: exitCode.value ?? 0,
        }

        await submitCode(code, timeSpent, compiledResult)

        // Reset timer
        lessonStartTime.value = now
        showOutput.value = true
        consoleExpanded.value = true
      } catch (error) {
        legacyOutput.value = `> Error: ${error.message}`
      }
    }

    const retryLoad = () => {
      initialize()
    }

    // Watchers
    watch(currentLesson, (newLesson) => {
      lessonStartTime.value = Date.now()
      legacyOutput.value = ''
      showOutput.value = true
      consoleExpanded.value = false
      hasCompiledSuccessfully.value = false
      // Kill process if running
      if (interactiveStatus.value === 'running') kill()

      if (newLesson?.files) {
        // Find the main file based on current language
        const mainExtensions = {
          rust: 'main.rs',
          python: 'main.py',
          javascript: 'index.js',
          typescript: 'index.ts',
        }
        const mainExt = mainExtensions[currentLanguage.value] || 'main.rs'
        const mainIndex = newLesson.files.findIndex((f) => f.name.endsWith(mainExt))
        activeFileIndex.value = mainIndex >= 0 ? mainIndex : 0
      } else {
        activeFileIndex.value = 0
      }

      // Scroll instructions to top when lesson changes
      nextTick(() => {
        if (leftPane.value) {
          leftPane.value.scrollTop = 0
        }
      })
    })

    watch(interactiveOutput.value, () => {
      scrollToBottom()
      // If we got stdout/exit, assume it worked enough to enable submit?
      // Or we can rely on exit code 0.
    })

    watch(interactiveStatus, (newStatus) => {
      if (newStatus === 'exited') {
        // Enable submit only if exit code is 0 (success)
        // and the code that just ran is exactly what is currently in the editor
        const currentCode = editorView.value
          ? editorView.value.state.doc.toString()
          : editorCode.value
        if (exitCode.value === 0 && codeRunning.value === currentCode) {
          hasCompiledSuccessfully.value = true
        } else {
          hasCompiledSuccessfully.value = false
        }
      }
    })

    // Legacy watcher for compileResult (if still used elsewhere)
    watch(compileResult, (result) => {
      if (result) {
        let outputText = ''
        const isSuccess = result.success ?? result.exitCode === 0
        if (isSuccess) hasCompiledSuccessfully.value = true

        if (result.runOutput) {
          if (result.runOutput.stdout) outputText += result.runOutput.stdout
          if (result.runOutput.stderr) {
            if (outputText) outputText += '\n'
            outputText += result.runOutput.stderr
          }
          if (!outputText && result.stderr) outputText = result.stderr
        } else {
          if (result.stdout) outputText += result.stdout
          if (result.stderr) {
            if (outputText) outputText += '\n'
            outputText += result.stderr
          }
        }

        if (!outputText) {
          outputText = isSuccess
            ? '> Program executed successfully (no output)'
            : `> Execution failed with exit code ${result.exitCode ?? 1}`
        }
        legacyOutput.value = outputText
        outputMode.value = 'legacy'
        showOutput.value = true
      }
    })

    watch(lastSubmission, (submission) => {
      if (submission) {
        showOutput.value = true
        consoleExpanded.value = true
      }
    })

    watch(activeFile, (newFile) => {
      if (!editorView.value || !newFile) return
      const currentDoc = editorView.value.state.doc.toString()
      if (currentDoc !== newFile.code) {
        editorView.value.dispatch({
          changes: { from: 0, to: editorView.value.state.doc.length, insert: newFile.code },
        })
      }
    })

    // Get the appropriate CodeMirror language extension based on current language
    const getLanguageExtension = () => {
      switch (currentLanguage.value) {
        case 'python':
          return python()
        case 'javascript':
          return javascript()
        case 'typescript':
          return javascript({ typescript: true })
        case 'rust':
        default:
          return rust()
      }
    }

    const initEditor = () => {
      if (!editorRef.value) return

      // If we already have a view, destroy it before creating a new one
      if (editorView.value) {
        editorView.value.destroy()
      }

      const initialCode = activeFile.value?.code || editorCode.value || ''

      const startState = EditorState.create({
        doc: initialCode,
        extensions: [
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              const newCode = update.state.doc.toString()
              // Update store
              setEditorCode(newCode)
              // Also update the file object for compatibility
              if (activeFile.value) {
                activeFile.value.code = newCode
              }
              // Reset compilation status when code changes
              hasCompiledSuccessfully.value = false
            }
          }),
          oneDark,
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightSpecialChars(),
          history(),
          foldGutter(),
          drawSelection(),
          dropCursor(),
          EditorState.allowMultipleSelections.of(true),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          autocompletion(),
          rectangularSelection(),
          crosshairCursor(),
          highlightActiveLine(),
          highlightSelectionMatches(),
          keymap.of([
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...searchKeymap,
            ...historyKeymap,
            ...foldKeymap,
            ...completionKeymap,
            ...lintKeymap,
          ]),
          getLanguageExtension(),
          EditorView.theme(
            {
              '&': { height: '100%', fontSize: '14px', backgroundColor: '#000000' },
              '.cm-scroller': { overflow: 'auto' },
              '.cm-gutters': { backgroundColor: '#161616', color: '#4a4a4a', border: 'none' },
              '.cm-content': { caretColor: 'white', fontFamily: "'Fira Code', monospace" },
              '.cm-activeLine': { backgroundColor: '#33333330' },
              '.cm-activeLineGutter': { backgroundColor: '#33333330' },
            },
            { dark: true },
          ),
        ],
      })

      editorView.value = new EditorView({
        state: startState,
        parent: editorRef.value,
      })
    }

    // Watch for the editor container to become available (handles v-if transitions)
    watch(editorRef, (newVal) => {
      if (newVal) {
        initEditor()
      }
    })

    // Reinitialize editor when language changes to update syntax highlighting
    watch(currentLanguage, () => {
      if (editorRef.value) {
        nextTick(() => {
          initEditor()
        })
      }
    })

    // Initialize on mount
    onMounted(async () => {
      // Sync language from route if available
      if (route.params.language && route.params.language !== currentLanguage.value) {
        await lessonStore.loadLessonsForLanguage(route.params.language)
      }

      // Initialize store (loads lessons from API)
      await initialize()

      // If URL has a lesson ID, load that specific lesson
      // Otherwise, the store's initialize logic (loading last/first lesson) will take over
      // But we should update the URL to match whatever was loaded if the param was missing
      if (route.params.lessonId) {
        await lessonStore.loadLesson(route.params.lessonId)
      } else if (currentLesson.value?.lessonId) {
        // If store loaded a default lesson, update URL to match
        router.replace({
          name: 'learn',
          params: { language: currentLanguage.value, lessonId: currentLesson.value.lessonId },
        })
      }

      // If editorRef is already available on mount, initialize it
      if (editorRef.value) {
        initEditor()
      }
    })

    return {
      editorRef,
      leftPane,
      activeFileIndex,
      renderedMarkdown,
      isRunning: computed(() => interactiveStatus.value === 'running'),
      isSubmitting,
      showOutput,
      output: legacyOutput,
      interactiveOutput,
      interactiveStatus,
      userInput,
      outputMode,
      formatOutput,
      consoleScrollRef,
      handleInput,
      kill,
      runCode,
      submitWork,
      retryLoad,
      consoleExpanded,
      currentLesson,
      currentStep,
      moduleName,
      nextLesson,
      handleNextLesson,
      prevLesson,
      isSidebarOpen,
      toggleSidebar,
      isGeneratingLesson,
      lessonError,
      isBackendOnline,
      compileResult,
      lastSubmission,
      hasCompiledSuccessfully,
      isFirst: computed(() => currentLessonIndex.value === 0),
      isLast: computed(() => currentLessonIndex.value === lessons.value.length - 1),
      parsedAnalysis: computed(() => {
        if (!lastSubmission.value || !lastSubmission.value.analysis) return null

        const raw = lastSubmission.value.analysis
        let feedback = raw.feedback
        let hints = raw.hintsForNextAttempt || []

        // Check if feedback contains JSON markdown or is a JSON string
        if (
          typeof feedback === 'string' &&
          (feedback.includes('```json') || feedback.trim().startsWith('{'))
        ) {
          try {
            // Clean up markdown tags
            const jsonStr = feedback
              .replace(/```json/g, '')
              .replace(/```/g, '')
              .trim()
            const parsed = JSON.parse(jsonStr)

            if (parsed.feedback) feedback = parsed.feedback
            if (parsed.hintsForNextAttempt) hints = parsed.hintsForNextAttempt
          } catch (e) {
            console.error('Failed to parse feedback JSON', e)
          }
        }

        return {
          ...raw,
          feedback,
          hintsForNextAttempt: hints,
        }
      }),
    }
  },
})
</script>

<style scoped>
/* Layout */
.split-layout {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  flex-grow: 1;
  width: 100%;
  overflow: hidden;
  background-color: #000;
  box-sizing: border-box;
}

.pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  min-width: 0;
  box-sizing: border-box;
}

.left-pane {
  background-color: #121212;
  color: #bdbdbd;
  padding: 0;
  overflow-y: auto;
  border-right: 1px solid #1d1d1d;
  width: 50%;
}

.right-pane {
  background-color: #000;
  width: 50%;
}

/* Error State */
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  text-align: center;
  padding: 24px;
}

.error-icon {
  font-size: 4rem;
  color: #ef4444;
  margin-bottom: 1rem;
}

.error-state h3 {
  color: #fff;
  margin-bottom: 0.5rem;
}

.error-state p {
  color: #9ca3af;
  margin-bottom: 1.5rem;
  max-width: 400px;
}

.btn-retry {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background-color: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.3);
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-retry:hover {
  background-color: rgba(59, 130, 246, 0.3);
}

/* Loading Placeholder */
.loading-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: #6b7280;
  padding: 24px;
}

.rotating {
  animation: rotate 2s linear infinite;
  font-size: 2rem;
  margin-bottom: 1rem;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Console Status */
.console-status {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-badge {
  font-size: 0.7rem;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
}

.status-badge.success {
  background-color: rgba(34, 197, 94, 0.2);
  color: #22c55e;
}

.status-badge.error {
  background-color: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.output-text.has-error {
  color: #fca5a5;
}

/* Utilities */
.col-grow {
  flex-grow: 1;
}

/* Pane Header */
.pane-header {
  margin-bottom: 24px;
  background-color: #121212;
  position: sticky;
  top: 0;
  z-index: 10;
  padding: 24px 24px 12px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.header-top-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.module-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  border-left: 3px solid #3b82f6;
  padding-left: 16px;
}

.module-overline {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #71717a;
  font-weight: 600;
}

.step-indicator {
  font-family: 'Fira Code', monospace;
  font-size: 0.85rem;
  color: #e4e4e7;
}

.btn-map-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  background-color: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #a1a1aa;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.8rem;
  font-weight: 500;
}

.btn-map-toggle:hover {
  background-color: rgba(255, 255, 255, 0.1);
  color: #fff;
  border-color: rgba(255, 255, 255, 0.2);
}

.btn-map-toggle.is-active {
  background-color: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
  border-color: rgba(59, 130, 246, 0.3);
}

.btn-map-toggle .material-icons {
  font-size: 16px;
}

.mb-md {
  margin-bottom: 16px;
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 16px;
  font-size: 0.875rem;
  font-weight: 500;
  text-transform: uppercase;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
  border: none;
  background: transparent;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.btn-flat {
  color: #757575;
}
.btn-flat:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

.btn-outline {
  border: 1px solid #1976d2;
  color: #1976d2;
}
.btn-outline:hover {
  background-color: rgba(25, 118, 210, 0.1);
}

.btn-run {
  background-color: #2e7d32;
  color: white;
  border-radius: 16px;
  padding: 4px 12px;
  font-size: 0.75rem;
}
.btn-run:hover {
  background-color: #388e3c;
}
.btn-run:disabled {
  background-color: #1b5e20;
  cursor: not-allowed;
  opacity: 0.8;
}

.btn-submit {
  background-color: rgba(59, 130, 246, 0.1);
  color: #60a5fa;
  border-radius: 16px;
  padding: 0 16px;
  height: 28px;
  font-size: 0.75rem;
  font-weight: 500;
  border: 1px solid rgba(59, 130, 246, 0.2);
  transition: all 0.2s ease;
  letter-spacing: 0.02em;
}

.btn-submit:hover {
  background-color: rgba(59, 130, 246, 0.2);
  border-color: rgba(59, 130, 246, 0.5);
  color: #93c5fd;
}

.btn-submit:active {
  background-color: rgba(59, 130, 246, 0.15);
  transform: translateY(0);
}

.btn-submit:disabled {
  background-color: transparent;
  color: #52525b;
  border-color: #27272a;
  cursor: not-allowed;
}

.editor-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-icon {
  font-size: 1.25rem;
  margin-right: 4px;
}

.btn-icon.right {
  margin-right: 0;
  margin-left: 4px;
}

.btn-icon-only {
  background: transparent;
  border: none;
  color: #757575;
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.btn-icon-only:hover {
  background-color: rgba(255, 255, 255, 0.1);
  color: #9e9e9e;
}

/* Spinner */
.spinner {
  width: 1em;
  height: 1em;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: #fff;
  animation: spin 1s linear infinite;
  margin-right: 8px;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Feedback Panel */
.feedback-panel {
  padding: 16px;
  border-radius: 8px;
  background-color: #1a1a1a;
  border: 1px solid #333;
}

.feedback-panel.success {
  background-color: rgba(6, 78, 59, 0.4); /* Darker Green */
  border: 1px solid #059669;
}

.feedback-panel.error {
  background-color: rgba(127, 29, 29, 0.4); /* Darker Red */
  border: 1px solid #dc2626;
}

.feedback-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.feedback-status {
  display: flex;
  align-items: center;
  gap: 12px;
}

.feedback-status .material-icons {
  font-size: 2rem;
}

.feedback-status h3 {
  margin: 0;
  font-size: 1.25rem;
  color: #fff;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.feedback-panel.success .feedback-status {
  color: #4ade80;
}
.feedback-panel.error .feedback-status {
  color: #f87171;
}

.score-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  background-color: rgba(0, 0, 0, 0.3);
  padding: 4px 8px;
  border-radius: 4px;
}

.score-badge .label {
  text-transform: uppercase;
  font-size: 0.7rem;
  color: #9ca3af;
  font-weight: 600;
}

.score-badge .val {
  font-weight: bold;
  color: #fff;
}

.feedback-message {
  color: #e5e7eb;
  line-height: 1.5;
  margin-bottom: 16px;
}

.hints-section {
  margin-top: 16px;
  padding: 12px;
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
}

.hints-section h4 {
  margin: 0 0 8px 0;
  font-size: 0.9rem;
  color: #fbbf24;
}

.hints-section ul {
  margin: 0;
  padding-left: 20px;
  color: #d1d5db;
}

.hints-section li {
  margin-bottom: 4px;
}

.compiler-error {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.compiler-error h4 {
  margin: 0 0 8px 0;
  font-size: 0.9rem;
  color: #ef4444;
}

.compiler-error pre {
  background-color: #000;
  padding: 8px;
  border-radius: 4px;
  font-family: 'Fira Code', monospace;
  font-size: 0.85rem;
  color: #fca5a5;
  white-space: pre-wrap;
  overflow-x: auto;
}

.actions-row {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.btn-primary {
  background-color: #2563eb;
  color: white;
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: background-color 0.2s;
  border: none;
  cursor: pointer;
}

.btn-primary:hover {
  background-color: #1d4ed8;
}

.btn-primary .material-icons {
  font-size: 18px;
}

/* Editor Header */
.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background-color: #161616;
  border-bottom: 1px solid #1d1d1d;
}

.file-tabs {
  display: flex;
  align-items: center;
  gap: 2px;
  overflow-x: auto;
}

.file-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  background-color: transparent;
  border: none;
  padding: 6px 10px;
  cursor: pointer;
  color: #78909c;
  border-radius: 4px;
  font-size: 0.75rem;
  transition: all 0.2s ease;
  margin-right: 2px;
}

.file-tab:hover {
  background-color: rgba(255, 255, 255, 0.05);
  color: #b0bec5;
}

.file-tab.is-active {
  background-color: rgba(255, 255, 255, 0.1);
  color: #e0e0e0;
}

.file-icon {
  font-size: 1rem;
  opacity: 0.8;
}

.file-name {
  font-family: 'Fira Code', monospace;
}

/* Editor Area */
.editor-wrapper {
  flex: 1;
  width: 100%;
  position: relative;
  overflow: hidden;
}

.editor-container {
  height: 100%;
  width: 100%;
}

/* Console Pane */
.console-pane {
  background-color: #111;
  border-top: 1px solid #1d1d1d;
  display: flex;
  flex-direction: column;
  height: 200px;
  transition: height 0.3s ease;
  padding: 16px;
}

.console-pane.is-expanded {
  height: 50%;
}

.console-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.console-title {
  font-size: 0.625rem;
  text-transform: uppercase;
  letter-spacing: 0.16667em;
  font-weight: 500;
  color: #9e9e9e;
}

.console-actions {
  display: flex;
  gap: 4px;
}

.console-content {
  flex: 1;
  overflow-y: auto;
  background-color: #000;
  border-radius: 4px;
  padding: 8px;
  font-family: 'Fira Code', monospace;
  font-size: 0.875rem;
  display: flex;
  flex-direction: column;
}

.output-text {
  color: #eeeeee;
  white-space: pre-wrap;
}

.output-placeholder {
  color: #616161;
  font-style: italic;
}

.terminal-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 24px;
  color: #52525b;
  text-align: center;
}

.terminal-output.is-empty,
.output-text.is-empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder-icon {
  font-size: 2.5rem;
  margin-bottom: 12px;
  opacity: 0.3;
}

.terminal-placeholder p {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 500;
  color: #71717a;
}

.placeholder-hint {
  font-size: 0.75rem;
  color: #3f3f46;
  margin-top: 4px;
}
/* Markdown Content Layout */
.markdown-body {
  padding: 0 24px 24px 24px;
}
/* Interactive Console Styles */
.console-scroll-area {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  font-family: 'Fira Code', monospace;
  font-size: 0.9rem;
  display: flex;
  flex-direction: column;
}

.terminal-output {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: 0;
}

.term-line {
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.4;
}

.term-line.stdout {
  color: #e5e7eb;
}
.term-line.stderr {
  color: #ef4444;
}
.term-line.stdin {
  color: #60a5fa;
  font-weight: bold;
}
.term-line.system-error {
  color: #f87171;
  font-style: italic;
}

.input-line {
  display: flex;
  align-items: center;
  margin-top: 8px;
}

.prompt-char {
  color: #10b981;
  margin-right: 8px;
  user-select: none;
  font-weight: bold;
}

.terminal-input {
  background: transparent;
  border: none;
  color: #e5e7eb;
  font-family: inherit;
  font-size: inherit;
  flex: 1;
  outline: none;
  padding: 0;
}

.process-status {
  margin-top: 12px;
  color: #6b7280;
  font-style: italic;
  font-size: 0.8rem;
}
</style>
