<template>
  <div class="card pack-guide-card">
    <div class="card-title">
      <span>📘 离线打包与环境指引</span>
      <div class="title-actions">
        <button class="btn btn-secondary btn-sm" @click="toggleAllGuides">
          {{ isAllExpanded ? '一键折叠' : '一键展开' }}
        </button>
        <span class="badge badge-ok">新手指南</span>
      </div>
    </div>

    <div class="guide-list">
      <details class="guide-item" :open="guideStates[0]">
        <summary @click.prevent="toggleGuide(0)">
          <span class="summary-label">
            <span class="step-num">1</span>
            <span>🛠️ 底层运行环境要求</span>
          </span>
        </summary>
        <div class="guide-content">
          • <b>JDK 运行环境</b>：建议安装 JDK 17 (64位)。配置系统环境变量 <code>JAVA_HOME</code> 指向 JDK 安装目录。<br />
          • <b>Android SDK</b>：需包含 Platform 33+ 与 Build-Tools 33.0.2+。配置 <code>ANDROID_HOME</code> 并将 <code>platform-tools</code> 加入 <code>Path</code>。<br />
          • <b>宿主壳工程</b>：工作台协同 <code>uniapp-minimal-shell</code> 壳工程，首次打包将调用 Gradle Wrapper。<br />
          • <b>Node.js</b>：Node 18+ 环境，支持前端项目的 <code>build:app-plus</code>。
        </div>
      </details>

      <details class="guide-item" :open="guideStates[1]">
        <summary @click.prevent="toggleGuide(1)">
          <span class="summary-label">
            <span class="step-num">2</span>
            <span>🔑 生成自有签名证书 (.keystore)</span>
          </span>
        </summary>
        <div class="guide-content">
          • <b>命令行生成</b>：在终端执行下方命令（点击可复制）：
          <div
            class="guide-code-box"
            @click="handleCopy('keytool -genkey -v -keystore release.keystore -alias release -keyalg RSA -keysize 2048 -validity 36500')"
          >
            keytool -genkey -v -keystore release.keystore -alias release -keyalg RSA -keysize 2048 -validity 36500 📋
          </div>
          • <b>HBuilderX 可视化</b>：发行 → 原生 App-云打包 → 勾选 Android → 使用自有证书 → 生成证书。
        </div>
      </details>

      <details class="guide-item" :open="guideStates[2]">
        <summary @click.prevent="toggleGuide(2)">
          <span class="summary-label">
            <span class="step-num">3</span>
            <span>⚙️ 将证书配置至工作台</span>
          </span>
        </summary>
        <div class="guide-content">
          • 点击左侧【📁 浏览证书】选择 <code>.keystore</code> 或 <code>.jks</code> 文件；<br />
          • 填入证书密码、证书别名与别名密码；<br />
          • 点击【⚡ 校验证书】自动校验并实时提取 <b>SHA1 指纹</b>（点击指纹即可复制）。
        </div>
      </details>

      <details class="guide-item" :open="guideStates[3]">
        <summary @click.prevent="toggleGuide(3)">
          <span class="summary-label">
            <span class="step-num">4</span>
            <span>🌐 申请并绑定 DCloud 离线 AppKey</span>
          </span>
        </summary>
        <div class="guide-content">
          • 登录 DCloud 开发者中心，进入对应 AppID 的应用详情；<br />
          • 进入【各平台信息】→【Android 离线打包 Key】；<br />
          • 填入本项目提取的<b>应用包名</b>与<b>SHA1 指纹</b>；<br />
          • 复制获取到的 AppKey 并粘贴至左侧输入框保存。
        </div>
      </details>

      <details class="guide-item" :open="guideStates[4]">
        <summary @click.prevent="toggleGuide(4)">
          <span class="summary-label">
            <span class="step-num">5</span>
            <span>🧩 云端与原生插件离线支持</span>
          </span>
        </summary>
        <div class="guide-content">
          • <b>纯 JS / 前端组件库</b>（如 pinia、dayjs、uView、wot-design、uts 纯前端插件等）：<br />
          &nbsp;&nbsp;前端构建时已自动编译进静态资源（<code>www</code>），<b>直接支持离线打包，无需任何额外配置</b>。<br />
          • <b>原生 Native 插件</b>（包含 Android 原生 Java/Kotlin/AAR/SO 硬件库）：<br />
          &nbsp;&nbsp;① 下载作者提供的离线 SDK 包，将 <code>.aar</code> / <code>.jar</code> 放入宿主壳工程 <code>app/libs/</code>；<br />
          &nbsp;&nbsp;② 在壳工程 <code>app/src/main/assets/dcloud_uniplugins.json</code> 中登记该插件即可。
        </div>
      </details>

      <details class="guide-item" :open="guideStates[5]">
        <summary @click.prevent="toggleGuide(5)">
          <span class="summary-label">
            <span class="step-num step-num-warn">6</span>
            <span>⚠️ 核心避坑与排错指南</span>
          </span>
        </summary>
        <div class="guide-content guide-content-warn">
          • <b>AppKey 与证书必须一致</b>：DCloud 后台绑定的包名与 SHA1 必须与本地打包签名证书及应用包名 100% 逐字对应，否则 App 启动会提示 <i>AppKey 与证书或包名不一致</i>；<br />
          • <b>首次构建说明</b>：首次打包 Gradle Wrapper 会自动下载 Gradle 发行包与 Android 依赖构件，耗时受网速影响；后续再次打包均走本地增量缓存，可在几秒内完成。
        </div>
      </details>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const emit = defineEmits(['copy'])

