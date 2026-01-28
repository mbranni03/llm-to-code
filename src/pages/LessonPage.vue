<template>
  <div class="split-layout">
    <!-- Loading Overlay for lesson generation -->
    <LoadingOverlay
      :model-value="isGeneratingLesson"
      :status-message="isBackendOnline ? 'GENERATING' : 'OFFLINE'"
    />

    <!-- Left Pane: Instructions -->
    <div class="pane left-pane">
      <div class="pane-header">
        <div class="header-top-row">
          <div class="module-info">
            <span class="module-overline">Module: {{ moduleName }}</span>
            <span class="step-indicator">Part {{ currentStep }} of {{ totalSteps }}</span>
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

        <ProgressTracker :current="currentStep" :total="totalSteps" />
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
    <div class="pane right-pane">
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
            :disabled="isRunning || isSubmitting || !isBackendOnline"
          >
            <span v-if="isSubmitting" class="spinner"></span>
            <span v-else class="material-icons btn-icon">check</span>
            {{ isSubmitting ? 'Submitting...' : 'Submit' }}
          </button>
        </div>
      </div>

      <!-- Editor Area -->
      <div class="editor-wrapper">
        <div ref="editorRef" class="editor-container"></div>
      </div>

      <!-- Output Console -->
      <div v-if="showOutput" class="console-pane" :class="{ 'is-expanded': consoleExpanded }">
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
            <button class="btn-icon-only" @click="showOutput = false">
              <span class="material-icons">close</span>
            </button>
          </div>
        </div>
        <div class="console-content">
          <div
            v-if="output"
            class="output-text"
            :class="{ 'has-error': compileResult && !compileResult.success }"
          >
            {{ output }}
          </div>
          <div v-else class="output-placeholder">Waiting for output...</div>
        </div>
      </div>
    </div>
    <AIAssistant />
  </div>
</template>

<script>
import { defineComponent, onMounted, ref, computed, watch, shallowRef } from 'vue'
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
import ProgressTracker from 'components/ProgressTracker.vue'
import AIAssistant from 'components/AIAssistant.vue'
import LoadingOverlay from 'components/LoadingOverlay.vue'
import { useLessonStore } from '../stores/store'
import hljs from 'highlight.js'
import 'highlight.js/styles/atom-one-dark.css'

export default defineComponent({
  name: 'LessonPage',
  components: {
    ProgressTracker,
    AIAssistant,
    LoadingOverlay,
  },
  setup() {
    const editorRef = ref(null)
    const editorView = shallowRef(null)
    const activeFileIndex = ref(0)

    const lessonStore = useLessonStore()
    const {
      currentLesson,
      currentLessonIndex,
      lessons,
      isSidebarOpen,
      currentStep,
      totalSteps,
      isGeneratingLesson,
      lessonError,
      isBackendOnline,
      isCompiling,
      compileResult,
      editorCode,
    } = storeToRefs(lessonStore)
    const {
      nextLesson,
      prevLesson,
      toggleSidebar,
      initialize,
      compileCode,
      submitLesson,
      setEditorCode,
    } = lessonStore

    const activeFile = computed(() => {
      if (currentLesson.value && currentLesson.value.files) {
        return currentLesson.value.files[activeFileIndex.value] || currentLesson.value.files[0]
      }
      return null
    })

    // State
    const isRunning = computed(() => isCompiling.value)
    const isSubmitting = ref(false)
    const showOutput = ref(true)
    const output = ref('')
    const consoleExpanded = ref(false)
    const moduleName = computed(() => currentLesson.value?.category || 'Rust Fundamentals')

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

    // Watch for lesson changes
    watch(currentLesson, (newLesson) => {
      output.value = ''
      showOutput.value = true
      if (newLesson?.files) {
        const mainIndex = newLesson.files.findIndex((f) => f.name.endsWith('main.rs'))
        activeFileIndex.value = mainIndex >= 0 ? mainIndex : 0
      } else {
        activeFileIndex.value = 0
      }
    })

    // Watch for compile results
    watch(compileResult, (result) => {
      if (result) {
        let outputText = ''

        // Prioritize runOutput (actual program output) if available
        if (result.runOutput) {
          if (result.runOutput.stdout) {
            outputText += result.runOutput.stdout
          }
          if (result.runOutput.stderr) {
            if (outputText) outputText += '\n'
            outputText += result.runOutput.stderr
          }

          // If runOutput is empty but we have compilation stderr, show it
          if (!outputText && result.stderr) {
            outputText = result.stderr
          }
        } else {
          // Standard output handling for non-WASM/simple compiles
          if (result.stdout) {
            outputText += result.stdout
          }
          if (result.stderr) {
            if (outputText) outputText += '\n'
            outputText += result.stderr
          }
        }

        // Final fallback if no output at all
        if (!outputText) {
          const isSuccess = result.success ?? result.exitCode === 0
          outputText = isSuccess
            ? '> Program executed successfully (no output)'
            : `> Execution failed with exit code ${result.exitCode ?? 1}`
        }

        output.value = outputText
        showOutput.value = true
      }
    })

    // Run code via API
    const runCode = async () => {
      showOutput.value = true
      output.value = '> Compiling...'

      await compileCode()
    }

    // Submit work and update mastery
    const submitWork = async () => {
      isSubmitting.value = true
      showOutput.value = true

      try {
        // First run/compile to check if it works
        const result = await compileCode()

        // Extract error code if compilation failed
        let errorCode
        if (!result.success && result.stderr) {
          const errorMatch = result.stderr.match(/error\[E(\d+)\]/)
          errorCode = errorMatch ? `E${errorMatch[1]}` : undefined
        }

        // Submit mastery update
        const masteryResult = await submitLesson(result.success, errorCode)

        if (masteryResult.mastered) {
          output.value += "\n\n🎉 Congratulations! You've mastered this concept!"
        } else if (result.success) {
          output.value += `\n\n✓ Good job! Mastery: ${Math.round(masteryResult.newScore * 100)}%`
        }
      } catch (error) {
        output.value = `> Error: ${error.message}`
      } finally {
        isSubmitting.value = false
      }
    }

    // Retry loading
    const retryLoad = () => {
      initialize()
    }

    // Sync editor content with store
    watch(activeFile, (newFile) => {
      if (!editorView.value || !newFile) return
      const currentDoc = editorView.value.state.doc.toString()
      if (currentDoc !== newFile.code) {
        editorView.value.dispatch({
          changes: { from: 0, to: editorView.value.state.doc.length, insert: newFile.code },
        })
      }
    })

    // Initialize on mount
    onMounted(async () => {
      // Initialize store (loads lessons from API)
      await initialize()

      if (!editorRef.value) return

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
          rust(),
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
    })

    return {
      editorRef,
      activeFileIndex,
      renderedMarkdown,
      isRunning,
      isSubmitting,
      showOutput,
      output,
      runCode,
      submitWork,
      retryLoad,
      consoleExpanded,
      currentLesson,
      currentStep,
      totalSteps,
      moduleName,
      nextLesson,
      prevLesson,
      isSidebarOpen,
      toggleSidebar,
      isGeneratingLesson,
      lessonError,
      isBackendOnline,
      compileResult,
      isFirst: computed(() => currentLessonIndex.value === 0),
      isLast: computed(() => currentLessonIndex.value === lessons.value.length - 1),
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
  to {
    transform: rotate(360deg);
  }
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
}

.output-text {
  color: #eeeeee;
  white-space: pre-wrap;
}

.output-placeholder {
  color: #616161;
  font-style: italic;
}
/* Markdown Content Layout */
.markdown-body {
  padding: 0 24px 24px 24px;
}
</style>
