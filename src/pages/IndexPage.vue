<template>
  <div
    class="flex flex-center bg-dark text-white relative-position overflow-hidden"
    style="flex: 1"
  >
    <!-- Background Gradient Blob -->
    <div class="absolute-top-left bg-gradient-blob"></div>

    <div class="content-container q-pa-md" style="max-width: 1200px; width: 100%; z-index: 1">
      <!-- Header Section -->
      <div class="row items-center justify-between q-mb-xl">
        <div>
          <h1 class="text-h3 text-weight-bold q-my-none font-outfit">Welcome back!</h1>
          <p class="text-grey-5 q-mt-sm text-subtitle1">Ready to continue your coding journey?</p>
        </div>

        <!-- User Metrics -->
        <div class="row q-gutter-md">
          <div class="metric-card glass-panel row items-center q-px-md q-py-sm">
            <div class="level-bars q-mr-md">
              <div v-for="i in 4" :key="i" class="bar" :class="{ active: i <= overallLevel }"></div>
            </div>
            <div>
              <div class="text-caption text-grey-5 text-uppercase">Level</div>
              <div class="text-h5 text-weight-bold">{{ overallLevel }}</div>
            </div>
          </div>

          <div class="metric-card glass-panel row items-center q-px-md q-py-sm">
            <q-icon name="schedule" color="blue-4" size="2rem" />
            <div class="q-ml-sm">
              <div class="text-caption text-grey-5 text-uppercase">Time Spent</div>
              <div class="text-h5 text-weight-bold">{{ formattedTotalTime }}</div>
            </div>
          </div>

          <div class="metric-card glass-panel row items-center q-px-md q-py-sm">
            <q-icon name="check_circle" color="green-4" size="2rem" />
            <div class="q-ml-sm">
              <div class="text-caption text-grey-5 text-uppercase">Lessons</div>
              <div class="text-h5 text-weight-bold">{{ completedLessonsCount }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Language Selection -->
      <div class="q-mt-xl">
        <h2 class="text-h5 text-weight-medium q-mb-lg font-outfit">Select a Path</h2>

        <div class="row q-col-gutter-lg">
          <div v-for="lang in userProfile.languages" :key="lang.id" class="col-12 col-md-4">
            <q-card
              class="language-card column no-wrap"
              :class="{ 'disabled-card': lang.disabled, 'cursor-pointer': !lang.disabled }"
              v-ripple="!lang.disabled"
              @click="selectLanguage(lang)"
            >
              <div class="q-pa-lg flex-grow-1">
                <div class="row items-center justify-between q-mb-md">
                  <q-avatar
                    :style="{ backgroundColor: 'rgba(255,255,255,0.1)' }"
                    text-color="white"
                    size="3.5rem"
                    font-size="2rem"
                  >
                    <q-icon
                      :name="lang.icon"
                      :style="{ color: lang.disabled ? '#aaa' : lang.color }"
                    />
                  </q-avatar>
                  <q-badge
                    v-if="lang.comingSoon"
                    color="grey-8"
                    text-color="white"
                    label="Coming Soon"
                    class="q-py-xs q-px-sm text-weight-bold"
                    style="font-size: 0.75rem; border: 1px solid rgba(255, 255, 255, 0.2)"
                  />
                </div>

                <div
                  class="text-h5 text-weight-bold q-mb-xs"
                  :class="{ 'text-grey-6': lang.disabled }"
                >
                  {{ lang.name }}
                </div>
                <div class="text-grey-5 text-body2" style="min-height: 48px">
                  {{ lang.description }}
                </div>
              </div>
            </q-card>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { defineComponent, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useLessonStore } from 'stores/store'
import { storeToRefs } from 'pinia'

export default defineComponent({
  name: 'IndexPage',
  setup() {
    const router = useRouter()
    const store = useLessonStore()
    const { userProfile, overallLevel, formattedTotalTime, lessons } = storeToRefs(store)

    const completedLessonsCount = computed(() => {
      return (lessons.value || []).filter((l) => l.isCompleted).length
    })

    const selectLanguage = async (lang) => {
      if (lang.disabled) return
      await store.resumeCourse(lang.id, router)
    }

    return {
      userProfile,
      overallLevel,
      completedLessonsCount,
      formattedTotalTime,
      selectLanguage,
    }
  },
})
</script>

<style scoped>
.bg-dark {
  background-color: #0f0f12;
}

.font-outfit {
  font-family: 'Outfit', sans-serif; /* Ensure this font is loaded or fallback */
}

/* Glassmorphism Utilities */
/* Now in global css */

.metric-card {
  min-width: 140px;
  transition: transform 0.2s ease;
}

/* Level Bars */
/* Now in global css */

.metric-card:hover {
  transform: translateY(-2px);
  background: rgba(255, 255, 255, 0.05);
}

.language-card {
  height: 100%;
  background: #18181b;
  border-radius: 24px;
  border: 1px solid #27272a;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.language-card:hover {
  transform: translateY(-8px);
  border-color: #3f3f46;
  box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.5);
  background: #202023;
}

.disabled-card {
  opacity: 0.6;
  cursor: not-allowed;
  filter: grayscale(0.8);
}

.disabled-card:hover {
  transform: none;
  background: #18181b;
  border-color: #27272a;
  box-shadow: none;
}

.bg-gradient-blob {
  position: absolute;
  top: -10%;
  left: -10%;
  width: 50%;
  height: 50%;
  background: radial-gradient(circle, rgba(66, 184, 131, 0.15) 0%, rgba(0, 0, 0, 0) 70%);
  filter: blur(80px);
  z-index: 0;
  pointer-events: none;
}
</style>
