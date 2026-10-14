<template>
  <div class="tab-pane tab-settings max-w-[800px] mx-auto">
    <div class="card settings-card">
      <div class="card-title flex justify-between items-center mb-3.5 pb-2">
        <span>⚙️ 工作台首选项</span>
      </div>

      <div class="settings-group flex flex-col gap-2.5">
        <div class="settings-item flex items-center justify-between p-3 rounded-lg">
          <div class="settings-meta">
            <div class="settings-title">项目历史记忆</div>
            <div class="settings-desc">清除最近一次载入的 uni-app 工程路径记忆</div>
          </div>
          <button class="btn btn-secondary btn-sm" @click="$emit('clear-cache')">
            🧹 清除缓存
          </button>
        </div>

        <div class="settings-item flex items-center justify-between p-3 rounded-lg">
          <div class="settings-meta">
            <div class="settings-title">底层环境探测</div>
            <div class="settings-desc">重新检查系统 JDK、Android SDK、Gradle 与 AAR</div>
          </div>
          <button class="btn btn-secondary btn-sm" :disabled="isLoadingEnv" @click="$emit('refresh-env')">
            <span v-if="isLoadingEnv" class="spinner"></span>
            <span>🔄 重新检测</span>
          </button>
        </div>
      </div>
    </div>

    <div class="card settings-card mt-4">
      <div class="card-title flex justify-between items-center mb-3.5 pb-2">
        <span>ℹ️ 关于工作台</span>
      </div>

      <div class="about-grid flex flex-col gap-2">
        <div class="about-item flex justify-between p-2 rounded-md">
          <span class="about-label">客户端版本</span>
          <span class="about-val">Desktop v1.0.0 (Portable)</span>
        </div>
        <div class="about-item flex justify-between p-2 rounded-md">
          <span class="about-label">技术架构</span>
          <span class="about-val">Electron 31 + Vue 3 + Vite 5</span>
        </div>
        <div class="about-item flex justify-between p-2 rounded-md">
          <span class="about-label">构建目标</span>
          <span class="about-val">Android 离线打包 (免 Android Studio)</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  isLoadingEnv: {
    type: Boolean,
    default: false
  }
})

defineEmits(['clear-cache', 'refresh-env'])
</script>

<style lang="scss" scoped>
.settings-card {
  .settings-item {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--card-border);

    .settings-meta {
      .settings-title {
        font-size: 13px;
        color: var(--text-bright);
        font-weight: 500;
      }

      .settings-desc {
        font-size: 12px;
        color: var(--text-muted);
        margin-top: 2px;
      }
    }
  }

  .about-item {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--card-border);
    font-size: 12px;

    .about-label {
      color: var(--text-muted);
    }

    .about-val {
      color: var(--text-bright);
      font-family: monospace;
    }
  }
}
</style>