const guideStates = ref([true, false, false, false, false, false])

const isAllExpanded = computed(() => {
  return guideStates.value.every((state) => state === true)
})

function toggleGuide(index) {
  guideStates.value[index] = !guideStates.value[index]
}

function toggleAllGuides() {
  const targetState = !isAllExpanded.value
  guideStates.value = guideStates.value.map(() => targetState)
}

function handleCopy(text) {
  if (text) {
    emit('copy', text)
  }
}
</script>

<style lang="scss" scoped>
.pack-guide-card {
  .title-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .btn-sm {
    font-size: 11px;
    padding: 2px 8px;
    height: 24px;
  }

  .guide-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .guide-item {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 10px 12px;
    transition: all 0.2s ease;

    &:hover {
      border-color: rgba(255, 255, 255, 0.12);
    }

    summary {
      cursor: pointer;
      font-weight: 600;
      color: var(--text-bright);
      display: flex;
      align-items: center;
      justify-content: space-between;
      list-style: none;
      font-size: 12.5px;

      &::-webkit-details-marker {
        display: none;
      }

      &::after {
        content: "▾";
        font-size: 12px;
        color: var(--text-muted);
        transition: transform 0.2s ease;
      }
    }

    &[open] summary::after {
      transform: rotate(180deg);
    }

    .summary-label {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .step-num {
      background: #1f6feb;
      color: #fff;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: bold;
    }

    .step-num-warn {
      background: #d29922 !important;
    }

    .guide-content {
      margin-top: 8px;
      font-size: 12px;
      line-height: 1.65;
      color: var(--text-muted);
      border-top: 1px dashed rgba(255, 255, 255, 0.06);
      padding-top: 8px;

      &.guide-content-warn {
        color: #e3b341;
      }

      code {
        background: rgba(0, 0, 0, 0.35);
        padding: 2px 4px;
        border-radius: 4px;
        color: #7ee787;
        font-family: monospace;
      }
    }

    .guide-code-box {
      background: rgba(0, 0, 0, 0.45);
      padding: 6px 10px;
      border-radius: 6px;
      font-family: monospace;
      color: #7ee787;
      margin: 6px 0;
      border: 1px solid rgba(255, 255, 255, 0.08);
      cursor: pointer;
      font-size: 11px;
      word-break: break-all;
      user-select: text;

      &:hover {
        background: rgba(0, 0, 0, 0.6);
      }
    }
  }
}
</style>
