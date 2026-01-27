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
              'is-current': lesson.id === currentLessonId,
              'is-locked': lesson.isLocked,
            }"
            @click="selectLesson(lesson)"
          >
            <div class="node-indicator">
              <span v-if="lesson.isCompleted" class="material-icons check-icon">check</span>
              <span v-else-if="lesson.isLocked" class="material-icons lock-icon">lock</span>
              <div v-else class="current-dot"></div>
            </div>

            <div class="node-content">
              <span class="lesson-index">Part {{ index + 1 }}</span>
              <h3 class="lesson-title">{{ lesson.title }}</h3>
              <p class="lesson-desc">{{ lesson.description }}</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  </div>
</template>

<script>
import { defineComponent } from 'vue'
import { storeToRefs } from 'pinia'
import { useLessonStore } from '../stores/store'

export default defineComponent({
  name: 'LessonSidebar',
  props: {
    isOpen: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['close'],
  setup() {
    const lessonStore = useLessonStore()
    const { lessons, currentLessonId } = storeToRefs(lessonStore)
    const { setCurrentLesson } = lessonStore

    const selectLesson = (lesson) => {
      if (!lesson.isLocked) {
        setCurrentLesson(lesson.id)
      }
    }

    return {
      lessons,
      currentLessonId,
      selectLesson,
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
</style>
