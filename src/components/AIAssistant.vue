<template>
  <div class="ai-assistant-container">
    <!-- Chat Panel -->
    <Transition name="slide-up">
      <div v-if="isOpen" class="assistant-panel" :class="{ 'is-wide': isWide }">
        <div class="panel-header">
          <div class="header-content">
            <span class="assistant-name">AI Mentor</span>
            <span class="assistant-status">Online</span>
          </div>
          <div class="panel-header-actions">
            <button
              class="btn-header-action"
              @click="isWide = !isWide"
              :title="isWide ? 'Shrink' : 'Expand'"
            >
              <span class="material-icons">{{ isWide ? 'close_fullscreen' : 'open_in_full' }}</span>
            </button>
            <button class="btn-minimize" @click="toggleChat">
              <span class="material-icons">close</span>
            </button>
          </div>
        </div>

        <div class="messages-container" ref="messagesRef">
          <div
            v-for="(msg, index) in messages"
            :key="index"
            class="message-wrapper"
            :class="msg.role"
          >
            <div
              class="message-content"
              :class="{ 'markdown-body': msg.role === 'assistant' }"
              v-html="renderMarkdown(msg.text)"
            ></div>
          </div>
          <div v-if="isTyping" class="message-wrapper assistant">
            <div class="message-content typing">
              <span class="dot"></span>
              <span class="dot"></span>
              <span class="dot"></span>
            </div>
          </div>
        </div>

        <div class="input-container">
          <input
            v-model="userInput"
            type="text"
            placeholder="Ask a question..."
            @keyup.enter="sendMessage"
          />
          <button class="btn-send" @click="sendMessage" :disabled="!userInput.trim()">
            <span class="material-icons">send</span>
          </button>
        </div>
      </div>
    </Transition>

    <!-- Chat Toggle Button -->
    <Transition name="fade">
      <button v-if="!isOpen" class="assistant-toggle" @click="toggleChat" title="Ask AI Assistant">
        <span class="material-icons">auto_awesome</span>
      </button>
    </Transition>
  </div>
</template>

<script>
import { defineComponent, ref, nextTick, computed, watch } from 'vue'
import { useLessonStore } from '../stores/store'
import { askQuestion } from '../services/LearningAPI'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import 'highlight.js/styles/atom-one-dark.css'

export default defineComponent({
  name: 'AIAssistant',
  setup() {
    const store = useLessonStore()
    const isOpen = ref(false)
    const isWide = ref(true)
    const hasNotification = ref(true)
    const userInput = ref('')
    const isTyping = ref(false)
    const messagesRef = ref(null)
    const currentLanguageName = computed(() => {
      const lang = store.currentLanguage || 'rust'
      if (lang.toLowerCase() === 'javascript') return 'JavaScript'
      if (lang.toLowerCase() === 'typescript') return 'TypeScript'
      return lang.charAt(0).toUpperCase() + lang.slice(1)
    })

    const messages = ref([
      {
        role: 'assistant',
        text: `Hi! I'm your AI Mentor. Stuck on the lesson? Ask me anything about ${currentLanguageName.value}.`,
      },
    ])

    // Update initial message if it's the only one and language changes
    watch(currentLanguageName, (newName) => {
      if (messages.value.length === 1 && messages.value[0].role === 'assistant') {
        messages.value[0].text = `Hi! I'm your AI Mentor. Stuck on the lesson? Ask me anything about ${newName}.`
      }
    })

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

    const renderMarkdown = (text) => {
      if (!text) return ''
      return md.render(text)
    }

    const toggleChat = () => {
      isOpen.value = !isOpen.value
      if (isOpen.value) {
        hasNotification.value = false
        scrollToBottom()
      }
    }

    const scrollToBottom = async () => {
      await nextTick()
      if (messagesRef.value) {
        messagesRef.value.scrollTop = messagesRef.value.scrollHeight
      }
    }

    const sendMessage = async () => {
      if (!userInput.value.trim()) return

      const text = userInput.value
      messages.value.push({ role: 'user', text })
      userInput.value = ''
      scrollToBottom()

      isTyping.value = true

      try {
        const payload = {
          userId: store.userId,
          lessonId: store.currentLessonId || 'general',
          language: store.currentLanguage,
          question: text,
          code: store.editorCode || '',
          lastOutput: store.compileResult?.stdout || store.compileResult?.stderr || '',
        }

        const response = await askQuestion(payload)

        messages.value.push({
          role: 'assistant',
          text: response.answer,
        })
      } catch (error) {
        messages.value.push({
          role: 'assistant',
          text: "I'm having trouble connecting to my brain right now. Please make sure the backend is running.",
        })
        console.error('AI Assistant Error:', error)
      } finally {
        isTyping.value = false
        scrollToBottom()
      }
    }

    return {
      isOpen,
      isWide,
      hasNotification,
      userInput,
      isTyping,
      messages,
      messagesRef,
      toggleChat,
      sendMessage,
      renderMarkdown,
    }
  },
})
</script>

<style scoped>
.ai-assistant-container {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 1000;
  /* Fixed width/height container to anchor children */
  width: 350px;
  height: 52px; /* Matches toggle height initially */
  display: flex;
  justify-content: flex-end;
  align-items: flex-end;
  pointer-events: none;
}

