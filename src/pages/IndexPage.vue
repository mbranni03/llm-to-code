<template>
  <div class="split-layout">
    <!-- Left Pane: Instructions -->
    <div class="pane left-pane">
      <ProgressTracker
        :current="currentStep"
        :total="totalSteps"
        :moduleName="moduleName"
        class="mb-md"
      />

      <div v-html="renderedMarkdown" class="markdown-body col-grow"></div>

      <div class="navigation-footer">
        <button class="btn btn-flat">
          <span class="material-icons btn-icon">arrow_back</span>
          Back
        </button>
        <button class="btn btn-outline">
          Next Lesson
          <span class="material-icons btn-icon right">arrow_forward</span>
        </button>
      </div>
    </div>

    <!-- Right Pane: Code Editor & Console -->
    <div class="pane right-pane">
      <!-- Editor Toolbar -->
      <div class="editor-header">
        <div class="file-info">
          <span class="material-icons file-icon">description</span>
          <span class="file-name">src/main.rs</span>
        </div>
        <button
          class="btn btn-run"
          :class="{ 'is-loading': isRunning }"
          @click="runCode"
          :disabled="isRunning"
        >
          <span v-if="isRunning" class="spinner"></span>
          <span v-else class="material-icons btn-icon">play_arrow</span>
          {{ isRunning ? 'Running...' : 'Run Code' }}
        </button>
      </div>

      <!-- Editor Area -->
      <div class="editor-wrapper">
        <div ref="editorRef" class="editor-container"></div>
      </div>

      <!-- Output Console -->
      <div v-if="showOutput" class="console-pane" :class="{ 'is-expanded': consoleExpanded }">
        <div class="console-header">
          <span class="console-title">Terminal Output</span>
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
          <div v-if="output" class="output-text">{{ output }}</div>
          <div v-else class="output-placeholder">Waiting for output...</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { defineComponent, onMounted, ref, computed } from 'vue'
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
import ProgressTracker from 'components/ProgressTracker.vue'

export default defineComponent({
  name: 'IndexPage',
  components: {
    ProgressTracker,
  },
  setup() {
    const editorRef = ref(null)
    const md = new MarkdownIt()

    // State
    const isRunning = ref(false)
    const showOutput = ref(true)
    const output = ref('')
    const consoleExpanded = ref(false)
    const currentStep = ref(1)
    const totalSteps = ref(8)
    const moduleName = ref('Rust Fundamentals')

    const instructions = `
# Rust Basics: Variables

In Rust, variables are **immutable** by default. This is one of the many nudges Rust gives you to write code that takes advantage of the safety and easy concurrency that Rust offers.

### The Task
1. Declare a mutable variable named \`counter\`.
2. Set it to \`0\`.
3. Increment it by \`1\`.
4. Print the result.

\`\`\`rust
fn main() {
    // Your code here
}
\`\`\`

### Hints
- Use the \`mut\` keyword to make a variable mutable.
- Remember to use semi-colons \`;\` at the end of statements.
    `

    const renderedMarkdown = computed(() => md.render(instructions))

    // Mock Run Function
    const runCode = () => {
      isRunning.value = true
      showOutput.value = true
      output.value = ''

      // Simulate compilation delay
      setTimeout(() => {
        isRunning.value = false
        output.value = `> Compiling playground v0.0.1 (/playground)\n> Finished dev [unoptimized + debuginfo] target(s) in 0.45s\n> Running \`target/debug/playground\`\n\nHello, world!\nCounter is: 1`
      }, 1500)
    }

    onMounted(() => {
      if (!editorRef.value) return

      const startState = EditorState.create({
        doc: `fn main() {
    // Write your code here
    let mut counter = 0;
    counter += 1;
    println!("Counter is: {}", counter);
}`,
        extensions: [
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
              '&': { height: '100%', fontSize: '14px' },
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

      new EditorView({
        state: startState,
        parent: editorRef.value,
      })
    })

    return {
      editorRef,
      renderedMarkdown,
      isRunning,
      showOutput,
      output,
      runCode,
      consoleExpanded,
      currentStep,
      totalSteps,
      moduleName,
    }
  },
})
</script>

<style scoped>
/* Layout */
.split-layout {
  display: flex;
  flex-direction: row; /* Explicitly set to row */
  flex-wrap: nowrap; /* prevent wrapping */
  flex-grow: 1; /* fill parent vertical space */
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
  min-width: 0; /* allows flex item to shrink below content size if needed */
  box-sizing: border-box; /* Crucial for padding handling */
}

.left-pane {
  background-color: #121212; /* grey-10 */
  color: #bdbdbd; /* grey-4 */
  padding: 24px;
  overflow-y: auto;
  border-right: 1px solid #1d1d1d;
  width: 50%; /* fixed split for now */
}

.right-pane {
  background-color: #000;
  width: 50%;
}

/* Utilities */
.col-grow {
  flex-grow: 1;
}

.mb-md {
  margin-bottom: 16px;
}

/* Navigation Footer */
.navigation-footer {
  display: flex;
  justify-content: space-between;
  margin-top: 48px;
  padding-top: 24px;
  border-top: 1px solid rgba(51, 51, 51, 0.4);
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

.btn-flat {
  color: #757575; /* grey-6 */
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
  background-color: #2e7d32; /* green-8 */
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

.file-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-icon {
  color: #78909c; /* blue-grey-4 */
  font-size: 1rem;
}

.file-name {
  color: #b0bec5; /* blue-grey-3 */
  font-family: 'Fira Code', monospace;
  font-size: 0.75rem;
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
  font-size: 0.625rem; /* overline */
  text-transform: uppercase;
  letter-spacing: 0.16667em;
  font-weight: 500;
  color: #9e9e9e; /* grey-5 */
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
  color: #eeeeee; /* grey-3 */
  white-space: pre-wrap;
}

.output-placeholder {
  color: #616161; /* grey-7 */
  font-style: italic;
}

/* Markdown Styles (Same as before but refined) */
.markdown-body {
  font-family:
    'Inter',
    system-ui,
    -apple-system,
    sans-serif;
  line-height: 1.6;
}

.markdown-body :deep(h1) {
  font-size: 1.75rem;
  font-weight: 700;
  margin-bottom: 1.5rem;
  color: #fff;
}

.markdown-body :deep(h3) {
  font-size: 1.1rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 2rem;
  margin-bottom: 0.75rem;
  color: #79c0ff;
}

.markdown-body :deep(p) {
  margin-bottom: 1.2rem;
  color: #bbb;
}

.markdown-body :deep(li) {
  margin-bottom: 0.5rem;
  color: #bbb;
}

.markdown-body :deep(code) {
  background-color: #2d2d2d;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  font-family: 'Fira Code', monospace;
  font-size: 0.9em;
  color: #a5d6ff;
}

.markdown-body :deep(pre) {
  background-color: #161616;
  padding: 1rem;
  border-radius: 8px;
  overflow-x: auto;
  border: 1px solid #333;
  margin-bottom: 1.5rem;
}

.markdown-body :deep(pre code) {
  background-color: transparent;
  padding: 0;
  color: #e6edf3;
  font-size: 0.9rem;
}
</style>
