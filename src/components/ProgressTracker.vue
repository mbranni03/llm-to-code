<template>
  <div class="tracker-container">
    <div class="tracker-header">
      <span class="module-name">{{ moduleName }}</span>
      <span class="step-count">{{ current }} / {{ total }}</span>
    </div>
    <div class="progress-bar-track">
      <div class="progress-bar-fill" :style="{ width: progress * 100 + '%' }"></div>
    </div>
  </div>
</template>

<script>
import { defineComponent, computed } from 'vue'

export default defineComponent({
  name: 'ProgressTracker',
  props: {
    current: {
      type: Number,
      required: true,
    },
    total: {
      type: Number,
      required: true,
    },
    moduleName: {
      type: String,
      default: 'Fundamentals',
    },
  },
  setup(props) {
    const progress = computed(() => {
      if (props.total === 0) return 0
      return Math.min(Math.max(props.current / props.total, 0), 1)
    })

    return {
      progress,
    }
  },
})
</script>

<style scoped>
.tracker-container {
  padding-bottom: 16px;
  width: 100%;
}

.tracker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  color: #9e9e9e; /* Text grey-5 */
}

.module-name {
  font-size: 0.75rem; /* caption */
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.step-count {
  font-size: 0.75rem;
  font-family: 'Fira Code', monospace;
}

.progress-bar-track {
  width: 100%;
  height: 4px;
  background-color: #212121; /* grey-9 */
  border-radius: 4px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background-color: #1976d2; /* primary color default */
  transition: width 0.5s ease;
}
</style>
