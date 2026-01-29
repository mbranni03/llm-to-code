<template>
  <div class="knowledge-graph-container">
    <div class="graph-header">
      <div class="header-content">
        <h3 class="graph-title">
          <span class="material-icons">account_tree</span>
          Knowledge Graph
        </h3>
        <span class="mastery-badge" v-if="masteryPercent !== null">
          {{ masteryPercent }}% Mastered
        </span>
      </div>
      <div class="graph-controls">
        <button class="btn-control" @click="zoomIn" title="Zoom In">
          <span class="material-icons">zoom_in</span>
        </button>
        <button class="btn-control" @click="zoomOut" title="Zoom Out">
          <span class="material-icons">zoom_out</span>
        </button>
        <button class="btn-control" @click="resetZoom" title="Reset View">
          <span class="material-icons">center_focus_strong</span>
        </button>
        <button
          class="btn-control btn-refresh"
          @click="loadGraph"
          :disabled="isLoading"
          title="Refresh Graph"
        >
          <span class="material-icons" :class="{ spin: isLoading }">refresh</span>
        </button>
      </div>
    </div>

    <div class="graph-viewport" ref="viewportRef">
      <div v-if="isLoading" class="graph-loading">
        <div class="loading-spinner"></div>
        <span>Loading knowledge graph...</span>
      </div>

      <div v-else-if="error" class="graph-error">
        <span class="material-icons">error_outline</span>
        <p>{{ error }}</p>
        <button class="btn-retry" @click="loadGraph">
          <span class="material-icons">refresh</span>
          Retry
        </button>
      </div>

      <div
        v-else
        ref="graphRef"
        class="mermaid-container"
        :style="graphTransformStyle"
        @wheel.prevent="handleWheel"
        @mousedown="startPan"
      >
        <div ref="mermaidRef" class="mermaid" v-html="renderedSvg"></div>
      </div>
    </div>

    <div class="graph-legend">
      <div class="legend-item">
        <span class="legend-dot mastered"></span>
        <span>Mastered</span>
      </div>
      <div class="legend-item">
        <span class="legend-dot in-progress"></span>
        <span>In Progress</span>
      </div>
      <div class="legend-item">
        <span class="legend-dot not-started"></span>
        <span>Not Started</span>
      </div>
    </div>
  </div>
</template>

<script>
import { defineComponent, ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import mermaid from 'mermaid'
import * as LearningAPI from '../services/LearningAPI'
import { useLessonStore } from '../stores/store'

export default defineComponent({
  name: 'KnowledgeGraph',
  props: {
    userId: {
      type: String,
      default: null,
    },
    autoLoad: {
      type: Boolean,
      default: true,
    },
  },
  emits: ['node-click', 'loaded', 'error'],
  setup(props, { emit }) {
    const store = useLessonStore()

    const graphRef = ref(null)
    const mermaidRef = ref(null)
    const viewportRef = ref(null)

    const isLoading = ref(false)
    const error = ref(null)
    const mermaidCode = ref('')
    const renderedSvg = ref('')

    // Pan & zoom state
    const scale = ref(1)
    const translateX = ref(0)
    const translateY = ref(0)
    const isPanning = ref(false)
    const panStart = ref({ x: 0, y: 0 })

    const masteryPercent = computed(() => {
      if (!store.shouldShowLanguageStats(store.currentLanguage)) {
        return null
      }

      const langStats = store.progress?.languages?.[store.currentLanguage]
      if (langStats) {
        return Math.round(langStats.averageMastery * 100)
      }

      return null
    })

    const graphTransformStyle = computed(() => ({
      transform: `translate(${translateX.value}px, ${translateY.value}px) scale(${scale.value})`,
      cursor: isPanning.value ? 'grabbing' : 'grab',
    }))

    // Initialize Mermaid with dark theme
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      themeVariables: {
        primaryColor: '#3b82f6',
        primaryTextColor: '#fff',
        primaryBorderColor: '#2563eb',
        lineColor: '#4b5563',
        secondaryColor: '#1e1e2e',
        tertiaryColor: '#18181b',
        background: 'transparent',
        mainBkg: '#27272a',
        secondBkg: '#18181b',
        textColor: '#e4e4e7',
        nodeBorder: '#3f3f46',
        clusterBkg: 'rgba(59, 130, 246, 0.1)',
        clusterBorder: '#3b82f6',
        defaultLinkColor: '#6b7280',
        edgeLabelBackground: '#18181b',
        nodeTextColor: '#fff',
      },
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'basis',
        padding: 20,
        nodeSpacing: 50,
        rankSpacing: 80,
      },
      securityLevel: 'loose',
    })

    const loadGraph = async () => {
      isLoading.value = true
      error.value = null

      try {
        const effectiveUserId = props.userId || store.userId
        // Pass current language to filter the knowledge graph
        const graphData = await LearningAPI.getVisualization(effectiveUserId, store.currentLanguage)

        mermaidCode.value = graphData
        await renderGraph()

        emit('loaded', graphData)
      } catch (err) {
        error.value = err.message || 'Failed to load knowledge graph'
        emit('error', err)
      } finally {
        isLoading.value = false
      }
    }

    const renderGraph = async () => {
      if (!mermaidCode.value) return

      try {
        // Generate unique ID for this render
        const id = `mermaid-graph-${Date.now()}`

        const { svg } = await mermaid.render(id, mermaidCode.value)
        renderedSvg.value = svg

        // After rendering, set up node click handlers
        await nextTick()
        setupNodeClickHandlers()
      } catch (err) {
        console.error('Mermaid render error:', err)
        error.value = 'Failed to render knowledge graph'
      }
    }

    const setupNodeClickHandlers = () => {
      if (!mermaidRef.value) return

      const nodes = mermaidRef.value.querySelectorAll('.node')
      nodes.forEach((node) => {
        node.style.cursor = 'pointer'
        node.addEventListener('click', () => {
          const nodeId = node.id.replace(/^flowchart-/, '').replace(/-\d+$/, '')
          // Convert back from underscore to dot notation
          const conceptId = nodeId.replace(/_/g, '.')
          emit('node-click', conceptId)
        })
      })
    }

    // Zoom controls
    const zoomIn = () => {
      scale.value = Math.min(scale.value * 1.2, 3)
    }

    const zoomOut = () => {
      scale.value = Math.max(scale.value / 1.2, 0.3)
    }

    const resetZoom = () => {
      scale.value = 1
      translateX.value = 0
      translateY.value = 0
    }

    const handleWheel = (e) => {
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      scale.value = Math.max(0.3, Math.min(3, scale.value * delta))
    }

    // Pan controls
    const startPan = (e) => {
      isPanning.value = true
      panStart.value = { x: e.clientX - translateX.value, y: e.clientY - translateY.value }

      document.addEventListener('mousemove', handlePan)
      document.addEventListener('mouseup', endPan)
    }

    const handlePan = (e) => {
      if (!isPanning.value) return
      translateX.value = e.clientX - panStart.value.x
      translateY.value = e.clientY - panStart.value.y
    }

    const endPan = () => {
      isPanning.value = false
      document.removeEventListener('mousemove', handlePan)
      document.removeEventListener('mouseup', endPan)
    }

    onMounted(() => {
      if (props.autoLoad) {
        loadGraph()
      }
    })

    onUnmounted(() => {
      document.removeEventListener('mousemove', handlePan)
      document.removeEventListener('mouseup', endPan)
    })

    return {
      graphRef,
      mermaidRef,
      viewportRef,
      isLoading,
      error,
      renderedSvg,
      masteryPercent,
      graphTransformStyle,
      loadGraph,
      zoomIn,
      zoomOut,
      resetZoom,
      handleWheel,
      startPan,
    }
  },
})
</script>

