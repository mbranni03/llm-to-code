<template>
  <div class="sidebar-wrapper" :class="{ 'is-open': isOpen }">
    <div class="sidebar-backdrop" @click="$emit('close')" v-if="isOpen"></div>
    <aside class="sidebar">
      <div class="sidebar-header">
        <h2 class="sidebar-title">Learning Path</h2>
        <button class="btn-close" @click="$emit('close')">
          <span class="material-icons">close</span>
        </button>
      </div>

      <!-- Knowledge Graph Button -->
      <div class="graph-button-container">
        <button class="btn-graph" @click="showGraphModal = true">
          <span class="material-icons">account_tree</span>
          <span class="btn-text">View Knowledge Graph</span>
          <span class="material-icons arrow">arrow_forward</span>
        </button>
      </div>

      <div class="sidebar-content">
        <div class="path-container">
          <!-- Connector Line -->
          <div class="path-line"></div>

          <div
            v-for="(lesson, index) in lessons"
            :key="lesson.id"
            class="lesson-node"
            :class="{
              'is-completed': lesson.isCompleted,
              'is-current': lesson.lessonId === currentLessonId,
              'is-locked': lesson.isLocked,
            }"
            @click="selectLesson(lesson)"
          >
            <div class="node-indicator">
              <span v-if="lesson.isIntro" class="material-icons info-icon">info</span>
              <span v-else-if="lesson.isCompleted" class="material-icons check-icon">check</span>
              <span v-else-if="lesson.isLocked" class="material-icons lock-icon">lock</span>
              <div v-else class="current-dot"></div>
            </div>

            <div class="node-content">
              <span class="lesson-index" v-if="!lesson.isIntro"
                >Part {{ lesson.lessonNumber || index }}</span
              >
              <span class="lesson-index" v-else>Start</span>
              <h3 class="lesson-title">{{ lesson.title }}</h3>
              <p class="lesson-desc">{{ lesson.description }}</p>
            </div>
          </div>
        </div>
      </div>
    </aside>

    <!-- Knowledge Graph Modal -->
    <KnowledgeGraphModal
      :isOpen="showGraphModal"
      :userId="userId"
      @close="showGraphModal = false"
      @node-click="handleNodeClick"
    />
  </div>
</template>

<script>
import { defineComponent, ref } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useLessonStore } from '../stores/store'
import KnowledgeGraphModal from './KnowledgeGraphModal.vue'

export default defineComponent({
  name: 'LessonSidebar',
  components: {
    KnowledgeGraphModal,
  },
  props: {
    isOpen: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['close'],
  setup(props, { emit }) {
    const lessonStore = useLessonStore()
    const { lessons, currentLessonId, userId } = storeToRefs(lessonStore)
    const { loadLesson } = lessonStore

    const showGraphModal = ref(false)

    const router = useRouter()

    const selectLesson = (lesson) => {
      if (!lesson.isLocked) {
        // Navigate to the lesson route, which will trigger loading via the page watcher
        router.push({ name: 'learn', params: { lessonId: lesson.lessonId } })

        // On mobile/narrow screens, we might want to close the sidebar
        if (window.innerWidth < 1024) {
          emit('close')
        }
      }
    }

    const handleNodeClick = async (conceptId) => {
      showGraphModal.value = false
      emit('close')
      await loadLesson(conceptId)
    }

    return {
      lessons,
      currentLessonId,
      userId,
      selectLesson,
      showGraphModal,
      handleNodeClick,
    }
  },
})
</script>

<style scoped>
.sidebar-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
  z-index: 2000;
  overflow: hidden;
}

.sidebar-wrapper.is-open {
  pointer-events: auto;
}

