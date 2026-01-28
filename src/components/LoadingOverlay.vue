<template>
  <div v-show="isVisible" class="fixed-full flex flex-center overflow-hidden bg-black z-top">
    <canvas ref="canvasRef" class="absolute-full"></canvas>

    <div class="status-container z-top text-center">
      <div class="status-text">{{ statusMessage }}</div>
      <div class="status-subtext">LOADING LESSON...</div>
      <div class="loading-bar-container">
        <div class="loading-bar"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: true,
  },
  statusMessage: {
    type: String,
    default: 'PROCESSING',
  },
})

// const emit = defineEmits(['update:modelValue'])

const canvasRef = ref(null)
const isVisible = ref(props.modelValue)

// Animation state
let animationFrameId = null
let stars = []
const STAR_COUNT = 1500
const SPEED_WARP = 45

// Canvas dimensions
let width = 0
let height = 0
let cx = 0
let cy = 0

class Star {
  constructor() {
    this.reset(true)
  }

  reset(randomZ = false) {
    this.x = (Math.random() - 0.5) * width * 3
    this.y = (Math.random() - 0.5) * height * 3
    this.z = randomZ ? Math.random() * width : width
    this.pz = this.z
  }

  update() {
    this.pz = this.z
    this.z -= SPEED_WARP

    if (this.z < 1) {
      this.reset()
      this.z = width
      this.pz = this.z
    }
  }

  draw(ctx) {
    const sx = (this.x / this.z) * width + cx
    const sy = (this.y / this.z) * height + cy

    const px = (this.x / this.pz) * width + cx
    const py = (this.y / this.pz) * height + cy

    if (sx < 0 || sx > width || sy < 0 || sy > height) return

    const dx = sx - cx
    const dy = sy - cy
    const dist = Math.sqrt(dx * dx + dy * dy)
    const centerSafeZone = 120

    let alpha = 1
    if (dist < centerSafeZone) {
      alpha = Math.max(0, (dist - 40) / (centerSafeZone - 40))
    }

    const depthAlpha = 1 - this.z / width
    alpha *= depthAlpha

    if (alpha <= 0.01) return

    ctx.beginPath()
    ctx.moveTo(px, py)
    ctx.lineTo(sx, sy)

    // Warp-specific styling
    ctx.strokeStyle = `hsla(180, 100%, 80%, ${alpha})`
    ctx.lineWidth = 2.5
    ctx.stroke()
  }
}

const initStars = () => {
  stars = []
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push(new Star())
  }
}

const resize = () => {
  if (!canvasRef.value) return
  width = window.innerWidth
  height = window.innerHeight
  canvasRef.value.width = width
  canvasRef.value.height = height
  cx = width / 2
  cy = height / 2
}

const animate = () => {
  if (!canvasRef.value) return
  const ctx = canvasRef.value.getContext('2d')

  ctx.fillStyle = 'black'
  ctx.fillRect(0, 0, width, height)

  stars.forEach((star) => {
    star.update()
    star.draw(ctx)
  })

  animationFrameId = requestAnimationFrame(animate)
}

watch(
  () => props.modelValue,
  (newVal) => {
    isVisible.value = newVal
  },
)

onMounted(() => {
  window.addEventListener('resize', resize)
  resize()
  initStars()
  animate()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  cancelAnimationFrame(animationFrameId)
})
</script>

<style scoped>
.z-top {
  z-index: 9999;
}

.fixed-full {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
}

.status-container {
  pointer-events: none;
  user-select: none;
}

.status-text {
  color: #00ffff;
  font-family: 'Outfit', sans-serif;
  font-size: 2.5rem;
  font-weight: 800;
  letter-spacing: 0.5rem;
  text-shadow: 0 0 20px rgba(0, 255, 255, 0.5);
  margin-bottom: 0.5rem;
  animation: pulse 2s infinite ease-in-out;
}

.status-subtext {
  color: rgba(255, 255, 255, 0.5);
  font-family: 'Inter', sans-serif;
  font-size: 0.75rem;
  letter-spacing: 0.3rem;
  margin-bottom: 2rem;
}

.loading-bar-container {
  width: 200px;
  height: 2px;
  background: rgba(255, 255, 255, 0.1);
  margin: 0 auto;
  overflow: hidden;
  border-radius: 2px;
}

.loading-bar {
  width: 40%;
  height: 100%;
  background: #00ffff;
  box-shadow: 0 0 10px #00ffff;
  animation: loading-slide 1.5s infinite ease-in-out;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 0.8;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.02);
  }
}

@keyframes loading-slide {
  0% {
    transform: translateX(-150%);
  }
  100% {
    transform: translateX(250%);
  }
}
</style>
