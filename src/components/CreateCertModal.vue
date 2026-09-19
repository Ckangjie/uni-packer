<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="handleClose">
    <div class="modal-container">
      <div class="modal-header">
        <div class="modal-title">
          <span class="modal-icon">⚡</span>
          <span>生成专属正式签名证书</span>
        </div>
        <button class="btn-close" @click="handleClose">✕</button>
      </div>

      <div class="modal-body">
        <!-- 提示与 DCloud 引导 -->
        <div class="notice-banner">
          <div class="notice-text">
            <span>💡 本地生成符合正式商用上架标准的 RSA 2048 位证书（默认 100 年永久有效）。</span>
            <span>如使用已在 DCloud 开发者后台生成的云端证书，可直接点击【选择证书】导入其下载的 <code>.keystore</code>。</span>
          </div>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">
              <span>证书文件名</span>
              <span class="label-tip">保存在项目 config 目录</span>
            </label>
            <input
              v-model.trim="form.fileName"
              type="text"
              class="form-control mono-input"
              placeholder="如：release.keystore"
            />
          </div>

          <div class="form-group">
            <label class="form-label">
              <span>证书别名 (Alias)</span>
              <span class="label-tip">用于签名的唯一标识</span>
            </label>
            <input
              v-model.trim="form.keyAlias"
              type="text"
              class="form-control mono-input"
              placeholder="如：release"
            />
          </div>

          <div class="form-group form-col-full">
            <div class="password-label-row">
              <label class="form-label">
                <span>证书密码</span>
                <span class="label-tip">别名共用此密码 (≥ 6 位)</span>
              </label>
              <button type="button" class="btn-text" @click="generateRandomPassword">
                🎲 随机强密码
              </button>
            </div>
            <div class="password-input-wrap">
              <input
                v-model="form.storePassword"
                :type="isPasswordVisible ? 'text' : 'password'"
                class="form-control mono-input"
                placeholder="请输入至少 6 位安全密码"
              />
              <button
                type="button"
                class="btn-toggle-eye"
                @click="isPasswordVisible = !isPasswordVisible"
              >
                {{ isPasswordVisible ? '👁️' : '🙈' }}
              </button>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">
              <span>证书有效期 (年)</span>
              <span class="label-tip">建议长期有效</span>
            </label>
            <input
              v-model.number="form.validityYears"
              type="number"
              min="1"
              max="150"
              class="form-control mono-input"
              placeholder="100"
            />
          </div>

          <div class="form-group">
            <label class="form-label">
              <span>密钥算法</span>
              <span class="label-tip">应用市场统一标准</span>
            </label>
            <input
              type="text"
              class="form-control mono-input"
              value="RSA 2048 位"
              disabled
            />
          </div>
        </div>

        <!-- 折叠高级项 -->
        <div class="advanced-section">
          <button
            type="button"
            class="advanced-toggle"
            @click="isShowAdvanced = !isShowAdvanced"
          >
            <span>{{ isShowAdvanced ? '▼' : '▶' }} 证书组织与签发者信息 (DName)</span>
          </button>
          <div v-show="isShowAdvanced" class="advanced-content">
            <input
              v-model.trim="form.dname"
              type="text"
              class="form-control mono-input"
              placeholder="CN=Android App, OU=Dev, O=Organization, C=CN"
            />
            <div class="advanced-tip">标准 X.500 格式，用于应用商店与系统底层标识发行者组织</div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" :disabled="isGenerating" @click="handleClose">
          取消
        </button>
        <button
          class="btn btn-primary"
          :disabled="!canSubmit || isGenerating"
          @click="handleSubmit"
        >
          <span v-if="isGenerating" class="spinner"></span>
          <span>⚡ {{ isGenerating ? '生成中...' : '立即生成并应用' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  defaultAlias: {
    type: String,
    default: 'release'
  },
  defaultFileName: {
    type: String,
    default: 'release.keystore'
  },
  isGenerating: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'submit'])

const isPasswordVisible = ref(false)
const isShowAdvanced = ref(false)

const form = reactive({
  fileName: 'release.keystore',
  keyAlias: 'release',
  storePassword: '',
  validityYears: 100,
  dname: 'CN=Android App, OU=Dev, O=Organization, C=CN'
})

watch(
  () => props.isOpen,
  (val) => {
    if (val) {
      form.fileName = props.defaultFileName || 'release.keystore'
      form.keyAlias = props.defaultAlias || 'release'
      if (!form.storePassword) {
        generateRandomPassword()
      }
    }
  }
)

const canSubmit = computed(() => {
  return (
    form.fileName?.trim() &&
    form.keyAlias?.trim() &&
    form.storePassword?.trim()?.length >= 6 &&
    form.validityYears > 0
  )
})

function generateRandomPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789#@!'
  let result = ''
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  form.storePassword = result
  isPasswordVisible.value = true
}

function handleClose() {
  if (!props.isGenerating) {
    emit('close')
  }
}

function handleSubmit() {
  if (!canSubmit.value || props.isGenerating) return
  emit('submit', {
    fileName: form.fileName.trim(),
    keyAlias: form.keyAlias.trim(),
    storePassword: form.storePassword.trim(),
    validityYears: form.validityYears,
    dname: form.dname.trim()
  })
}
</script>

<style lang="scss" scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

.modal-container {
  width: 90%;
  max-width: 520px;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 12px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: slideUp 0.25s ease;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid var(--card-border);

  .modal-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 600;
    color: var(--text-bright);

    .modal-icon {
      font-size: 16px;
    }
  }

  .btn-close {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 16px;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;

    &:hover {
      color: var(--text-bright);
      background: rgba(255, 255, 255, 0.08);
    }
  }
}

.modal-body {
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.notice-banner {
  background: rgba(88, 166, 255, 0.08);
  border: 1px solid rgba(88, 166, 255, 0.25);
  border-radius: 8px;
  padding: 10px 12px;

  .notice-text {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    line-height: 1.5;
    color: var(--text);

    code {
      background: rgba(88, 166, 255, 0.15);
      color: #58a6ff;
      padding: 1px 4px;
      border-radius: 3px;
    }
  }
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;

  .form-col-full {
    grid-column: span 2;
  }
}

.form-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-bright);
  margin-bottom: 6px;

  .label-tip {
    font-size: 11px;
    color: var(--text-muted);
    font-weight: normal;
  }
}

.password-label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;

  .btn-text {
    background: none;
    border: none;
    color: #58a6ff;
    font-size: 11px;
    cursor: pointer;
    padding: 0 4px;

    &:hover {
      text-decoration: underline;
    }
  }
}

.password-input-wrap {
  position: relative;
  display: flex;
  align-items: center;

  .form-control {
    padding-right: 36px;
  }

  .btn-toggle-eye {
    position: absolute;
    right: 8px;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 14px;
    opacity: 0.7;

    &:hover {
      opacity: 1;
    }
  }
}

.advanced-section {
  border-top: 1px dashed var(--card-border);
  padding-top: 10px;

  .advanced-toggle {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 12px;
    cursor: pointer;
    padding: 0;

    &:hover {
      color: var(--text-bright);
    }
  }

  .advanced-content {
    margin-top: 8px;

    .advanced-tip {
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 4px;
    }
  }
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 18px;
  border-top: 1px solid var(--card-border);
  background: rgba(0, 0, 0, 0.15);

  .btn {
    font-size: 13px;
    padding: 6px 16px;
  }
}

.mono-input {
  font-family: Consolas, monospace;
  font-size: 12px;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
