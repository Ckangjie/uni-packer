<template>
  <div class="pack-config-container">
    <!-- 分块 1：工程与应用基础 -->
    <div class="card config-block-card block-app">
      <div class="card-title">
        <span>📱 工程与应用基础</span>
      </div>

      <!-- 目标工程路径选择 -->
      <div class="project-picker-box">
        <div class="picker-header">
          <div class="picker-label-wrap">
            <label>📁 目标 uni-app 项目目录</label>
            <span v-if="modelValue.projectDir && modelValue.isUniApp === false" class="tag-not-uniapp">非 uni-app 工程</span>
          </div>
          <span class="picker-tip">自动识别包管理器</span>
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

      <!-- 中间并排排布行：应用桌面图标 + 最小化构建类型 -->
      <div class="app-sub-row">
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
              <span v-if="hasIconUpdated" class="icon-status-ok">✅ 已同步</span>
            </div>
            <div class="icon-tip">512×512 正方形图片</div>
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

        <!-- 构建类型（最小化分段胶囊，无提示文本） -->
        <div class="pack-type-card">
          <div class="pack-type-header">
            <span class="pack-type-label">🎯 构建类型</span>
          </div>
          <div class="pack-type-group">
            <button
              type="button"
              class="pack-type-btn"
              :class="{ active: (modelValue.packType ?? 'release') === 'release' }"
              @click="updateField('packType', 'release')"
            >
              <span class="btn-icon">📦</span>
              <span class="btn-text">正式包</span>
            </button>
            <button
              type="button"
              class="pack-type-btn"
              :class="{ active: modelValue.packType === 'custom_base' }"
              @click="updateField('packType', 'custom_base')"
            >
              <span class="btn-icon">🛠️</span>
              <span class="btn-text">基座</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 应用参数展示 (从 manifest.json 解析，只读) -->
      <div class="form-grid-2">
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
        <div class="form-group">
          <label class="label-with-badge">
            <span>应用包名 <span class="required-star">*</span></span>
            <span v-if="modelValue.isPackageExtracted" class="badge badge-ok badge-sm">已提取 (只读)</span>
            <span v-else class="badge badge-warn badge-sm">未提取 (可编辑)</span>
          </label>
          <input
            type="text"
            class="form-control mono-input"
            :class="{ 'input-readonly': modelValue.isPackageExtracted }"
            :value="modelValue.packageName"
            :readonly="modelValue.isPackageExtracted"
            :placeholder="modelValue.isPackageExtracted ? '' : '如: com.company.app (未提取到，请手动输入)'"
            @input="updateField('packageName', $event.target.value.trim())"
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
    </div>

    <!-- 分块 2：Android 签名证书与发行参数 -->
    <div class="card config-block-card block-cert">
      <div class="card-title">
        <div class="cert-title-wrap">
          <span>🔑 签名证书与构建参数</span>
          <span v-if="modelValue.isDefaultCert" class="badge badge-ok">默认调试</span>
        </div>
        <div class="cert-actions">
          <button class="btn btn-secondary btn-sm" @click="handleSelectCert">📁 选择证书</button>
          <button class="btn btn-secondary btn-sm btn-save" :disabled="isSaving" @click="handleSave">
            <span v-if="isSaving" class="spinner"></span>
            <span>💾 {{ isSaving ? '保存中...' : '保存配置' }}</span>
          </button>
        </div>
      </div>

      <div class="cert-active-file">
        <span>当前生效文件:</span>
        <code :class="{ 'text-muted': !modelValue.storeFile }">{{ modelValue.storeFile || '未配置 (请选择证书)' }}</code>
      </div>

      <div class="cert-inputs-grid">
        <div class="form-group">
          <label>证书密码</label>
          <input
            type="text"
            class="form-control mono-input"
            :value="modelValue.storePassword"
            placeholder="输入密码 (失焦后自动提取别名与SHA1)"
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
            :placeholder="modelValue.appId ? '默认: ' + modelValue.appId : '输入别名'"
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

      <div class="publish-inputs-grid">
        <div class="form-group">
          <label>DCloud 离线 AppKey</label>
          <input
            type="text"
            class="form-control mono-input"
            :value="modelValue.appKey"
            placeholder="粘贴从 DCloud 申请的离线 AppKey"
            @input="updateField('appKey', $event.target.value)"
          />
        </div>

        <div class="form-group">
          <label>输出 APK 文件名</label>
          <input
            v-if="modelValue.packType === 'custom_base'"
            type="text"
            class="form-control mono-input input-readonly"
            value="android_debug.apk (HBuilderX基座规范)"
            readonly
          />
          <input
            v-else
            type="text"
            class="form-control"
            :value="modelValue.apkName"
            placeholder="留空默认：应用名_v版本号.apk"
            @input="updateField('apkName', $event.target.value)"
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
          <span>⚡ {{ isVerifyingCert ? '校验中...' : '校验' }}</span>
        </button>
      </div>
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
  if (!props.modelValue.storeFile) return
  if (props.isVerifyingCert) return
  if (currentPw === lastVerifiedPassword && props.modelValue.sha1) {
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
.pack-config-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
  gap: 12px;
  width: 100%;
  min-width: 0;
  align-items: stretch;

  @media (max-width: 860px) {
    grid-template-columns: 1fr;
  }

  .config-block-card {
    display: flex;
    flex-direction: column;
    min-width: 0;
    margin: 0;
    box-sizing: border-box;

    .card-title {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      font-size: 13px;
      font-weight: 600;
      color: var(--text-bright);
    }
  }

  .block-app {
    .project-picker-box {
      background: rgba(88, 166, 255, 0.06);
      border: 1px solid rgba(88, 166, 255, 0.22);
      border-radius: 8px;
      padding: 8px 12px;
      margin-bottom: 10px;

      .picker-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 6px;

        .picker-label-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        label {
          margin: 0;
          color: #58a6ff;
          font-weight: 600;
          font-size: 12px;
        }

        .tag-not-uniapp {
          display: inline-flex;
          align-items: center;
          padding: 1px 6px;
          font-size: 11px;
          color: #f85149;
          background: rgba(248, 81, 73, 0.12);
          border: 1px solid rgba(248, 81, 73, 0.35);
          border-radius: 4px;
          box-sizing: border-box;
          line-height: 1.2;
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
          padding: 4px 12px;
        }
      }
    }

    .app-sub-row {
      display: grid;
      grid-template-columns: 1.15fr 0.85fr;
      gap: 10px;
      margin-bottom: 10px;

      @media (max-width: 560px) {
        grid-template-columns: 1fr;
      }

      .icon-section {
        display: flex;
        align-items: center;
        gap: 10px;
        background: rgba(255, 255, 255, 0.03);
        padding: 6px 10px;
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.06);
        box-sizing: border-box;
        height: 100%;

        .icon-avatar {
          width: 38px;
          height: 38px;
          border-radius: 8px;
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
            font-size: 18px;
          }
        }

        .icon-meta {
          flex: 1;
          min-width: 0;

          .icon-title-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
          }

          .icon-title {
            font-size: 12px;
            font-weight: 500;
            color: var(--text-bright);
          }

          .icon-status-ok {
            font-size: 11px;
            color: #3fb950;
          }

          .icon-tip {
            font-size: 10px;
            color: var(--text-muted);
            margin: 1px 0 2px 0;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .btn-sm {
            padding: 1px 6px;
            font-size: 11px;
          }
        }
      }

      .pack-type-card {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 8px;
        padding: 6px 10px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        box-sizing: border-box;
        height: 100%;

        .pack-type-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 4px;

          .pack-type-label {
            font-size: 12px;
            font-weight: 500;
            color: var(--text-bright);
          }
        }

        .pack-type-group {
          display: flex;
          background: rgba(0, 0, 0, 0.28);
          padding: 2px;
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.06);
          gap: 2px;

          .pack-type-btn {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            padding: 4px 6px;
            border-radius: 4px;
            background: transparent;
            border: 1px solid transparent;
            color: var(--text-color, #c9d1d9);
            font-size: 11px;
            cursor: pointer;
            transition: all 0.15s ease;
            white-space: nowrap;

            &:hover {
              color: var(--text-bright);
              background: rgba(255, 255, 255, 0.06);
            }

            &.active {
              background: rgba(88, 166, 255, 0.2);
              border-color: rgba(88, 166, 255, 0.5);
              color: #58a6ff;
              font-weight: 600;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
            }

            .btn-icon {
              font-size: 11px;
            }
          }
        }
      }
    }

    .form-grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 12px;
      margin-top: 0;

      @media (max-width: 480px) {
        grid-template-columns: 1fr;
      }
    }
  }

  .block-cert {
    .cert-title-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .cert-actions {
      display: flex;
      align-items: center;
      gap: 6px;

      .btn-save {
        padding: 3px 10px;
        font-size: 12px;
      }
    }

    .cert-active-file {
      font-size: 12px;
      color: var(--text-muted);
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;

      code {
        color: var(--accent);
        background: rgba(88, 166, 255, 0.1);
        padding: 2px 6px;
        border-radius: 4px;
        word-break: break-all;
        font-size: 12px;
      }
    }

    .cert-inputs-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-bottom: 10px;

      @media (max-width: 600px) {
        grid-template-columns: 1fr;
      }
    }

    .publish-inputs-grid {
      display: grid;
      grid-template-columns: 1.1fr 1fr;
      gap: 8px;
      margin-bottom: 10px;

      @media (max-width: 600px) {
        grid-template-columns: 1fr;
      }
    }

    .cert-sha1-box {
      margin-top: 2px;
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
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }
    }
  }

  .required-star {
    color: #f85149;
    margin-left: 2px;
  }

  .mono-input {
    font-family: Consolas, monospace;
    font-size: 12px;
  }

  .btn-sm {
    padding: 2px 8px;
    box-sizing: border-box;
    font-size: 11px;
  }

  .label-with-badge {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;

    .badge-sm {
      font-size: 11px;
      padding: 1px 6px;
      box-sizing: border-box;
      font-weight: 500;
    }
  }

  .input-readonly {
    background: rgba(255, 255, 255, 0.04) !important;
    color: var(--text-muted) !important;
    cursor: default;
    user-select: all;
  }
}
</style>