.sidebar-backdrop {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.sidebar-wrapper.is-open .sidebar-backdrop {
  opacity: 1;
}

.sidebar {
  position: absolute;
  top: 0;
  left: 0;
  width: 320px;
  height: 100%;
  background-color: #0f0f11;
  border-right: 1px solid #1f1f23;
  transform: translateX(-100%);
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 10px 0 30px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
}

.sidebar-wrapper.is-open .sidebar {
  transform: translateX(0);
}

.sidebar-header {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  border-bottom: 1px solid #1f1f23;
}

.sidebar-title {
  font-size: 1rem;
  font-weight: 700;
  color: #fff;
  margin: 0;
  letter-spacing: -0.02em;
}

.btn-close {
  background: transparent;
  border: none;
  color: #a1a1aa;
  cursor: pointer;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s;
}

.btn-close:hover {
  background-color: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px 0;
}

/* Path Container */
.path-container {
  position: relative;
  padding: 0 24px;
}

.path-line {
  position: absolute;
  left: 39px; /* Adjust based on node indicator width + padding */
  top: 10px;
  bottom: 0;
  width: 2px;
  background: linear-gradient(180deg, #3b82f6 0%, rgba(59, 130, 246, 0.2) 100%);
  z-index: 0;
}

.lesson-node {
  position: relative;
  display: flex;
  gap: 16px;
  margin-bottom: 32px;
  cursor: pointer;
  opacity: 0.6;
  transition: all 0.2s ease;
  z-index: 1;
}

.lesson-node:last-child {
  margin-bottom: 0;
}

.lesson-node:hover:not(.is-locked) {
  opacity: 0.9;
}

.lesson-node.is-completed,
.lesson-node.is-current {
  opacity: 1;
}

/* Node Indicators */
.node-indicator {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: #18181b;
  border: 2px solid #27272a;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.3s ease;
  z-index: 1;
}

.lesson-node.is-completed .node-indicator {
  background-color: #3b82f6;
  border-color: #3b82f6;
}

.lesson-node.is-current .node-indicator {
  background-color: #0f0f11;
  border-color: #3b82f6;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2);
}

.lesson-node.is-locked .node-indicator {
  background-color: #18181b; /* dark */
  border-color: #27272a;
}

/* Icons within indicators */
.check-icon {
  font-size: 16px;
  font-weight: bold;
  color: #fff;
}

.lock-icon {
  font-size: 14px;
  color: #52525b;
}

.info-icon {
  font-size: 16px;
  color: #fff;
}

.current-dot {
  width: 10px;
  height: 10px;
  background-color: #3b82f6;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
  }
  70% {
    transform: scale(1);
    box-shadow: 0 0 0 6px rgba(59, 130, 246, 0);
  }
  100% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
  }
}

/* Content */
.node-content {
  padding-top: 4px; /* align with dot */
}

.lesson-index {
  display: block;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #71717a;
  margin-bottom: 4px;
}

.lesson-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: #fff;
  margin: 0 0 4px 0;
  line-height: 1.2;
}

.lesson-desc {
  font-size: 0.8rem;
  color: #9ca3af; /* muted text */
  margin: 0;
  line-height: 1.4;
  display: -webkit-box;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.lesson-node.is-locked .lesson-title,
.lesson-node.is-locked .lesson-desc {
  color: #52525b;
}

/* Knowledge Graph Button */
.graph-button-container {
  padding: 16px;
  border-bottom: 1px solid #1f1f23;
}

.btn-graph {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(139, 92, 246, 0.12) 100%);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 12px;
  color: #a5b4fc;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.25s ease;
}

.btn-graph:hover {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%);
  border-color: rgba(59, 130, 246, 0.4);
  color: #fff;
  transform: translateY(-1px);
  box-shadow: 0 8px 20px rgba(59, 130, 246, 0.15);
}

.btn-graph .material-icons {
  font-size: 20px;
  color: #60a5fa;
}

.btn-graph .btn-text {
  flex: 1;
  text-align: left;
}

.btn-graph .arrow {
  font-size: 16px;
  opacity: 0.5;
  transition: all 0.2s ease;
}

.btn-graph:hover .arrow {
  opacity: 1;
  transform: translateX(4px);
}
</style>
