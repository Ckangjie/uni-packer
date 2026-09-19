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
            <span>☕ JDK 17 安装与环境变量配置指南</span>
          </span>
        </summary>
        <div class="guide-content">
          <div class="guide-sub-heading">📥 推荐下载通道（需 64 位 JDK 17）</div>
          <div class="guide-action-row">
            <button
              class="btn btn-secondary btn-sm"
              @click="handleOpenUrl('https://adoptium.net/temurin/releases/?version=17')"
            >
              🌐 Adoptium JDK 17 官方下载网页 ↗
            </button>
            <button
              class="btn btn-secondary btn-sm"
              @click="handleOpenUrl('https://mirrors.huaweicloud.com/adoptium/temurin17-binaries/')"
            >
              ⚡ 华为云国内镜像下载网页 ↗
            </button>
          </div>

          <div class="guide-tip-banner">
            💡 <b>零门槛技巧</b>：运行 <code>.msi</code> 安装包时，在「Custom Setup」步骤将 <b>「Set JAVA_HOME variable」</b> 和 <b>「Add to PATH」</b> 改为「Will be installed on local hard drive」，安装程序会自动为你配置好所有环境变量，无需手动设置！
          </div>

          <div class="guide-sub-heading" style="margin-top: 12px;">🛠️ 手动配置系统环境变量（如使用压缩包免安装版）</div>
          • <b>步骤 ① 设置 JAVA_HOME</b>：<br />
          &nbsp;&nbsp;按 <kbd>Win + S</kbd> 搜索「编辑系统环境变量」→ 点击【环境变量】→ 在【系统变量】区点击【新建】：<br />
          &nbsp;&nbsp;变量名：<code>JAVA_HOME</code><br />
          &nbsp;&nbsp;变量值：<code>D:\Program Files\Eclipse Adoptium\jdk-17.0.10.7-hotspot</code>（填你的实际 JDK 根目录）<br />
          • <b>步骤 ② 配置 Path</b>：<br />
          &nbsp;&nbsp;在【系统变量】列表中双击 <code>Path</code> → 点击【新建】→ 填入 <code>%JAVA_HOME%\bin</code> → 点击【上移】按钮移至前列（防止被旧版 Java 优先拦截）。<br />
          • <b>步骤 ③ 验证就绪</b>：打开 CMD 或 PowerShell 终端，输入下方命令验证（点击可复制）：
          <div class="guide-code-box" @click="handleCopy('java -version')">
            java -version 📋
          </div>
          显示 <code>openjdk version "17.x.x"</code> 即表示配置成功！返回本工作台点击【底层环境检测】即可自动识别。

          <div class="guide-sub-heading" style="margin-top: 12px;">📱 其他配套运行环境规范</div>
          • <b>Android SDK</b>：需包含 Platform 33+ 与 Build-Tools 33.0.2+（可直接在环境检测页一键补全）；<br />
          • <b>宿主壳工程</b>：协同 <code>uniapp-minimal-shell</code>，内置国内 Gradle 8.7 Wrapper；<br />
          • <b>前端资源</b>：支持 CLI 命令行编译（<code>build:app-plus</code> / <code>build:app</code> 等），或直接复用 HBuilderX 本地打包导出的离线资源。
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
import { openUrlApi } from '@/api/workbench.js'

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

function handleOpenUrl(url) {
  openUrlApi(url)
}

function expandJdkGuide() {
  guideStates.value[0] = true
}

defineExpose({
  expandJdkGuide
})
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

      .guide-sub-heading {
        font-size: 12.5px;
        font-weight: 600;
        color: var(--text-bright);
        margin: 6px 0 4px 0;
      }

      .guide-action-row {
        display: flex;
        gap: 8px;
        margin: 6px 0 10px 0;
        flex-wrap: wrap;

        .btn {
          font-size: 12px;
          padding: 4px 10px;
        }
      }

      .guide-tip-banner {
        background: rgba(88, 166, 255, 0.08);
        border: 1px solid rgba(88, 166, 255, 0.25);
        border-radius: 6px;
        padding: 8px 12px;
        font-size: 12px;
        line-height: 1.5;
        margin: 6px 0 10px 0;
        color: var(--text);

        code {
          background: rgba(88, 166, 255, 0.15);
          color: #58a6ff;
          padding: 1px 4px;
          border-radius: 3px;
        }
      }

      kbd {
        background: #21262d;
        border: 1px solid var(--card-border);
        border-radius: 3px;
        padding: 1px 5px;
        font-size: 11px;
        color: var(--text-bright);
        font-family: inherit;
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