<style scoped>
.knowledge-graph-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: rgba(18, 18, 18, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  overflow: hidden;
  backdrop-filter: blur(20px);
}

.graph-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: rgba(24, 24, 27, 0.6);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.header-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.graph-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #e4e4e7;
}

.graph-title .material-icons {
  font-size: 20px;
  color: #3b82f6;
}

.mastery-badge {
  padding: 4px 12px;
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(16, 185, 129, 0.2) 100%);
  border: 1px solid rgba(34, 197, 94, 0.3);
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #22c55e;
}

.graph-controls {
  display: flex;
  gap: 6px;
}

.btn-control {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  color: #a1a1aa;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-control:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border-color: rgba(255, 255, 255, 0.15);
}

.btn-control:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-control .material-icons {
  font-size: 18px;
}

.btn-refresh .spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.graph-viewport {
  flex: 1;
  position: relative;
  overflow: hidden;
  min-height: 300px;
}

.graph-loading,
.graph-error {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  color: #a1a1aa;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(59, 130, 246, 0.2);
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.graph-error {
  text-align: center;
}

.graph-error .material-icons {
  font-size: 48px;
  color: #ef4444;
}

.graph-error p {
  margin: 0;
  max-width: 300px;
}

.btn-retry {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: #3b82f6;
  border: none;
  border-radius: 10px;
  color: #fff;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-retry:hover {
  background: #2563eb;
  transform: translateY(-1px);
}

.btn-retry .material-icons {
  font-size: 18px;
}

.mermaid-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transform-origin: center center;
  transition: transform 0.1s ease-out;
  user-select: none;
}

.mermaid {
  padding: 40px;
}

/* Override Mermaid styles for mastery colors */
:deep(.mermaid) {
  /* Base node styling */
  .node rect,
  .node circle,
  .node ellipse,
  .node polygon,
  .node path {
    stroke-width: 2px;
    transition: all 0.2s ease;
  }

  .node:hover rect,
  .node:hover circle,
  .node:hover ellipse,
  .node:hover polygon,
  .node:hover path {
    filter: brightness(1.2);
    stroke-width: 3px;
  }

  /* Edge styling */
  .edgePath .path {
    stroke: #4b5563;
    stroke-width: 2px;
  }

  .edgeLabel {
    background-color: #18181b;
    padding: 4px 8px;
  }

  /* Mastery class overrides */
  .mastered rect,
  .mastered circle,
  .mastered polygon {
    fill: #22c55e !important;
    stroke: #16a34a !important;
  }

  .mastered .nodeLabel {
    color: #fff !important;
  }

  .inProgress rect,
  .inProgress circle,
  .inProgress polygon {
    fill: #eab308 !important;
    stroke: #ca8a04 !important;
  }

  .inProgress .nodeLabel {
    color: #000 !important;
  }
}

.graph-legend {
  display: flex;
  justify-content: center;
  gap: 24px;
  padding: 12px 20px;
  background: rgba(24, 24, 27, 0.6);
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.75rem;
  color: #a1a1aa;
}

.legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 4px;
}

.legend-dot.mastered {
  background: #22c55e;
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.4);
}

.legend-dot.in-progress {
  background: #eab308;
  box-shadow: 0 0 8px rgba(234, 179, 8, 0.4);
}

.legend-dot.not-started {
  background: #27272a;
  border: 1px solid #3f3f46;
}
</style>
