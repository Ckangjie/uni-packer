<template>
  <div class="tab-pane tab-workbench w-full max-w-full">
    <div class="workbench-layout flex flex-col gap-3.5 w-full min-w-0">
      <!-- 上方：应用打包配置分块区域 -->
      <div class="config-section w-full min-w-0">
        <PackConfigCard
          ref="packConfigCardRef"
          :model-value="packConfig"
          :icon-preview-url="iconPreviewUrl"
          :has-icon-updated="hasIconUpdated"
          :is-building="isBuilding"
          :is-saving="isSavingConfig"
          :is-browsing="isBrowsingDir"
          :is-verifying-cert="isVerifyingCert"
          @update:model-value="$emit('update:packConfig', $event)"
          @browse-dir="$emit('browse-dir')"
          @switch-project="$emit('switch-project', $event)"
          @save="$emit('save')"
          @start-build="$emit('start-build')"
          @verify-cert="$emit('verify-cert')"
          @reset-cert="$emit('reset-cert')"
          @select-cert="$emit('select-cert')"
          @upload-icon="$emit('upload-icon', $event)"
          @copy="$emit('copy', $event)"
        />
      </div>

      <!-- 下方：实时终端构建流水线日志与底部产物结果展示 (通栏) -->
      <div class="terminal-section flex flex-col gap-3 w-full min-w-0">
        <LogTerminal
          ref="terminalRef"
          :is-building="isBuilding"
          :can-build="canBuild"
          :is-uni-app="packConfig.isUniApp"
          @start-build="$emit('start-build')"
          @clear="$emit('clear-logs')"
        />

        <!-- 打包成功/完成结果展示区 -->
        <div
          v-if="buildResult"
          :class="['card', 'build-result-card flex items-center justify-between p-2.5 gap-3 rounded-lg w-full min-w-0 box-border', buildResult.isSuccess ? 'success' : 'error']"
        >
          <div class="result-info flex items-center gap-2.5 min-w-0 flex-1">
            <span class="result-icon text-xl flex-shrink-0 leading-none">{{ buildResult.isSuccess ? '🎉' : '❌' }}</span>
            <div class="result-content min-w-0 flex-1">
              <div class="result-title text-[13px] font-semibold truncate">{{ buildResult.isSuccess ? '打包成功！产物已就绪' : (buildResult.message || '打包失败') }}</div>
            </div>
          </div>
          <div class="result-actions flex items-center gap-2 flex-shrink-0 whitespace-nowrap">
            <button v-if="buildResult.isSuccess" class="btn btn-primary btn-sm" @click="$emit('open-dist-dir', buildResult.apkPath)">
              📂 打开所在目录
            </button>
            <button v-else class="btn btn-secondary btn-sm" @click="$emit('copy-error-log')">
              📋 复制错误日志
            </button>
            <button
              class="btn-close-result"
              title="关闭结果提示"
              @click="$emit('close-result')"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import PackConfigCard from '@/components/PackConfigCard.vue'
import LogTerminal from '@/components/LogTerminal.vue'

defineProps({
  packConfig: {
    type: Object,
    required: true
  },
  iconPreviewUrl: {
    type: String,
    default: ''
  },
  hasIconUpdated: {
    type: Boolean,
    default: false
  },
  isBuilding: {
    type: Boolean,
    default: false
  },
  isSavingConfig: {
    type: Boolean,
    default: false
  },
  isBrowsingDir: {
    type: Boolean,
    default: false
  },
  isVerifyingCert: {
    type: Boolean,
    default: false
  },
  buildResult: {
    type: Object,
    default: null
  },
  canBuild: {
    type: Boolean,
    default: false
  }
})

defineEmits([
  'update:packConfig',
  'browse-dir',
  'switch-project',
  'save',
  'start-build',
  'verify-cert',
  'reset-cert',
  'select-cert',
  'upload-icon',
  'copy',
  'open-dist-dir',
  'copy-error-log',
  'clear-logs',
  'close-result'
])

const packConfigCardRef = ref(null)
const terminalRef = ref(null)

defineExpose({
  packConfigCardRef,
  terminalRef
})
</script>

<style lang="scss" scoped>
.build-result-card {
  position: fixed;
  bottom: 24px;
  left: 240px;
  right: 24px;
  max-width: calc(100vw - 264px);
  z-index: 50;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.55);
  animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  box-sizing: border-box;

  @media (max-width: 768px) {
    left: 16px;
    right: 16px;
    max-width: calc(100vw - 32px);
  }

  &.success {
    background: rgba(22, 38, 27, 0.95);
    border: 1px solid rgba(46, 160, 67, 0.6);
    backdrop-filter: blur(8px);

    .result-title {
      color: #3fb950;
    }
  }

  &.error {
    background: rgba(43, 20, 22, 0.95);
    border: 1px solid rgba(248, 81, 73, 0.6);
    backdrop-filter: blur(8px);

    .result-title {
      color: #f85149;
    }
  }

  .btn-close-result {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: var(--text-muted);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s ease;
    line-height: 1;

    &:hover {
      background: rgba(255, 255, 255, 0.2);
      color: var(--text-bright);
    }
  }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(100%);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
