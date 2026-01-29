<template>
  <div class="layout">
    <LessonSidebar :is-open="isSidebarOpen" @close="isSidebarOpen = false" />

    <header class="header" :class="{ 'header-transparent': isHomePage }">
      <div class="header-content">
        <router-link to="/" class="logo-area">
          <div class="logo-icon-wrapper">
            <span class="material-icons logo-icon">code</span>
          </div>
          <h1 class="logo-text">Learned<span class="highlight">.</span></h1>
        </router-link>
        <div class="spacer"></div>
        <nav class="nav-actions">
          <div class="user-avatar" @click="toggleProfile">
            <span>M</span>
          </div>
        </nav>
      </div>
    </header>

    <UserProfileCard v-if="isProfileOpen" />

    <main class="page-container">
      <router-view />
    </main>

    <LoadingOverlay v-model="showSystemUpdate" />
  </div>
</template>

<script>
import { defineComponent, computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import LessonSidebar from 'components/LessonSidebar.vue'
import UserProfileCard from 'components/UserProfileCard.vue'
import LoadingOverlay from 'components/LoadingOverlay.vue'
import { storeToRefs } from 'pinia'
import { useLessonStore } from '../stores/store'

export default defineComponent({
  name: 'MainLayout',
  components: {
    LessonSidebar,
    UserProfileCard,
    LoadingOverlay,
  },
  setup() {
    const lessonStore = useLessonStore()
    const { isSidebarOpen, showSystemUpdate } = storeToRefs(lessonStore)
    const route = useRoute()
    const isProfileOpen = ref(false)

    const isHomePage = computed(() => route.path === '/' || route.name === 'language-index')

    const toggleProfile = () => {
      isProfileOpen.value = !isProfileOpen.value
    }

    return {
      isSidebarOpen,
      isHomePage,
      isProfileOpen,
      showSystemUpdate,
      toggleProfile,
    }
  },
})
</script>

<style scoped>
.layout {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #000;
  color: #fff;
  font-family:
    'Inter',
    system-ui,
    -apple-system,
    sans-serif;
  overflow: hidden;
}

.header {
  height: 64px; /* Increased height for premium feel */
  background-color: rgba(10, 10, 10, 0.7); /* Translucent dark background */
  backdrop-filter: blur(16px); /* Strong glassmorphism */
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  padding: 0 24px;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 1000;
  transition: all 0.3s ease;
  width: 100%;
}

.header.header-transparent {
  position: absolute;
  background-color: transparent;
  border-bottom: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.header-content {
  width: 100%;
  margin: 0 auto;
  display: flex;
  align-items: center;
}

.logo-area {
  display: flex;
  align-items: center;
  text-decoration: none;
  color: inherit;
  gap: 12px;
}

.logo-icon-wrapper {
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  transition: transform 0.3s ease;
}

.logo-area:hover .logo-icon-wrapper {
  transform: rotate(-10deg) scale(1.05);
}

.logo-icon {
  font-size: 20px;
  color: white;
}

.logo-text {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
  letter-spacing: -0.5px;
  background: linear-gradient(to right, #ffffff, #a5a5a5);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.highlight {
  color: #3b82f6; /* Accent color dot */
  background: none;
  -webkit-text-fill-color: #3b82f6;
}

.spacer {
  flex-grow: 1;
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.btn-icon {
  background: transparent;
  border: none;
  color: #a1a1aa;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.btn-icon:hover {
  background-color: rgba(255, 255, 255, 0.05);
  color: #fff;
  transform: translateY(-1px);
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%; /* Circle */
  background: linear-gradient(135deg, #2d2d2d, #1a1a1a);
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  font-weight: 600;
  color: #fff;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  transition: all 0.2s ease;
}

.user-avatar:hover {
  border-color: rgba(255, 255, 255, 0.3);
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.1);
}

.page-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
  position: relative;
}
</style>