.ai-assistant-container > * {
  pointer-events: auto;
}

.assistant-toggle {
  width: 52px;
  height: 52px;
  border-radius: 16px; /* Squircle style */
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border: none;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    0 8px 16px rgba(59, 130, 246, 0.2),
    0 0 0 1px rgba(255, 255, 255, 0.1);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  position: absolute;
  bottom: 0;
  right: 0;
  overflow: visible;
}

.assistant-toggle:hover {
  transform: translateY(-2px);
  box-shadow:
    0 12px 20px rgba(59, 130, 246, 0.3),
    0 0 0 1px rgba(255, 255, 255, 0.2);
}

.assistant-toggle:active {
  transform: translateY(0);
}

.notification-dot {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 14px;
  height: 14px;
  background: #ef4444;
  border: 3px solid #000;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
  }
  70% {
    transform: scale(1.1);
    box-shadow: 0 0 0 10px rgba(239, 68, 68, 0);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
  }
}

.assistant-panel {
  width: 350px;
  height: 480px;
  max-width: calc(100vw - 48px);
  max-height: calc(100vh - 120px);
  background: rgba(18, 18, 18, 0.85); /* Glassmorphism */
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(20px) saturate(180%);
  position: absolute;
  bottom: 0;
  right: 0;
  transition:
    width 0.4s cubic-bezier(0.16, 1, 0.3, 1),
    height 0.4s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.5s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.3s ease;
}

.assistant-panel.is-wide {
  width: 700px;
  height: 700px;
  max-height: calc(100vh - 80px);
}

.assistant-panel.is-wide .message-wrapper.assistant {
  max-width: 90%;
}

.panel-header {
  padding: 16px 20px;
  background: rgba(24, 24, 27, 0.5);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.assistant-name {
  font-size: 0.9rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: #fff;
}

.assistant-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.7rem;
  color: #10b981;
  font-weight: 500;
}

.assistant-status::before {
  content: '';
  width: 6px;
  height: 6px;
  background: currentColor;
  border-radius: 50%;
}

.panel-header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.btn-header-action,
.btn-minimize {
  background: rgba(255, 255, 255, 0.05);
  border: none;
  color: #a1a1aa;
  cursor: pointer;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.btn-header-action:hover,
.btn-minimize:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.messages-container {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
}

.messages-container::-webkit-scrollbar {
  width: 4px;
}

.messages-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
}

.message-wrapper {
  max-width: 80%;
  display: flex;
}

.message-wrapper.assistant {
  align-self: flex-start;
}

.message-wrapper.user {
  align-self: flex-end;
}

.message-content {
  padding: 10px 14px;
  border-radius: 14px;
  font-size: 0.875rem;
  line-height: 1.5;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.assistant .message-content {
  background: rgba(39, 39, 42, 0.8);
  color: #e4e4e7;
  border-bottom-left-radius: 4px;
}

.user .message-content {
  background: #3b82f6;
  color: #fff;
  border-bottom-right-radius: 4px;
}

/* Markdown adjustments for chat bubbles */
.message-content.markdown-body {
  padding: 12px 16px;
  background: rgba(39, 39, 42, 0.9);
}

.message-content.markdown-body :first-child {
  margin-top: 0;
}

.message-content.markdown-body :last-child {
  margin-bottom: 0;
}

.message-content.markdown-body pre {
  margin: 12px 0;
  background: #000;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.message-content.markdown-body code {
  font-size: 0.8rem;
}

.message-content.markdown-body p {
  margin-bottom: 0.75rem;
}

.input-container {
  padding: 16px;
  background: rgba(24, 24, 27, 0.5);
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  gap: 10px;
}

.input-container input {
  flex: 1;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 10px 14px;
  color: #fff;
  font-size: 0.9rem;
  outline: none;
  transition: all 0.2s;
}

.input-container input:focus {
  border-color: #3b82f6;
  background: rgba(0, 0, 0, 0.5);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.btn-send {
  background: #3b82f6;
  border: none;
  color: #fff;
  border-radius: 10px;
  width: 40px;
  height: 40px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.btn-send:hover:not(:disabled) {
  background: #2563eb;
  transform: scale(1.05);
}

.btn-send:active:not(:disabled) {
  transform: scale(0.95);
}

.btn-send:disabled {
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.2);
  cursor: not-allowed;
}

/* Typing Indicator */
.typing {
  display: flex;
  gap: 4px;
  padding: 10px 12px;
}

.dot {
  width: 6px;
  height: 6px;
  background: #a1a1aa;
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out both;
}

.dot:nth-child(1) {
  animation-delay: -0.32s;
}
.dot:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes bounce {
  0%,
  80%,
  100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}

/* Transitions */
.slide-up-enter-active {
  transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-up-leave-active {
  transition: all 0.3s cubic-bezier(0.7, 0, 0.84, 0);
}

.slide-up-enter-from {
  opacity: 0;
  transform: scale(0.8) blur(10px);
}

.slide-up-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

.fade-enter-active {
  transition: opacity 0.4s ease-out 0.2s; /* Delay button appearance when closing chat */
}

.fade-leave-active {
  transition: opacity 0.2s ease-in;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.assistant-panel {
  transform-origin: bottom right;
}

.material-icons {
  font-size: 20px;
}
</style>
