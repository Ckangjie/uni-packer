<template>
  <div class="card pack-config-card">
    <div class="card-title">
      <span>⚙️ 应用打包配置</span>
      <button class="btn btn-secondary btn-save" :disabled="isSaving" @click="handleSave">
        <span v-if="isSaving" class="spinner"></span>
        <span>💾 {{ isSaving ? '保存中...' : '保存配置' }}</span>
      </button>
    </div>

    <!-- 目标工程路径选择 -->
    <div class="project-picker-box">
      <div class="picker-header">
        <label>📁 目标 uni-app 项目目录</label>
        <span class="picker-tip">自动识别 pnpm / npm / yarn</span>
      </div>
      <div class="picker-row">
        <input
          type="text"
          class="form-control mono-input"
          :value="modelValue.projectDir"
          placeholder="点击右侧选择目录，或直接输入本地路径"
          @input="updateField('projectDir', $event.target.value)"
          @change="handleProjectChange"
          @keydown.enter="handleProjectChange"
        />
        <button class="btn btn-secondary btn-browse" :disabled="isBrowsing" @click="handleBrowseDir">
          <span>📁 {{ isBrowsing ? '打开中...' : '选择目录' }}</span>
        </button>
      </div>
    </div>

    <!-- 应用桌面图标 -->
    <div class="icon-section">
      <div class="icon-avatar">
        <img
          v-if="iconPreviewUrl && !hasIconLoadError"
          :src="iconPreviewUrl"
          alt="App Icon"
          @error="hasIconLoadError = true"
          @load="hasIconLoadError = false"
        />
        <span v-else class="icon-fallback">📱</span>
      </div>
      <div class="icon-meta">
        <div class="icon-title-bar">
          <span class="icon-title">应用桌面图标</span>
          <span v-if="hasIconUpdated" class="icon-status-ok">✅ 已保存并同步</span>
        </div>
        <div class="icon-tip">支持 PNG / JPG，推荐 512×512 正方形图片</div>
        <input
          ref="iconInputRef"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          style="display: none;"
          @change="onIconFileSelected"
        />
        <button class="btn btn-secondary btn-sm" @click="triggerSelectIcon">🖼️ 更换新图标</button>
      </div>
    </div>

    <!-- 应用参数展示 (从 manifest.json 解析，保持与 Web 版一致为只读) -->
    <div class="form-row">
      <div class="form-group">
        <label>应用名称</label>
        <input
          type="text"
          class="form-control"
          :value="modelValue.appName"
          readonly
        />
      </div>
      <div class="form-group">
        <label>版本号</label>
        <input
          type="text"
          class="form-control"
          :value="modelValue.versionName"
          readonly
        />
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>应用包名</label>
        <input
          type="text"
          class="form-control"
          :value="modelValue.packageName"
          readonly
        />
      </div>
      <div class="form-group">
        <label>uni-app AppID</label>
        <input
          type="text"
          class="form-control"
          :value="modelValue.appId"
          readonly
        />
      </div>
    </div>

    <!-- Android 签名证书配置 -->
    <div class="cert-section">
      <div class="cert-header">
        <div class="cert-title-wrap">
          <span class="cert-title">🔑 Android 签名证书配置</span>
          <span :class="['badge', modelValue.isDefaultCert ? 'badge-ok' : 'badge-warn']">
            {{ modelValue.isDefaultCert ? '默认调试证书' : '自定义发布证书' }}
          </span>
        </div>
        <div class="cert-actions">
          <button class="btn btn-secondary btn-sm" @click="handleSelectCert">📁 选择证书文件</button>
        </div>
      </div>

      <div class="cert-active-file">
        <span>当前生效文件:</span>
        <code>{{ modelValue.storeFile || 'test.keystore' }}</code>
      </div>

      <div class="form-row cert-inputs">
        <div class="form-group">
          <label>证书密码</label>
          <input
            type="text"
            class="form-control mono-input"
            :value="modelValue.storePassword"
            placeholder="如：123456 (失焦或回车自动解析)"
            @input="updateField('storePassword', $event.target.value)"
            @blur="onPasswordBlurOrEnter"
            @keydown.enter="onPasswordBlurOrEnter"
          />
        </div>
        <div class="form-group">
          <label>证书别名</label>
          <input
            type="text"
            class="form-control mono-input"
            :value="modelValue.keyAlias"
            placeholder="自动提取或手动输入"
            @input="updateField('keyAlias', $event.target.value)"
            @keydown.enter="handleVerifyCert"
          />
        </div>
        <div class="form-group">
          <label>别名密码</label>
          <input
            type="text"
            class="form-control mono-input"
            :value="modelValue.keyPassword"
            placeholder="如：123456"
            @input="updateField('keyPassword', $event.target.value)"
          />
        </div>
      </div>

      <div class="cert-sha1-box">
        <div class="cert-sha1-info">
          <div class="cert-sha1-label">当前证书 SHA1 指纹：</div>
          <div class="copyable cert-sha1-val" @click="handleCopy(modelValue.sha1)">
            {{ modelValue.sha1 || '未提取/校验后生成' }}
          </div>
        </div>
        <button class="btn btn-secondary btn-sm" :disabled="isVerifyingCert" @click="handleVerifyCert">
          <span>⚡ {{ isVerifyingCert ? '校验中...' : '校验并保存' }}</span>
        </button>
      </div>
    </div>

    <!-- DCloud 离线 AppKey -->
    <div class="form-group">
      <label>DCloud 离线 AppKey</label>
      <input
        type="text"
        class="form-control"
        :value="modelValue.appKey"
        placeholder="粘贴从 DCloud 开发者中心申请的离线 AppKey"
        @input="updateField('appKey', $event.target.value)"
      />
    </div>

    <!-- 输出 APK 文件名 -->
    <div class="form-group">
      <label>输出 APK 文件名</label>
      <input
        type="text"
        class="form-control"
        :value="modelValue.apkName"
        placeholder="留空默认：应用名_v版本号.apk"
        @input="updateField('apkName', $event.target.value)"
      />
    </div>

  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  modelValue: {
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
  isSaving: {
    type: Boolean,
    default: false
  },
  isBrowsing: {
    type: Boolean,
    default: false
  },
  isVerifyingCert: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'update:modelValue',
  'browse-dir',
  'switch-project',
  'save',
  'start-build',
  'copy',
  'verify-cert',
  'reset-cert',
  'select-cert',
  'upload-icon'
])

