<template>
  <div class="profile-card">
    <div class="card-header">
      <div class="avatar-large">
        <span>{{ userProfile.name.charAt(0) }}</span>
      </div>
      <div class="user-info">
        <h3 class="user-name">{{ userProfile.name }}</h3>
        <span class="user-status">Online</span>
      </div>
    </div>

    <div class="stats-bar">
      <div class="stat-mini level-visual" title="Overall Level">
        <div class="level-bars">
          <div v-for="i in 4" :key="i" class="bar" :class="{ active: i <= overallLevel }"></div>
        </div>
        <span class="stat-value">Level {{ overallLevel }}</span>
      </div>
      <div class="divider-v"></div>
      <div class="stat-mini lessons" title="Lessons Completed">
        <span class="material-icons">check_circle</span>
        <span class="stat-value">{{ completedLessonsCount }} lessons</span>
      </div>
      <div class="divider-v"></div>
      <div class="stat-mini time" title="Learning Time">
        <span class="material-icons">schedule</span>
        <span class="stat-value">{{ formattedTotalTime }}</span>
      </div>
    </div>

    <div class="divider"></div>

    <div class="languages-section">
      <h4 class="section-title">Active Languages</h4>
      <div class="languages-list">
        <div
          v-for="lang in activeLanguages"
          :key="lang.id"
          class="lang-badge"
          :style="{ borderColor: lang.color }"
        >
          <span class="lang-icon" :class="lang.icon" :style="{ color: lang.color }"></span>
          <span class="lang-name">{{ lang.name }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { defineComponent, computed } from 'vue'
import { useLessonStore } from '../stores/store'
import { storeToRefs } from 'pinia'

export default defineComponent({
  name: 'UserProfileCard',
  setup() {
    const store = useLessonStore()
    const { userProfile, lessons, formattedTotalTime, overallLevel } = storeToRefs(store)

    const completedLessonsCount = computed(() => {
      return lessons.value.filter((l) => l.isCompleted).length
    })

    const activeLanguages = computed(() => {
      return userProfile.value.languages.filter((l) => !l.disabled)
    })

    return {
      userProfile,
      completedLessonsCount,
      activeLanguages,
      formattedTotalTime,
      overallLevel,
    }
  },
})
</script>

<style scoped>
.profile-card {
  position: absolute;
  top: 70px;
  right: 24px;
  width: 320px;
  background-color: rgba(15, 15, 15, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 16px;
  box-shadow:
    0 10px 40px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.05); /* Inner stroke */
  z-index: 1000;
  color: #fff;
  animation: slideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  transform-origin: top right;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.card-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}

.avatar-large {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.75rem;
  font-weight: 700;
  color: white;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  border: 2px solid rgba(255, 255, 255, 0.1);
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.user-name {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.user-status {
  font-size: 0.875rem;
  color: #a1a1aa;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
}

.user-status::before {
  content: '';
  display: block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #10b981; /* Online/Active color */
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
}

.stats-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background-color: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  margin-bottom: 24px;
}

.stat-mini {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #a1a1aa;
  transition: color 0.2s ease;
}

.stat-mini:hover {
  color: #fff;
}

.stat-mini .material-icons {
  font-size: 16px;
}

.stat-mini.xp .material-icons {
  color: #f59e0b;
}
.stat-mini.lessons .material-icons {
  color: #10b981;
}
.stat-mini.time .material-icons {
  color: #3b82f6;
}

.stat-mini .stat-value {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #fff;
}

.level-visual {
  gap: 10px;
}

/* Level bars styles moved to global CSS */

.divider-v {
  width: 1px;
  height: 16px;
  background-color: rgba(255, 255, 255, 0.1);
}

.divider {
  height: 1px;
  background-color: rgba(255, 255, 255, 0.1);
  margin-bottom: 20px;
}

.section-title {
  font-size: 0.875rem;
  color: #a1a1aa;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 12px 0;
  font-weight: 600;
}

.languages-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.lang-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background-color: rgba(255, 255, 255, 0.03);
  border: 1px solid transparent; /* Set by inline style */
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 500;
  color: #e4e4e7;
}

.lang-icon {
  font-size: 1rem;
}
</style>
