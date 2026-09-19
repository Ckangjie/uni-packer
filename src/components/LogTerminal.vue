<template>
  <div class="card log-terminal-card">
    <div class="card-title">
      <div class="title-left">
        <span>📋 构建与打包实时日志</span>
      </div>
      <div class="title-actions">
        <button
          class="btn btn-secondary btn-clear"
          :disabled="isBuilding || !hasLogs"
          @click="handleClear"
        >
          清空
        </button>
        <button
          v-if="isUniApp !== false"
          class="btn btn-primary btn-build"
          :disabled="isBuilding"
          @click="handleStartBuild"
        >
          <span v-if="isBuilding" class="spinner"></span>
          <span>{{ isBuilding ? '打包中...' : '打包' }}</span>
        </button>
      </div>
    </div>

    <!-- 终端视口容器 -->
    <div ref="windowRef" class="terminal-window">
      <div v-show="!hasLogs" class="empty-tip">
        等待任务触发... 点击右上角「打包」即可查看实时流水线。
      </div>
      <div ref="logsRef" class="terminal-logs"></div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  isBuilding: {
    type: Boolean,
    default: false
  },
  canBuild: {
    type: Boolean,
    default: false
  },
  isUniApp: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['start-build', 'clear'])

function handleStartBuild() {
  emit('start-build')
}

function handleClear() {
  clearLog()
  emit('clear')
}

const windowRef = ref(null)
const logsRef = ref(null)
const hasLogs = ref(false)

// 高性能日志缓冲机制：每 80ms 或积压 400 条批量刷新一次
let logBuf = []
let logTimer = null

function flushLog() {
  if (logTimer) {
    clearTimeout(logTimer)
    logTimer = null
  }
  if (!logBuf.length || !logsRef.value) return

  const frag = document.createDocumentFragment()
  for (const item of logBuf) {
    const span = document.createElement('span')
    span.className = `log-line line-${item.type}`
    span.textContent = item.text
    frag.appendChild(span)
  }
  logBuf = []
  logsRef.value.appendChild(frag)
  if (windowRef.value) {
    windowRef.value.scrollTop = windowRef.value.scrollHeight
  }
  hasLogs.value = true
}

function appendLog(text, type = 'normal') {
  logBuf.push({ text, type })
  if (logBuf.length >= 400) {
    flushLog()
    return
  }
  if (!logTimer) {
    logTimer = setTimeout(flushLog, 80)
  }
}

function clearLog() {
  logBuf = []
  if (logTimer) {
    clearTimeout(logTimer)
    logTimer = null
  }
  if (logsRef.value) {
    logsRef.value.innerHTML = ''
  }
  hasLogs.value = false
}

function getLogText() {
  return logsRef.value?.innerText ?? ''
}

defineExpose({
  appendLog,
  clearLog,
  getLogText
})
</script>

<style lang="scss" scoped>
.log-terminal-card {
  margin-top: 0;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;

  .title-left {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .title-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;

    .btn-clear {
      padding: 4px 10px;
      font-size: 12px;
      border-radius: 6px;
      white-space: nowrap;
    }

    .btn-build {
      padding: 4px 14px;
      font-size: 12px;
      font-weight: 600;
      border-radius: 6px;
      white-space: nowrap;
    }
  }

  .terminal-window {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    height: clamp(260px, 36vh, 460px);
    min-height: 240px;
    border: 1px solid var(--card-border);
    border-radius: 8px;
    overflow-y: auto;
    overflow-x: hidden;
    background: var(--code-bg);
    padding: 12px 14px;
    font-family: Consolas, "Courier New", monospace;
    font-size: 12px;
    line-height: 1.6;
    user-select: text;

    :deep(.log-line) {
      display: block;
      color: #7ee787;
      white-space: pre-wrap;
      word-break: break-all;

      &.line-err {
        color: #f85149;
      }

      &.line-warn {
        color: #d29922;
      }

      &.line-info {
        color: #58a6ff;
      }
    }

    .empty-tip {
      color: var(--text-muted);
      font-style: italic;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
  }
}
</style>
