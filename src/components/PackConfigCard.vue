<template>
  <div class="pack-config-container grid grid-cols-2 gap-3 w-full <md:grid-cols-1 items-stretch">
    <!-- 分块 1：工程与应用基础 -->
    <div class="card config-block-card block-app flex flex-col min-w-0 m-0 box-border">
      <div class="card-title flex justify-between items-center mb-3">
        <span>📱 工程与应用基础</span>
      </div>

      <!-- 目标工程路径选择 -->
      <div class="project-picker-box">
        <div class="picker-header flex justify-between items-center mb-1.5">
          <div class="picker-label-wrap flex items-center gap-2">
            <label>📁 目标 uni-app 项目目录</label>
            <span v-if="modelValue.projectDir && modelValue.isUniApp === false" class="tag-not-uniapp">非 uni-app 工程</span>
          </div>
          <span class="picker-tip">自动识别包管理器</span>
        </div>
        <div class="picker-row flex gap-2">
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

      <!-- 中间并排排布行：应用桌面图标 + 最小化构建类型（5:5 平分） -->
      <div class="app-sub-row grid grid-cols-2 gap-2.5 mb-2.5 <sm:grid-cols-1">
        <!-- 应用桌面图标 -->
        <div class="icon-section flex items-center gap-2.5 h-full">
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
          <div class="icon-meta flex-1 min-w-0">
            <div class="icon-title-bar flex items-center justify-between">
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
        <div class="pack-type-card flex flex-col justify-between h-full">
          <div class="pack-type-header flex items-center justify-between mb-1">
            <span class="pack-type-label">🎯 构建类型</span>
          </div>
          <div class="pack-type-group flex gap-0.5">
            <button
              type="button"
              class="pack-type-btn flex-1 flex items-center justify-center gap-1"
              :class="{ active: (modelValue.packType ?? 'release') === 'release' }"
              @click="updateField('packType', 'release')"
            >
              <span class="btn-icon">📦</span>
              <span class="btn-text">正式包</span>
            </button>
            <button
              type="button"
              class="pack-type-btn flex-1 flex items-center justify-center gap-1"
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
      <div class="form-grid-2 grid grid-cols-2 gap-x-3 gap-y-2 mt-0 <sm:grid-cols-1">
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
          <label class="label-with-badge flex items-center justify-between mb-1.5">
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
    <div class="card config-block-card block-cert flex flex-col min-w-0 m-0 box-border">
      <div class="card-title flex justify-between items-center mb-3">
        <div class="cert-title-wrap flex items-center gap-2">
          <span>🔑 签名证书与构建参数</span>
          <span v-if="modelValue.isDefaultCert" class="badge badge-ok">默认调试</span>
        </div>
        <div class="cert-actions flex items-center gap-1.5">
          <button class="btn btn-secondary btn-sm" @click="handleSelectCert">📁 选择证书</button>
          <button class="btn btn-secondary btn-sm btn-save" :disabled="isSaving" @click="handleSave">
            <span v-if="isSaving" class="spinner"></span>
            <span>💾 {{ isSaving ? '保存中...' : '保存配置' }}</span>
          </button>
        </div>
      </div>

      <div class="cert-active-file flex items-center gap-1.5 mb-2.5 text-xs text-textMuted min-w-0">
        <span>当前生效文件:</span>
        <code :class="{ 'text-muted': !modelValue.storeFile }">{{ modelValue.storeFile || '未配置 (请选择证书)' }}</code>
      </div>

      <div class="cert-inputs-grid grid grid-cols-3 gap-2 mb-2.5 <sm:grid-cols-1">
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

      <div class="publish-inputs-grid grid grid-cols-2 gap-2 mb-2.5 <sm:grid-cols-1">
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

      <div class="cert-sha1-box flex justify-between items-center gap-2.5 mt-0.5">
        <div class="cert-sha1-info flex-1 min-w-0">
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
  .config-block-card {
    .card-title {
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

      label {
        margin: 0;
        color: var(--accent);
        font-weight: 600;
        font-size: 12px;
      }

      .tag-not-uniapp {
        display: inline-flex;
        align-items: center;
        padding: 1px 6px;
        font-size: 11px;
        color: var(--danger);
        background: rgba(248, 81, 73, 0.12);
        border: 1px solid rgba(248, 81, 73, 0.35);
        border-radius: 4px;
        line-height: 1.2;
      }

      .picker-tip {
        font-size: 11px;
        color: var(--text-muted);
      }

      .btn-browse {
        white-space: nowrap;
        font-size: 12px;
        padding: 4px 12px;
      }
    }

    .app-sub-row {
      .icon-section {
        background: rgba(255, 255, 255, 0.03);
        padding: 6px 10px;
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.06);

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
          .icon-title {
            font-size: 12px;
            font-weight: 500;
            color: var(--text-bright);
          }

          .icon-status-ok {
            font-size: 11px;
            color: var(--primary-hover);
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

        .pack-type-header {
          .pack-type-label {
            font-size: 12px;
            font-weight: 500;
            color: var(--text-bright);
          }
        }

        .pack-type-group {
          background: rgba(0, 0, 0, 0.28);
          padding: 2px;
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.06);

          .pack-type-btn {
            padding: 4px 6px;
            border-radius: 4px;
            background: transparent;
            border: 1px solid transparent;
            color: var(--text);
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
              color: var(--accent);
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
  }

  .block-cert {
    .cert-actions {
      .btn-save {
        padding: 3px 10px;
        font-size: 12px;
      }
    }

    .cert-active-file {
      code {
        color: var(--accent);
        background: rgba(88, 166, 255, 0.1);
        padding: 2px 6px;
        border-radius: 4px;
        word-break: break-all;
        font-size: 12px;
      }
    }

    .cert-sha1-box {
      background: rgba(0, 0, 0, 0.25);
      border: 1px dashed rgba(88, 166, 255, 0.3);
      border-radius: 6px;
      padding: 8px 12px;

      .cert-sha1-info {
        .cert-sha1-label {
          font-size: 11px;
          color: var(--text-muted);
          margin-bottom: 2px;
        }

        .cert-sha1-val {
          color: var(--primary-hover);
          font-size: 12px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }
    }
  }

  .required-star {
    color: var(--danger);
    margin-left: 2px;
  }

  .mono-input {
    font-family: Consolas, monospace;
    font-size: 12px;
  }

  .btn-sm {
    padding: 2px 8px;
    font-size: 11px;
  }

  .label-with-badge {
    .badge-sm {
      font-size: 11px;
      padding: 1px 6px;
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