const iconInputRef = ref(null)
const hasIconLoadError = ref(false)

watch(
  () => props.iconPreviewUrl,
  () => {
    hasIconLoadError.value = false
  }
)

function updateField(key, value) {
  emit('update:modelValue', {
    ...props.modelValue,
    [key]: value
  })
}

function handleProjectChange(event) {
  const dir = event.target.value?.trim()?.replace(/^["']|["']$/g, '') ?? ''
  updateField('projectDir', dir)
  emit('switch-project', dir)
}

function handleBrowseDir() {
  emit('browse-dir')
}

function handleSelectCert() {
  emit('select-cert')
}

function triggerSelectIcon() {
  iconInputRef.value?.click()
}

function onIconFileSelected(e) {
  const file = e.target.files?.[0]
  if (!file) return
  emit('upload-icon', file)
  e.target.value = ''
}

function handleResetCert() {
  emit('reset-cert')
}

let lastVerifiedPassword = ''

function handleVerifyCert() {
  emit('verify-cert')
}

function onPasswordBlurOrEnter() {
  const currentPw = props.modelValue.storePassword?.trim()
  if (!currentPw) return
  if (props.isVerifyingCert) return
  if (currentPw === lastVerifiedPassword && props.modelValue.keyAlias && props.modelValue.sha1) {
    return
  }
  lastVerifiedPassword = currentPw
  handleVerifyCert()
}

function handleSave() {
  emit('save')
}

function handleStartBuild() {
  emit('start-build')
}

function handleCopy(text) {
  if (text) emit('copy', text)
}
</script>

<style lang="scss" scoped>
.pack-config-card {
  .btn-save {
    padding: 4px 10px;
    font-size: 12px;
  }

  .project-picker-box {
    background: rgba(88, 166, 255, 0.06);
    border: 1px solid rgba(88, 166, 255, 0.22);
    border-radius: 8px;
    padding: 10px 12px;
    margin-bottom: 14px;

    .picker-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;

      label {
        margin: 0;
        color: #58a6ff;
        font-weight: 600;
        font-size: 13px;
      }

      .picker-tip {
        font-size: 11px;
        color: var(--text-muted);
      }
    }

    .picker-row {
      display: flex;
      gap: 8px;

      .btn-browse {
        white-space: nowrap;
        font-size: 12px;
        padding: 6px 14px;
      }
    }
  }

  .icon-section {
    display: flex;
    align-items: center;
    gap: 14px;
    background: rgba(255, 255, 255, 0.03);
    padding: 10px 14px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    margin-bottom: 14px;

    .icon-avatar {
      width: 48px;
      height: 48px;
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid var(--card-border);
      background: #000;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .icon-fallback {
        font-size: 22px;
      }
    }

    .icon-meta {
      flex: 1;

      .icon-title-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .icon-title {
        font-size: 13px;
        font-weight: 500;
        color: var(--text-bright);
      }

      .icon-status-ok {
        font-size: 12px;
        color: #3fb950;
      }

      .icon-tip {
        font-size: 11px;
        color: var(--text-muted);
        margin: 2px 0 6px 0;
      }
    }
  }

  .cert-section {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--card-border);
    border-radius: 8px;
    padding: 12px 14px;
    margin-bottom: 14px;

    .cert-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;

      .cert-title-wrap {
        display: flex;
        align-items: center;
        gap: 8px;

        .cert-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-bright);
        }
      }

      .cert-actions {
        display: flex;
        gap: 6px;
      }
    }

    .cert-active-file {
      font-size: 12px;
      color: var(--text-muted);
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 6px;

      code {
        color: var(--accent);
        background: rgba(88, 166, 255, 0.1);
        padding: 2px 6px;
        border-radius: 4px;
        word-break: break-all;
      }
    }

    .cert-inputs {
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-bottom: 8px;

      @media (max-width: 900px) {
        grid-template-columns: 1fr;
      }
    }

    .cert-sha1-box {
      margin-top: 10px;
      background: rgba(0, 0, 0, 0.25);
      border: 1px dashed rgba(88, 166, 255, 0.3);
      border-radius: 6px;
      padding: 8px 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;

      .cert-sha1-info {
        flex: 1;
        min-width: 0;

        .cert-sha1-label {
          font-size: 11px;
          color: var(--text-muted);
          margin-bottom: 2px;
        }

        .cert-sha1-val {
          color: #3fb950;
          font-size: 12px;
        }
      }
    }
  }

  .mono-input {
    font-family: monospace;
    font-size: 12px;
  }

  .btn-sm {
    padding: 2px 8px;
    font-size: 11px;
  }

  .build-action-row {
    margin-top: 16px;
  }
}
</style>
