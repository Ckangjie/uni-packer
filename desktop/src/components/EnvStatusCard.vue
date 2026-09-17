<template>
  <div class="card env-status-card">
    <div class="card-title">
      <span>🛠️ 底层环境检测</span>
      <span :class="['badge', overallBadgeClass]">{{ overallStatusText }}</span>
    </div>

    <div class="status-list">
      <!-- JDK -->
      <div class="status-item">
        <div class="status-info">
          <div class="status-label">JDK 运行环境</div>
          <div class="status-detail" :title="envData?.jdk?.path">
            {{ envData?.jdk?.ok ? envData.jdk.path : (envData?.jdk?.error ?? '未检测到 JDK 17') }}
          </div>
        </div>
        <span :class="['badge', envData?.jdk?.ok ? 'badge-ok' : 'badge-err']">
          {{ envData?.jdk?.ok ? (envData.jdk.version ? `v${envData.jdk.version}` : '就绪') : '异常' }}
        </span>
      </div>

      <!-- Android SDK -->
      <div class="status-item">
        <div class="status-info">
          <div class="status-label">Android SDK</div>
          <div class="status-detail" :title="envData?.sdk?.path">
            {{ envData?.sdk?.ok ? envData.sdk.path : (envData?.sdk?.error ?? '未检测到') }}
          </div>
        </div>
        <span :class="['badge', envData?.sdk?.ok ? 'badge-ok' : 'badge-err']">
          {{ envData?.sdk?.ok ? '就绪' : '异常' }}
        </span>
      </div>

      <!-- Android 宿主壳工程 -->
      <div class="status-item">
        <div class="status-info">
          <div class="status-label">Android 宿主壳工程</div>
          <div class="status-detail" :title="envData?.shell?.path">
            {{ envData?.shell?.ok ? envData.shell.path : '未检测到壳工程目录' }}
          </div>
        </div>
        <span :class="['badge', envData?.shell?.ok ? 'badge-ok' : 'badge-err']">
          {{ envData?.shell?.ok ? '就绪' : '缺失' }}
        </span>
      </div>

      <!-- Gradle 命令行 -->
      <div class="status-item">
        <div class="status-info">
          <div class="status-label">Gradle 命令行</div>
          <div class="status-detail" :title="envData?.gradle?.path">
            {{ envData?.gradle?.ok ? envData.gradle.path : (envData?.gradle?.error ?? '未检测到') }}
          </div>
        </div>
        <span :class="['badge', envData?.gradle?.ok ? 'badge-ok' : 'badge-err']">
          {{ envData?.gradle?.ok ? (envData.gradle.isWrapper ? 'Gradle Wrapper' : '已就绪') : '未检测到' }}
        </span>
      </div>

      <!-- DCloud 基座核心 AAR -->
      <div class="status-item">
        <div class="status-info">
          <div class="status-label">DCloud 基座核心 AAR</div>
          <div class="status-detail">
            {{ aarDetailText }}
          </div>
        </div>
        <span :class="['badge', hasAar ? 'badge-ok' : 'badge-warn']">
          {{ hasAar ? '已就绪' : '需放 AAR' }}
        </span>
      </div>

      <!-- 签名证书 SHA1 -->
      <div class="status-item">
        <div class="status-info">
          <div class="status-label">签名证书 SHA1 (点击复制)</div>
          <div class="status-detail">
            <span class="copyable" @click="handleCopy(certSha1)">
              {{ certSha1 || '未生成/未就绪' }}
            </span>
          </div>
        </div>
        <span :class="['badge', isCertReady ? 'badge-ok' : 'badge-warn']">
          {{ isCertReady ? '就绪' : '未就绪' }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  envData: {
    type: Object,
    default: () => ({})
  },
  isLoading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['copy'])

const aarCount = computed(() => {
  return props.envData?.aar?.files?.length ?? 0
})

const hasAar = computed(() => {
  return aarCount.value > 0
})

const aarDetailText = computed(() => {
  return hasAar.value
    ? `已检测到 ${aarCount.value} 个核心库 (app/libs/*.aar)`
    : '⚠️ app/libs 暂无 aar，请放入官方 SDK'
})

const certSha1 = computed(() => {
  return props.envData?.cert?.sha1 ?? ''
})

const isCertReady = computed(() => {
  return Boolean(props.envData?.cert?.ok || props.envData?.cert?.sha1)
})

const isAllReady = computed(() => {
  if (props.envData?.overallOk !== undefined) {
    return Boolean(props.envData.overallOk)
  }
  return Boolean(
    props.envData?.jdk?.ok &&
    props.envData?.sdk?.ok &&
    props.envData?.shell?.ok &&
    props.envData?.gradle?.ok &&
    hasAar.value
  )
})

const overallStatusText = computed(() => {
  if (props.isLoading) return '检测中...'
  return isAllReady.value ? '核心环境就绪' : '部分环境缺失'
})

const overallBadgeClass = computed(() => {
  if (props.isLoading) return 'badge-warn'
  return isAllReady.value ? 'badge-ok' : 'badge-err'
})

function handleCopy(text) {
  if (text) emit('copy', text)
}
</script>

<style lang="scss" scoped>
.env-status-card {
  .status-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .status-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 10px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--card-border);
    border-radius: 6px;
    gap: 12px;
  }

  .status-info {
    min-width: 0;
    flex: 1;
  }

  .status-label {
    font-size: 12px;
    color: var(--text-bright);
    font-weight: 500;
  }

  .status-detail {
    font-size: 11px;
    color: var(--text-muted);
    font-family: monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-top: 2px;
  }
}
</style>
