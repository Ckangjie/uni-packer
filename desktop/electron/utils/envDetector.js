const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const IS_WIN = process.platform === 'win32';

/**
 * 安全执行命令并返回标准输出内容
 */
function safeExec(cmd, options = {}) {
  try {
    const finalCmd = `${cmd} 2>&1`;
    return execSync(finalCmd, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
      ...options,
    }).trim();
  } catch (e) {
    if (e.stdout) return e.stdout.toString().trim();
    if (e.stderr) return e.stderr.toString().trim();
    return '';
  }
}

function cleanPath(p) {
  if (!p || typeof p !== 'string') return '';
  return p.trim().replace(/^["']|["']$/g, '').replace(/[/\\]+$/, '');
}

/**
 * 自动检测系统中的 JDK 路径与版本
 */
function detectJdk() {
  const candidates = [];

  // 1. 环境变量优先级最高
  const envJava = cleanPath(process.env.JAVA_HOME);
  if (envJava && fs.existsSync(envJava)) {
    candidates.push(envJava);
  }
  const envJdk = cleanPath(process.env.JDK_HOME);
  if (envJdk && fs.existsSync(envJdk)) {
    candidates.push(envJdk);
  }

  // 2. 通过系统 PATH 探测 javac / java
  const queryCmd = IS_WIN ? 'where.exe' : 'which';
  const javacOut = safeExec(`${queryCmd} javac`);
  if (javacOut) {
    const lines = javacOut.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    for (const binPath of lines) {
      if (fs.existsSync(binPath)) {
        try {
          const realBin = fs.realpathSync(binPath);
          const rootDir = path.dirname(path.dirname(realBin));
          if (!candidates.includes(rootDir)) candidates.push(rootDir);
        } catch (e) {}
      }
    }
  }

  const javaOut = safeExec(`${queryCmd} java`);
  if (javaOut) {
    const lines = javaOut.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    for (const binPath of lines) {
      if (fs.existsSync(binPath)) {
        try {
          const realBin = fs.realpathSync(binPath);
          const rootDir = path.dirname(path.dirname(realBin));
          if (!candidates.includes(rootDir)) candidates.push(rootDir);
        } catch (e) {}
      }
    }
  }

  // 3. 常见系统安装目录扫描
  const searchRoots = [];
  if (IS_WIN) {
    const localAppData = process.env['LOCALAPPDATA'] || '';
    const drives = ['C', 'D', 'E', 'F'];
    for (const d of drives) {
      searchRoots.push(`${d}:\\soft\\HBuilderX\\plugins\\amazon-corretto`);
      searchRoots.push(`${d}:\\HBuilderX\\plugins\\amazon-corretto`);
      searchRoots.push(`${d}:\\Program Files\\Eclipse Adoptium`);
      searchRoots.push(`${d}:\\Program Files\\Java`);
      searchRoots.push(`${d}:\\Program Files\\Microsoft`);
      searchRoots.push(`${d}:\\Program Files\\BellSoft`);
      searchRoots.push(`${d}:\\Program Files\\Zulu`);
      searchRoots.push(`${d}:\\Program Files\\Android\\Android Studio\\jbr`);
      searchRoots.push(`${d}:\\Program Files\\Android\\Android Studio\\jre`);
    }
    if (localAppData) {
      searchRoots.push(path.join(localAppData, 'Programs\\Eclipse Adoptium'));
      searchRoots.push(path.join(localAppData, 'Android\\Android Studio\\jbr'));
      searchRoots.push(path.join(localAppData, 'Programs\\HBuilderX\\plugins\\amazon-corretto'));
    }
  } else {
    searchRoots.push(
      '/Library/Java/JavaVirtualMachines',
      '/usr/lib/jvm',
      '/usr/local/opt/openjdk'
    );
  }

  for (const root of searchRoots) {
    if (fs.existsSync(root)) {
      try {
        const stat = fs.statSync(root);
        if (stat.isDirectory()) {
          const directBin = path.join(root, IS_WIN ? 'bin/java.exe' : 'bin/java');
          if (fs.existsSync(directBin) && !candidates.includes(root)) {
            candidates.push(root);
          } else {
            const subItems = fs.readdirSync(root);
            for (const sub of subItems) {
              const fullSub = path.join(root, sub);
              try {
                if (fs.statSync(fullSub).isDirectory()) {
                  const subBin = path.join(fullSub, IS_WIN ? 'bin/java.exe' : 'bin/java');
                  if (fs.existsSync(subBin) && !candidates.includes(fullSub)) {
                    candidates.push(fullSub);
                  }
                }
              } catch (e) {}
            }
          }
        }
      } catch (e) {}
    }
  }

  // 4. 校验有效性并提取版本信息
  let bestJdk = null;
  for (const cPath of candidates) {
    const javaExe = path.join(cPath, IS_WIN ? 'bin/java.exe' : 'bin/java');
    if (fs.existsSync(javaExe)) {
      const verOutput = safeExec(`"${javaExe}" -version`);
      const verMatch = verOutput.match(/version\s*"(.*?)"/i) || verOutput.match(/(?:openjdk|java)\s*([0-9._]+)/i);
      const version = verMatch ? verMatch[1] : '';

      const keytoolExe = path.join(cPath, IS_WIN ? 'bin/keytool.exe' : 'bin/keytool');
      const hasKeytool = fs.existsSync(keytoolExe);

      const jdkInfo = {
        ok: true,
        path: path.normalize(cPath),
        version: version || '未知版本',
        keytoolPath: hasKeytool ? path.normalize(keytoolExe) : 'keytool',
        isJdk17: version.startsWith('17'),
      };

      if (jdkInfo.isJdk17) {
        return jdkInfo;
      }
      if (!bestJdk) {
        bestJdk = jdkInfo;
      }
    }
  }

  if (bestJdk) return bestJdk;

  return {
    ok: false,
    path: '',
    version: '',
    keytoolPath: 'keytool',
    error: '未检测到可用 JDK。请配置 JAVA_HOME 或安装 JDK 17',
  };
}

/**
 * 自动检测 Android SDK 路径
 */
function detectAndroidSdk(shellDir = '') {
  const candidates = [];

  const envSdk = cleanPath(process.env.ANDROID_HOME);
  if (envSdk && fs.existsSync(envSdk)) {
    candidates.push(envSdk);
  }
  const envSdkRoot = cleanPath(process.env.ANDROID_SDK_ROOT);
  if (envSdkRoot && fs.existsSync(envSdkRoot)) {
    candidates.push(envSdkRoot);
  }

  if (shellDir && fs.existsSync(shellDir)) {
    const lpPath = path.join(shellDir, 'local.properties');
    if (fs.existsSync(lpPath)) {
      try {
        const content = fs.readFileSync(lpPath, 'utf8');
        const match = content.match(/sdk\.dir\s*=\s*(.+)/);
        if (match) {
          const rawPath = match[1].trim().replace(/\\\\/g, '\\').replace(/\\:/g, ':');
          if (fs.existsSync(rawPath)) {
            candidates.push(rawPath);
          }
        }
      } catch (e) {}
    }
  }

  if (IS_WIN) {
    const localAppData = process.env['LOCALAPPDATA'] || '';
    const userProfile = process.env['USERPROFILE'] || '';
    if (localAppData) candidates.push(path.join(localAppData, 'Android\\Sdk'));
    if (userProfile) candidates.push(path.join(userProfile, 'AppData\\Local\\Android\\Sdk'));

    const drives = ['D', 'C', 'E', 'F'];
    for (const d of drives) {
      candidates.push(`${d}:\\Android\\Sdk`);
      candidates.push(`${d}:\\Android\\sdk`);
      candidates.push(`${d}:\\Program Files (x86)\\Android\\android-sdk`);
      candidates.push(`${d}:\\Program Files\\Android\\android-sdk`);
    }
  } else {
    const home = process.env.HOME || '';
    if (home) {
      candidates.push(path.join(home, 'Library/Android/sdk'));
      candidates.push(path.join(home, 'Android/Sdk'));
    }
  }

  for (const cPath of candidates) {
    if (fs.existsSync(cPath)) {
      const hasTools =
        fs.existsSync(path.join(cPath, 'platform-tools')) ||
        fs.existsSync(path.join(cPath, 'build-tools')) ||
        fs.existsSync(path.join(cPath, 'platforms'));
      if (hasTools) {
        return {
          ok: true,
          path: path.normalize(cPath),
        };
      }
    }
  }

  return {
    ok: false,
    path: '',
    error: '未检测到 Android SDK。请配置 ANDROID_HOME 或在 Android Studio 中安装',
  };
}

/**
 * 自动检测 Android 壳工程路径
 */
function detectShellDir(workbenchDir = process.cwd()) {
  const candidates = [];

  const envShell = cleanPath(process.env.ANDROID_SHELL_DIR);
  if (envShell && fs.existsSync(envShell)) {
    candidates.push(envShell);
  }

  const cfgPath = path.join(workbenchDir, '.shellrc.json');
  if (fs.existsSync(cfgPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      if (cfg.shellDir && fs.existsSync(cfg.shellDir)) {
        candidates.push(cfg.shellDir);
      }
    } catch (e) {}
  }

  candidates.push(path.resolve(workbenchDir, '../uniapp-minimal-shell'));
  candidates.push(path.resolve(workbenchDir, '../../uniapp-minimal-shell'));
  candidates.push(path.resolve(workbenchDir, '../android-shell/uniapp-minimal-shell'));
  candidates.push(path.resolve(workbenchDir, './android-shell/uniapp-minimal-shell'));
  candidates.push(path.resolve(workbenchDir, './uniapp-minimal-shell'));

  const drives = ['D', 'C', 'E'];
  for (const d of drives) {
    candidates.push(`${d}:/android-shell/uniapp-minimal-shell`);
  }
  const userProfile = process.env['USERPROFILE'] || process.env.HOME || '';
  if (userProfile) {
    candidates.push(path.join(userProfile, 'android-shell/uniapp-minimal-shell'));
  }

  for (const cPath of candidates) {
    if (fs.existsSync(cPath)) {
      const hasApp = fs.existsSync(path.join(cPath, 'app'));
      const hasGradle =
        fs.existsSync(path.join(cPath, 'build.gradle')) ||
        fs.existsSync(path.join(cPath, 'settings.gradle'));
      if (hasApp && hasGradle) {
        return {
          ok: true,
          path: path.normalize(cPath),
        };
      }
    }
  }

  return {
    ok: false,
    path: path.normalize('D:/android-shell/uniapp-minimal-shell'),
    error: '未找到有效 Android 宿主壳工程目录',
  };
}

/**
 * 自动检测 Gradle 命令或 Gradlew Wrapper
 */
function detectGradle(shellDir = '') {
  if (shellDir && fs.existsSync(shellDir)) {
    const wrapperBat = path.join(shellDir, 'gradlew.bat');
    const wrapperSh = path.join(shellDir, 'gradlew');
    if (IS_WIN && fs.existsSync(wrapperBat)) {
      return { ok: true, path: path.normalize(wrapperBat), isWrapper: true };
    }
    if (!IS_WIN && fs.existsSync(wrapperSh)) {
      return { ok: true, path: path.normalize(wrapperSh), isWrapper: true };
    }
  }

  if (process.env.GRADLE_HOME) {
    const gradleBin = path.join(process.env.GRADLE_HOME, IS_WIN ? 'bin/gradle.bat' : 'bin/gradle');
    if (fs.existsSync(gradleBin)) {
      return { ok: true, path: path.normalize(gradleBin), isWrapper: false };
    }
  }

  const queryCmd = IS_WIN ? 'where.exe gradle' : 'which gradle';
  const sysGradle = safeExec(queryCmd);
  if (sysGradle) {
    const first = sysGradle.split(/\r?\n/)[0].trim();
    if (fs.existsSync(first)) {
      return { ok: true, path: path.normalize(first), isWrapper: false };
    }
  }

  return {
    ok: false,
    path: '',
    isWrapper: false,
    error: '未找到 Gradle。壳工程未包含 gradlew 且系统未安装 gradle',
  };
}

/**
 * 自动检测 DCloud 基座核心 AAR / JAR 依赖库
 */
function detectAar(shellDir = '') {
  if (!shellDir || !fs.existsSync(shellDir)) {
    return { ok: false, files: [], count: 0, path: '' };
  }

  const libsDir = path.join(shellDir, 'app/libs');
  if (!fs.existsSync(libsDir)) {
    return { ok: false, files: [], count: 0, path: libsDir };
  }

  try {
    const files = fs.readdirSync(libsDir).filter((f) => f.endsWith('.aar') || f.endsWith('.jar'));
    return {
      ok: files.length > 0,
      files,
      count: files.length,
      path: path.normalize(libsDir),
    };
  } catch (e) {
    return { ok: false, files: [], count: 0, path: libsDir };
  }
}

/**
 * 跨设备保障：自动将检测到的 Android SDK 路径同步写入壳工程 local.properties
 */
function syncLocalProperties(shellDir, sdkPath) {
  if (!shellDir || !fs.existsSync(shellDir) || !sdkPath || !fs.existsSync(sdkPath)) {
    return false;
  }
  const lpFile = path.join(shellDir, 'local.properties');
  const normalizedPath = sdkPath.replace(/\\/g, '/');
  const targetLine = `sdk.dir=${normalizedPath}`;

  try {
    let content = fs.existsSync(lpFile) ? fs.readFileSync(lpFile, 'utf8') : '';
    if (content.includes('sdk.dir=')) {
      content = content.replace(/sdk\.dir\s*=\s*.*/, targetLine);
    } else {
      content = (content ? content.trim() + '\n' : '') + targetLine + '\n';
    }
    fs.writeFileSync(lpFile, content, 'utf8');
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 统一执行环境全量探测
 */
function detectAllEnv(workbenchDir = process.cwd()) {
  const shell = detectShellDir(workbenchDir);
  const shellDir = shell.path;

  const jdk = detectJdk();
  const sdk = detectAndroidSdk(shellDir);
  const gradle = detectGradle(shellDir);
  const aar = detectAar(shellDir);

  if (shell.ok && sdk.ok) {
    syncLocalProperties(shellDir, sdk.path);
  }

  const overallOk = Boolean(jdk.ok && sdk.ok && shell.ok && gradle.ok);

  return {
    overallOk,
    jdk,
    sdk,
    shell,
    gradle,
    aar,
  };
}

module.exports = {
  detectJdk,
  detectAndroidSdk,
  detectShellDir,
  detectGradle,
  detectAar,
  syncLocalProperties,
  detectAllEnv,
};
