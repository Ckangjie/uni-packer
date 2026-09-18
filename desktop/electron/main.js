const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const crypto = require('crypto');
const {
  detectAllEnv,
  detectJdk,
  detectShellDir,
  syncLocalProperties,
} = require('./utils/envDetector');
const { findObjectRange, parseManifestJson } = require('./utils/manifestParser');

// 获取外部真实工作区目录（严禁指向 asar 内部，保障配置/历史/备份持久化在物理磁盘）
function getWorkspaceDir() {
  if (process.env.PORTABLE_EXECUTABLE_DIR && fs.existsSync(process.env.PORTABLE_EXECUTABLE_DIR)) {
    return process.env.PORTABLE_EXECUTABLE_DIR;
  }
  if (app.isPackaged) {
    return path.dirname(process.execPath);
  }
  return path.resolve(__dirname, '../..');
}

const WORKSPACE_DIR = getWorkspaceDir();

// 统一配置与备份目录定位（位于工作区根目录 config/）
let CONFIG_DIR = path.join(WORKSPACE_DIR, 'config');
if (!fs.existsSync(CONFIG_DIR)) {
  try {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  } catch (e) {
    CONFIG_DIR = path.join(app.getPath('userData'), 'config');
    if (!fs.existsSync(CONFIG_DIR)) {
      try { fs.mkdirSync(CONFIG_DIR, { recursive: true }); } catch (err) {}
    }
  }
}

const BACKUP_DIR = path.join(WORKSPACE_DIR, 'backups');
const HISTORY_FILE = path.join(WORKSPACE_DIR, 'last-project.json');
const SIGNING_CONFIG_FILE = path.join(CONFIG_DIR, 'signing-config.json');
const PACK_CONFIG_FILE = path.join(CONFIG_DIR, 'pack-config.json');

let SHELL_DIR = detectShellDir(WORKSPACE_DIR).path;
let activeProjectDir = '';

// 初始化恢复历史工程
if (fs.existsSync(HISTORY_FILE)) {
  try {
    const h = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    if (h.lastProjectDir && fs.existsSync(h.lastProjectDir)) {
      activeProjectDir = h.lastProjectDir;
    }
  } catch (e) {}
}

function recordProjectDir(dir) {
  try {
    if (dir && fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
      activeProjectDir = dir;
      fs.writeFileSync(HISTORY_FILE, JSON.stringify({ lastProjectDir: dir }, null, 2), 'utf8');
    }
  } catch (e) {}
}

function resolveTargetDir(dir) {
  const tryDir = (d) => {
    if (!d || typeof d !== 'string') return null;
    const clean = d.trim().replace(/^["']|["']$/g, '');
    if (!clean) return null;
    const p = path.resolve(clean);
    try {
      if (fs.existsSync(p) && fs.statSync(p).isDirectory()) return p;
    } catch (e) {}
    return null;
  };
  return tryDir(dir) || tryDir(activeProjectDir);
}

function backupFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return '';
    const dayDir = path.join(BACKUP_DIR, new Date().toISOString().slice(0, 10));
    if (!fs.existsSync(dayDir)) fs.mkdirSync(dayDir, { recursive: true });
    const flat = path.resolve(filePath).replace(/[:\\/]+/g, '_').replace(/^_+/, '');
    const bak = path.join(dayDir, `${flat}.bak`);
    if (!fs.existsSync(bak)) fs.copyFileSync(filePath, bak);
    return bak;
  } catch (e) {
    return '';
  }
}

async function copyDirInto(targetDir, sourceDir) {
  if (fs.existsSync(targetDir)) {
    if (fs.promises.rm) await fs.promises.rm(targetDir, { recursive: true, force: true });
    else fs.rmSync(targetDir, { recursive: true, force: true });
  }
  await fs.promises.mkdir(targetDir, { recursive: true });
  if (fs.promises.cp) {
    await fs.promises.cp(sourceDir, targetDir, { recursive: true });
  } else {
    fs.cpSync(sourceDir, targetDir, { recursive: true });
  }
}

function escapeXml(value) {
  return String(value ?? '').replace(/[<>&'"]/g, (ch) => (
    { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[ch]
  ));
}

// ── 签名与配置处理 ──────────────────────────────────────────────────
function getPackConfig(targetDir) {
  if (targetDir) {
    const projectPackConfigFile = path.join(targetDir, 'config', 'pack-config.json');
    if (fs.existsSync(projectPackConfigFile)) {
      try {
        return JSON.parse(fs.readFileSync(projectPackConfigFile, 'utf8'));
      } catch (e) {}
    }
  }
  if (fs.existsSync(PACK_CONFIG_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(PACK_CONFIG_FILE, 'utf8'));
    } catch (e) {}
  }
  return null;
}

function savePackConfig(cfg, targetDir) {
  try {
    if (targetDir && (fs.existsSync(path.join(targetDir, 'config', 'pack-config.json')) || fs.existsSync(path.join(targetDir, 'config')))) {
      const projectConfigDir = path.join(targetDir, 'config');
      if (!fs.existsSync(projectConfigDir)) fs.mkdirSync(projectConfigDir, { recursive: true });
      fs.writeFileSync(path.join(projectConfigDir, 'pack-config.json'), JSON.stringify(cfg, null, 2), 'utf8');
      return;
    }
    if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(PACK_CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
  } catch (e) {}
}

function getSigningConfig(targetDir) {
  const defaultCfg = {
    storeFile: 'test.keystore',
    storePassword: '123456',
    keyAlias: 'test',
    keyPassword: '123456',
    isDefault: true,
  };
  const packCfg = getPackConfig(targetDir);
  if (packCfg && packCfg.signing) {
    return { ...defaultCfg, ...packCfg.signing };
  }
  if (fs.existsSync(SIGNING_CONFIG_FILE)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(SIGNING_CONFIG_FILE, 'utf8'));
      return { ...defaultCfg, ...cfg };
    } catch (e) {}
  }
  return defaultCfg;
}

function resolveKeystorePath(storeFileName, targetDir) {
  const cleanName = storeFileName ? path.basename(storeFileName) : 'test.keystore';
  const projectCertPath = targetDir ? path.join(targetDir, 'config', cleanName) : '';
  const configCertPath = path.join(CONFIG_DIR, cleanName);
  const shellCertPath = path.join(SHELL_DIR, 'app', cleanName);

  if (projectCertPath && fs.existsSync(projectCertPath)) {
    try {
      const shellAppDir = path.join(SHELL_DIR, 'app');
      if (fs.existsSync(shellAppDir)) fs.copyFileSync(projectCertPath, shellCertPath);
    } catch (e) {}
    return projectCertPath;
  }

  if (fs.existsSync(configCertPath)) {
    try {
      const shellAppDir = path.join(SHELL_DIR, 'app');
      if (fs.existsSync(shellAppDir)) fs.copyFileSync(configCertPath, shellCertPath);
    } catch (e) {}
    return configCertPath;
  }

  if (fs.existsSync(shellCertPath)) {
    try {
      if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
      fs.copyFileSync(shellCertPath, configCertPath);
    } catch (e) {}
    return shellCertPath;
  }

  if (storeFileName && path.isAbsolute(storeFileName) && fs.existsSync(storeFileName)) {
    return storeFileName;
  }

  return shellCertPath;
}

const KEYTOOL_CACHE = new Map();
const KEYTOOL_CACHE_TTL = 30 * 1000;
const KEYTOOL_TIMEOUT = 15 * 1000;

function keytoolCacheKey(filePath, password) {
  try {
    const st = fs.statSync(filePath);
    const pwHash = crypto.createHash('sha1').update(String(password ?? '')).digest('hex').slice(0, 16);
    return `${filePath}|${st.size}|${st.mtimeMs}|${pwHash}`;
  } catch (e) {
    return '';
  }
}

function extractSha1(storeFilePath, storePassword, options = {}) {
  try {
    if (!fs.existsSync(storeFilePath)) {
      return { ok: false, error: '证书文件不存在: ' + path.basename(storeFilePath), sha1: '' };
    }

    const cacheKey = options.noCache ? '' : keytoolCacheKey(storeFilePath, storePassword);
    if (cacheKey) {
      const hit = KEYTOOL_CACHE.get(cacheKey);
      if (hit && (Date.now() - hit.at) < KEYTOOL_CACHE_TTL) {
        return hit.value;
      }
    }

    const jdk = options.jdk || detectJdk();
    const keytoolCmd = jdk.keytoolPath ? `"${jdk.keytoolPath}"` : 'keytool';
    const certInfo = execSync(`${keytoolCmd} -list -v -keystore "${storeFilePath}" -storepass "${storePassword}"`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: KEYTOOL_TIMEOUT,
      maxBuffer: 8 * 1024 * 1024,
    });
    const sha1Match = certInfo.match(/SHA1:\s*([A-F0-9:]+)/i);
    const aliasMatch = certInfo.match(/(?:Alias name|别名名称|别名):\s*([^\r\n]+)/i);
    const value = {
      ok: true,
      sha1: sha1Match ? sha1Match[1].trim() : '',
      alias: aliasMatch ? aliasMatch[1].trim() : '',
      error: ''
    };

    if (cacheKey) {
      if (KEYTOOL_CACHE.size > 20) KEYTOOL_CACHE.clear();
      KEYTOOL_CACHE.set(cacheKey, { at: Date.now(), value });
    }
    return value;
  } catch (err) {
    if (err && (err.killed || err.signal === 'SIGTERM' || err.code === 'ETIMEDOUT')) {
      return { ok: false, error: `证书读取超时（超过 ${KEYTOOL_TIMEOUT / 1000} 秒）`, sha1: '', alias: '' };
    }
    const msg = err.stderr ? err.stderr.toString() : err.message;
    return { ok: false, error: msg.includes('password') ? '密码错误或证书无法读取' : '证书格式错误或密码不匹配', sha1: '', alias: '' };
  }
}

const SECRETS_FILE = path.join(CONFIG_DIR, 'cert-secrets.json');

function getSavedPasswords() {
  try {
    if (fs.existsSync(SECRETS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf8'));
      if (Array.isArray(data)) return data;
    }
  } catch (e) {}
  return [];
}

function saveKnownPassword(password) {
  if (!password || typeof password !== 'string') return;
  const pw = password.trim();
  if (!pw) return;
  try {
    const list = getSavedPasswords();
    if (!list.includes(pw)) {
      list.unshift(pw);
      if (list.length > 50) list.length = 50;
      if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
      fs.writeFileSync(SECRETS_FILE, JSON.stringify(list, null, 2), 'utf8');
    }
  } catch (e) {}
}

function probeKeystore(storeFilePath, extraCandidates = []) {
  if (!fs.existsSync(storeFilePath)) {
    return { ok: false, error: '证书文件不存在: ' + path.basename(storeFilePath) };
  }

  const baseName = path.basename(storeFilePath, path.extname(storeFilePath));
  const savedPws = getSavedPasswords();
  const defaultPws = ['123456', 'android', '12345678', '123456789', 'admin', 'password', 'test', 'release'];

  const candidatePool = Array.from(new Set([
    ...extraCandidates.filter(Boolean),
    ...savedPws,
    ...defaultPws,
    baseName,
    ''
  ]));

  const jdk = detectJdk();
  const keytoolCmd = jdk.keytoolPath ? `"${jdk.keytoolPath}"` : 'keytool';

  for (const pw of candidatePool) {
    try {
      const certInfo = execSync(`${keytoolCmd} -list -v -keystore "${storeFilePath}" -storepass "${pw}"`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 4000,
        maxBuffer: 4 * 1024 * 1024,
      });

      const sha1Match = certInfo.match(/SHA1:\s*([A-F0-9:]+)/i);
      const aliasMatch = certInfo.match(/(?:Alias name|别名名称|别名):\s*([^\r\n]+)/i);

      if (sha1Match || aliasMatch) {
        const sha1 = sha1Match ? sha1Match[1].trim() : '';
        const keyAlias = aliasMatch ? aliasMatch[1].trim() : 'test';
        if (pw) saveKnownPassword(pw);
        return {
          ok: true,
          storePassword: pw,
          keyAlias,
          keyPassword: pw,
          sha1,
        };
      }
    } catch (err) {
      continue;
    }
  }

  return { ok: false, needPassword: true, error: '未能自动探测出密码' };
}

function updateGradleSigning(signingCfg) {
  const buildGradlePath = path.join(SHELL_DIR, 'app/build.gradle');
  if (!fs.existsSync(buildGradlePath)) return;
  let content = fs.readFileSync(buildGradlePath, 'utf8');

  const normalizedStoreFile = signingCfg.storeFile.replace(/\\/g, '/');
  const newSigningBlock = `signingConfigs {
        debug {
            storeFile file('${normalizedStoreFile}')
            storePassword '${signingCfg.storePassword}'
            keyAlias '${signingCfg.keyAlias}'
            keyPassword '${signingCfg.keyPassword}'
        }
    }`;

  content = content.replace(/signingConfigs\s*\{[\s\S]*?\}\s*(?=\r?\n\s*buildTypes)/m, () => newSigningBlock);
  fs.writeFileSync(buildGradlePath, content, 'utf8');
}

// ── 工程辅助解析 ────────────────────────────────────────────────────
function findManifestPath(projectDir) {
  if (!projectDir) return null;
  const resolved = path.resolve(projectDir);
  if (!fs.existsSync(resolved)) return null;

  const cliManifest = path.join(resolved, 'src/manifest.json');
  if (fs.existsSync(cliManifest)) return cliManifest;

  const hxManifest = path.join(resolved, 'manifest.json');
  if (fs.existsSync(hxManifest)) return hxManifest;

  const candidateSubDirs = ['apps', 'packages', 'client', 'app'];
  for (const sub of candidateSubDirs) {
    const subDirPath = path.join(resolved, sub);
    if (fs.existsSync(subDirPath) && fs.statSync(subDirPath).isDirectory()) {
      try {
        const subEntries = fs.readdirSync(subDirPath, { withFileTypes: true });
        for (const entry of subEntries) {
          if (entry.isDirectory()) {
            const p1 = path.join(subDirPath, entry.name, 'src/manifest.json');
            if (fs.existsSync(p1)) return p1;
            const p2 = path.join(subDirPath, entry.name, 'manifest.json');
            if (fs.existsSync(p2)) return p2;
          }
        }
      } catch (e) {}
    }
  }

  return cliManifest;
}

function detectShellPackageName() {
  if (!SHELL_DIR) return '';
  const gradlePath = path.join(SHELL_DIR, 'app/build.gradle');
  if (fs.existsSync(gradlePath)) {
    try {
      const content = fs.readFileSync(gradlePath, 'utf8');
      const appIdMatch = content.match(/applicationId\s+["']([^"']+)["']/);
      if (appIdMatch && appIdMatch[1]) return appIdMatch[1];
      const namespaceMatch = content.match(/namespace\s+["']([^"']+)["']/);
      if (namespaceMatch && namespaceMatch[1]) return namespaceMatch[1];
    } catch (e) {}
  }
  const manifestXml = path.join(SHELL_DIR, 'app/src/main/AndroidManifest.xml');
  if (fs.existsSync(manifestXml)) {
    try {
      const xml = fs.readFileSync(manifestXml, 'utf8');
      const pkgMatch = xml.match(/package="([^"]+)"/);
      if (pkgMatch && pkgMatch[1]) return pkgMatch[1];
    } catch (e) {}
  }
  return '';
}

function findProjectIconPath(projectDir) {
  if (!projectDir) return null;
  const resolvedDir = path.resolve(projectDir);
  if (!fs.existsSync(resolvedDir)) return null;

  const manifestPath = findManifestPath(resolvedDir);
  if (manifestPath && fs.existsSync(manifestPath)) {
    const json = parseManifestJson(manifestPath);
    if (json) {
      const androidIcons = json?.['app-plus']?.distribute?.icons?.android;
      if (androidIcons && typeof androidIcons === 'object') {
        const iconDensities = ['xxxhdpi', 'xxhdpi', 'xhdpi', 'hdpi', 'mdpi', 'ldpi'];
        for (const density of iconDensities) {
          const iconRelPath = androidIcons?.[density];
          if (iconRelPath && typeof iconRelPath === 'string') {
            const cleanRel = iconRelPath.replace(/^[/\\]+/, '');
            const candidateFromRoot = path.join(resolvedDir, cleanRel);
            if (fs.existsSync(candidateFromRoot)) return candidateFromRoot;
            const candidateFromManifestDir = path.join(path.dirname(manifestPath), cleanRel);
            if (fs.existsSync(candidateFromManifestDir)) return candidateFromManifestDir;
          }
        }
      }
    }
  }

  const commonRelativePaths = [
    'src/static/logo.png',
    'static/logo.png',
    'src/static/icon.png',
    'static/icon.png',
    'unpackage/res/icons/144x144.png',
    'unpackage/res/icons/192x192.png',
    'unpackage/res/icons/96x96.png',
    'unpackage/res/icons/72x72.png',
    'src/static/logo.jpg',
    'static/logo.jpg',
  ];

  for (const rel of commonRelativePaths) {
    const fullPath = path.join(resolvedDir, rel);
    if (fs.existsSync(fullPath)) return fullPath;
  }

  return null;
}

function applyFastSplashScreen(projectDir) {
  const manifestPath = findManifestPath(projectDir);
  if (!manifestPath || !fs.existsSync(manifestPath)) return false;
  try {
    const raw = fs.readFileSync(manifestPath, 'utf8');
    const splashBody = `{\n        "alwaysShowBeforeRender": false,\n        "waiting": false,\n        "autoclose": true,\n        "delay": 0\n    }`;

    let next = null;
    if (raw.includes('"splashscreen"')) {
      const range = findObjectRange(raw, 'splashscreen');
      if (range) next = raw.slice(0, range.start) + splashBody + raw.slice(range.end + 1);
    } else if (raw.includes('"app-plus"')) {
      const range = findObjectRange(raw, 'app-plus');
      if (range) {
        next = raw.slice(0, range.start + 1) + `\n    "splashscreen": ${splashBody},` + raw.slice(range.start + 1);
      }
    }

    if (next === null || next === raw) return true;
    backupFile(manifestPath);
    fs.writeFileSync(manifestPath, next, 'utf8');
    return true;
  } catch (e) {
    return false;
  }
}

function cleanStretchedSplash() {
  const splashFiles = [
    path.join(SHELL_DIR, 'app/src/main/res/drawable/splash.png'),
    path.join(SHELL_DIR, 'app/src/main/res/drawable-xxhdpi/splash.png'),
  ];
  for (const sf of splashFiles) {
    if (fs.existsSync(sf)) {
      try { fs.unlinkSync(sf); } catch (e) {}
    }
  }
}

function getBuildCommand(projectDir) {
  if (fs.existsSync(path.join(projectDir, 'pnpm-lock.yaml'))) {
    return { bin: 'pnpm.cmd', args: ['build:app-plus'] };
  }
  if (fs.existsSync(path.join(projectDir, 'yarn.lock'))) {
    return { bin: 'yarn.cmd', args: ['build:app-plus'] };
  }
  return { bin: 'npm.cmd', args: ['run', 'build:app-plus'] };
}

function findSourceDist(projectDir) {
  const candidates = [
    path.join(projectDir, 'dist/build/app-plus'),
    path.join(projectDir, 'dist/build/app'),
    path.join(projectDir, 'unpackage/dist/build/app-plus'),
    path.join(projectDir, 'unpackage/dist/build/app'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

// ── 构建互斥锁 ──────────────────────────────────────────────────────
let ACTIVE_BUILD = null;
const BUILD_MAX_MS = 60 * 60 * 1000;

function isBuildBusy() {
  if (!ACTIVE_BUILD) return false;
  if (Date.now() - ACTIVE_BUILD.startedAt > BUILD_MAX_MS) {
    ACTIVE_BUILD = null;
    return false;
  }
  return true;
}

// ── 打包流水线执行 ──────────────────────────────────────────────────
async function runBuildPipeline(sender, params) {
  const sendLog = (text, type = 'normal') => {
    try {
      sender.send('build-log', { text, type });
    } catch (e) {}
  };

  const targetDir = resolveTargetDir(params?.project_dir);
  if (!targetDir) {
    sendLog('❌ 未找到有效的 uni-app 项目目录\n', 'err');
    sender.send('build-done', { success: false, message: '无效的目标目录' });
    ACTIVE_BUILD = null;
    return;
  }
  recordProjectDir(targetDir);

  let appName = params?.app_name || 'uni-app应用';
  let version = '1.0.0';
  let appid = params?.app_id || '__UNI__CUSTOM';

  const manifestPath = findManifestPath(targetDir);
  if (fs.existsSync(manifestPath)) {
    const json = parseManifestJson(manifestPath);
    if (json?.name) appName = json.name.trim();
    if (json?.versionName) version = json.versionName.trim();
    if (json?.appid) appid = json.appid.trim();
  }

  let finalApkName = (params?.apk_name || '').trim();
  if (!finalApkName) {
    const rcPath = path.join(targetDir, 'scripts/.packrc.json');
    if (fs.existsSync(rcPath)) {
      try {
        const rc = JSON.parse(fs.readFileSync(rcPath, 'utf8'));
        if (rc.apkName) finalApkName = rc.apkName.trim();
      } catch (e) {}
    }
  }
  if (!finalApkName) finalApkName = `${appName}_v${version}.apk`;
  if (!finalApkName.toLowerCase().endsWith('.apk')) finalApkName += '.apk';

  sendLog('==================================================\n', 'info');
  sendLog(`🎯 目标工程目录: ${targetDir}\n`, 'info');
  sendLog(`📱 应用信息: ${appName} (v${version}, ${appid})\n`, 'info');
  sendLog('🚀 [Step 1/4] 开始构建前端 app-plus 离线资源...\n', 'info');
  sendLog('==================================================\n', 'info');

  const { bin, args } = getBuildCommand(targetDir);
  sendLog(`⚙️ 执行构建命令: ${bin} ${args.join(' ')}\n`);

  const buildProcess = spawn(bin, args, {
    cwd: targetDir,
    shell: true,
    env: { ...process.env },
  });

  buildProcess.stdout.on('data', (d) => sendLog(d.toString()));
  buildProcess.stderr.on('data', (d) => sendLog(d.toString(), 'err'));

  buildProcess.on('error', (e) => {
    sendLog(`\n❌ 无法启动前端构建命令 ${bin}: ${e.message}\n`, 'err');
    ACTIVE_BUILD = null;
    sender.send('build-done', { success: false, message: e.message });
  });

  buildProcess.on('close', async (code) => {
    if (code !== 0) {
      sendLog(`\n❌ 前端资源构建失败，退出码: ${code}\n`, 'err');
      ACTIVE_BUILD = null;
      sender.send('build-done', { success: false, message: `前端构建失败 (exit ${code})` });
      return;
    }

    sendLog('\n==================================================\n', 'info');
    sendLog('📂 [Step 2/4] 同步编译资源到 Android 壳工程...\n', 'info');
    sendLog('==================================================\n', 'info');

    const sourceDist = findSourceDist(targetDir);
    if (!fs.existsSync(sourceDist)) {
      sendLog(`\n❌ 未找到前端构建产出目录: ${sourceDist}\n`, 'err');
      ACTIVE_BUILD = null;
      sender.send('build-done', { success: false, message: '未找到前端产物目录' });
      return;
    }

    const targetAppDir = path.join(SHELL_DIR, `app/src/main/assets/apps/${appid}/www`);
    try {
      await copyDirInto(targetAppDir, sourceDist);
    } catch (e) {
      sendLog(`\n❌ 资源同步失败: ${e.message}\n`, 'err');
      ACTIVE_BUILD = null;
      sender.send('build-done', { success: false, message: e.message });
      return;
    }

    const controlXmlPath = path.join(SHELL_DIR, 'app/src/main/assets/data/dcloud_control.xml');
    fs.writeFileSync(controlXmlPath, `<HBuilder>\n<apps>\n    <app appid="${appid}" appver=""/>\n</apps>\n</HBuilder>\n`);
    sendLog(`✅ 资源同步完成: ${targetAppDir}\n`);

    const stringsXmlPath = path.join(SHELL_DIR, 'app/src/main/res/values/strings.xml');
    if (fs.existsSync(stringsXmlPath)) {
      fs.writeFileSync(
        stringsXmlPath,
        `<resources>\n    <string name="app_name">${escapeXml(appName)}</string>\n</resources>\n`,
        'utf8'
      );
      sendLog(`🏷️ 原生应用名称已同步至 strings.xml: "${appName}"\n`);
    }

    cleanStretchedSplash();
    applyFastSplashScreen(targetDir);

    const projectIcon = findProjectIconPath(targetDir);
    const shellIcon = path.join(SHELL_DIR, 'app/src/main/res/drawable/icon.png');
    const iconSource = (projectIcon && fs.existsSync(projectIcon))
      ? projectIcon
      : (fs.existsSync(shellIcon) ? shellIcon : null);

    if (iconSource) {
      const iconTargets = [
        path.join(SHELL_DIR, 'app/src/main/res/mipmap-xxhdpi/ic_launcher.png'),
        path.join(SHELL_DIR, 'app/src/main/res/drawable/icon.png'),
        path.join(SHELL_DIR, 'app/src/main/res/drawable-xxhdpi/icon.png'),
      ];
      for (const it of iconTargets) {
        const id = path.dirname(it);
        if (!fs.existsSync(id)) fs.mkdirSync(id, { recursive: true });
        fs.copyFileSync(iconSource, it);
      }
      sendLog(`🎨 应用桌面图标已同步 (${path.basename(iconSource)})，已开启秒开直入模式\n`);
    }

    sendLog('\n==================================================\n', 'info');
    sendLog('🔨 [Step 3/4] 调用本地 Gradle 编译原生 APK...\n', 'info');
    sendLog('==================================================\n', 'info');

    const currentEnv = detectAllEnv(WORKSPACE_DIR);
    SHELL_DIR = currentEnv.shell.path;

    if (!currentEnv.shell.ok) {
      sendLog(`\n❌ 宿主壳工程不存在: ${SHELL_DIR}\n`, 'err');
      ACTIVE_BUILD = null;
      sender.send('build-done', { success: false, message: '壳工程不存在' });
      return;
    }

    if (currentEnv.sdk.ok) {
      syncLocalProperties(SHELL_DIR, currentEnv.sdk.path);
      sendLog(`🌐 跨设备 SDK 路径已同步到 local.properties: ${currentEnv.sdk.path}\n`);
    }

    const gradleBin = currentEnv.gradle.path
      ? currentEnv.gradle.path
      : (process.platform === 'win32' ? 'gradlew.bat' : './gradlew');

    const buildEnv = { ...process.env };
    if (currentEnv.jdk.ok) {
      buildEnv.JAVA_HOME = currentEnv.jdk.path;
      sendLog(`☕ 使用 JDK: ${currentEnv.jdk.path} (${currentEnv.jdk.version})\n`);
    }
    if (currentEnv.sdk.ok) {
      buildEnv.ANDROID_HOME = currentEnv.sdk.path;
      buildEnv.ANDROID_SDK_ROOT = currentEnv.sdk.path;
    }

    const gradleProcess = spawn(gradleBin, ['assembleDebug'], {
      cwd: SHELL_DIR,
      shell: true,
      env: buildEnv,
    });

    gradleProcess.stdout.on('data', (d) => sendLog(d.toString()));
    gradleProcess.stderr.on('data', (d) => sendLog(d.toString(), 'err'));

    gradleProcess.on('error', (e) => {
      sendLog(`\n❌ 无法启动 Gradle: ${e.message}\n`, 'err');
      ACTIVE_BUILD = null;
      sender.send('build-done', { success: false, message: e.message });
    });

    gradleProcess.on('close', (gCode) => {
      ACTIVE_BUILD = null;
      if (gCode !== 0) {
        sendLog(`\n❌ 原生打包失败，退出码: ${gCode}\n`, 'err');
        sender.send('build-done', { success: false, message: `Gradle 编译失败 (exit ${gCode})` });
        return;
      }

      sendLog('\n==================================================\n', 'info');
      sendLog('📦 [Step 4/4] 归档产出物并准备交付...\n', 'info');
      sendLog('==================================================\n', 'info');

      const apkSource = path.join(SHELL_DIR, 'app/build/outputs/apk/debug/app-debug.apk');
      const distDir = path.join(targetDir, 'dist');
      if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });
      const apkTarget = path.join(distDir, finalApkName);

      if (fs.existsSync(apkSource)) {
        fs.copyFileSync(apkSource, apkTarget);
        sendLog(`✅ APK 文件已输出: ${apkTarget}\n`, 'info');
        sender.send('build-done', {
          success: true,
          apk_name: finalApkName,
          apk_path: apkTarget,
          message: '🎉 离线打包成功！产物已输出。',
        });
      } else {
        sendLog(`❌ 未在预期位置找到编译产出: ${apkSource}\n`, 'err');
        sender.send('build-done', { success: false, message: '未找到产出 APK' });
      }
    });
  });
}

// ── Electron 主窗口初始化 ──────────────────────────────────────────
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 840,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#0d1117',
    title: 'uni-app 离线打包工作台 (Desktop)',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);

  const devUrl = 'http://127.0.0.1:1420';
  const prodFile = path.join(__dirname, '../dist/index.html');

  if (!app.isPackaged && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else if (!app.isPackaged) {
    mainWindow.loadURL(devUrl).catch(() => {
      mainWindow.loadFile(prodFile);
    });
  } else {
    mainWindow.loadFile(prodFile);
  }
}

// ── IPC Handlers 映射 ───────────────────────────────────────────────
function registerIpcHandlers() {
  ipcMain.handle('get_env_status', async () => {
    try {
      const env = detectAllEnv(WORKSPACE_DIR);
      SHELL_DIR = env.shell.path;
      const certConfig = getSigningConfig();
      const certFile = resolveKeystorePath(certConfig.storeFile);
      const certResult = extractSha1(certFile, certConfig.storePassword, { jdk: env.jdk });

      return {
        overall_ok: Boolean(env.overallOk && certResult.ok),
        jdk: {
          ok: Boolean(env.jdk.ok),
          path: env.jdk.path || '未检测到',
          version: env.jdk.version || '',
          error: env.jdk.error || '',
        },
        sdk: {
          ok: Boolean(env.sdk.ok),
          path: env.sdk.path || '未检测到',
          error: env.sdk.error || '',
        },
        shell: {
          ok: Boolean(env.shell.ok),
          path: env.shell.path || '未检测到',
          error: env.shell.error || '',
        },
        gradle: {
          ok: Boolean(env.gradle.ok),
          path: env.gradle.path || '未检测到',
          isWrapper: Boolean(env.gradle.isWrapper),
          error: env.gradle.error || '',
        },
        aar: {
          ok: Boolean(env.aar.ok),
          files: env.aar.files || [],
          count: env.aar.count || 0,
          path: env.aar.path || '',
        },
        cert: {
          ok: Boolean(certResult.ok),
          sha1: certResult.sha1 || '',
          storeFile: certConfig.storeFile,
          isDefault: Boolean(certConfig.isDefault),
          error: certResult.error || '',
        },
      };
    } catch (err) {
      console.error('[ipc] get_env_status error:', err);
      throw err;
    }
  });

  ipcMain.handle('get_project_config', async (_event, args) => {
    try {
      const targetDir = resolveTargetDir(args?.projectDir);
      let appkey = '';
      const packCfgForKey = getPackConfig(targetDir);
      if (packCfgForKey?.dcloud?.appkey) {
        appkey = packCfgForKey.dcloud.appkey;
      }
      if (!appkey) {
        const manifestXml = path.join(SHELL_DIR, 'app/src/main/AndroidManifest.xml');
        if (fs.existsSync(manifestXml)) {
          try {
            const xml = fs.readFileSync(manifestXml, 'utf8');
            const keyMatch = xml.match(/android:name="dcloud_appkey"\s+android:value="([^"]+)"/);
            if (keyMatch && keyMatch[1] !== 'REPLACE_WITH_YOUR_DCLOUD_APPKEY') {
              appkey = keyMatch[1];
            }
          } catch (e) {}
        }
      }

      if (!targetDir) {
        const defaultCert = getSigningConfig();
        const certFile = resolveKeystorePath(defaultCert.storeFile);
        const certRes = extractSha1(certFile, defaultCert.storePassword);
        return {
          project_dir: '',
          app_name: 'uni-app应用',
          version_name: '1.0.0',
          package_name: detectShellPackageName() || 'com.boil.integral',
          app_id: '__UNI__CUSTOM',
          app_key: appkey,
          apk_name: '',
          store_file: defaultCert.storeFile,
          store_password: defaultCert.storePassword,
          key_alias: defaultCert.keyAlias,
          key_password: defaultCert.keyPassword,
          sha1: certRes.sha1 || '',
          is_default_cert: Boolean(defaultCert.isDefault),
        };
      }

      recordProjectDir(targetDir);

      let appName = 'uni-app应用';
      let version = '1.0.0';
      let appid = '__UNI__CUSTOM';
      let pkg = detectShellPackageName() || 'com.boil.integral';

      const manifestPath = findManifestPath(targetDir);
      const manifestJson = parseManifestJson(manifestPath);
      if (manifestJson) {
        if (manifestJson.name) appName = manifestJson.name;
        if (manifestJson.versionName) version = manifestJson.versionName;
        else if (manifestJson.version?.name) version = manifestJson.version.name;
        if (manifestJson.appid) appid = manifestJson.appid;

        const androidDistribute = manifestJson['app-plus']?.distribute?.android;
        const manifestPkg = androidDistribute?.packagename
          || androidDistribute?.packageName
          || androidDistribute?.package;
        if (manifestPkg && typeof manifestPkg === 'string' && manifestPkg.trim()) {
          pkg = manifestPkg.trim();
        }
      }

      let apkName = '';
      const rcPath = path.join(targetDir, 'scripts/.packrc.json');
      if (fs.existsSync(rcPath)) {
        try {
          const rc = JSON.parse(fs.readFileSync(rcPath, 'utf8'));
          if (rc.apkName) apkName = rc.apkName;
        } catch (e) {}
      }
      if (!apkName) apkName = `${appName}_v${version}.apk`;

      const certConfig = getSigningConfig(targetDir);
      const certFile = resolveKeystorePath(certConfig.storeFile, targetDir);
      const certResult = extractSha1(certFile, certConfig.storePassword);

      return {
        project_dir: targetDir,
        app_name: appName,
        version_name: version,
        package_name: pkg,
        app_id: appid,
        app_key: appkey,
        apk_name: apkName,
        store_file: certConfig.storeFile || 'test.keystore',
        store_password: certConfig.storePassword || '',
        key_alias: certConfig.keyAlias || 'test',
        key_password: certConfig.keyPassword || '',
        sha1: certResult.sha1 || '',
        is_default_cert: Boolean(certConfig.isDefault),
      };
    } catch (err) {
      console.error('[ipc] get_project_config error:', err);
      throw err;
    }
  });

  ipcMain.handle('save_project_config', async (_event, args) => {
    try {
      const cfg = args?.config || {};
      const targetDir = resolveTargetDir(cfg.project_dir || cfg.projectDir);
      if (!targetDir) throw new Error('未找到有效的 uni-app 项目目录');
      recordProjectDir(targetDir);

      const appkey = cfg.app_key ?? cfg.appKey ?? '';
      const apkName = cfg.apk_name ?? cfg.apkName ?? '';
      const appName = cfg.app_name ?? cfg.appName ?? '';

      const currentPackCfg = getPackConfig(targetDir) || {};
      currentPackCfg.dcloud = { ...(currentPackCfg.dcloud || {}), appkey };
      savePackConfig(currentPackCfg, targetDir);

      const rcDir = path.join(targetDir, 'scripts');
      if (!fs.existsSync(rcDir)) fs.mkdirSync(rcDir, { recursive: true });
      const rcFile = path.join(rcDir, '.packrc.json');
      backupFile(rcFile);
      fs.writeFileSync(rcFile, JSON.stringify({ apkName }, null, 2), 'utf8');

      if (appName) {
        const stringsXmlPath = path.join(SHELL_DIR, 'app/src/main/res/values/strings.xml');
        if (fs.existsSync(stringsXmlPath)) {
          fs.writeFileSync(
            stringsXmlPath,
            `<resources>\n    <string name="app_name">${escapeXml(appName)}</string>\n</resources>\n`
          );
        }
      }

      if (appkey) {
        const manifestXml = path.join(SHELL_DIR, 'app/src/main/AndroidManifest.xml');
        if (fs.existsSync(manifestXml)) {
          let xml = fs.readFileSync(manifestXml, 'utf8');
          xml = xml.replace(
            /android:name="dcloud_appkey"\s+android:value="[^"]*"/,
            `android:name="dcloud_appkey"\n            android:value="${appkey}"`
          );
          fs.writeFileSync(manifestXml, xml, 'utf8');
        }
      }

      return { success: true };
    } catch (err) {
      console.error('[ipc] save_project_config error:', err);
      throw err;
    }
  });

  ipcMain.handle('get_project_icon', async (_event, args) => {
    try {
      const targetDir = resolveTargetDir(args?.projectDir);
      const projectIcon = findProjectIconPath(targetDir);
      let finalIconPath = null;

      if (projectIcon && fs.existsSync(projectIcon)) {
        finalIconPath = projectIcon;
      } else {
        const candidate1 = path.join(SHELL_DIR, 'app/src/main/res/drawable-xxhdpi/icon.png');
        const candidate2 = path.join(SHELL_DIR, 'app/src/main/res/drawable/icon.png');
        if (fs.existsSync(candidate1)) finalIconPath = candidate1;
        else if (fs.existsSync(candidate2)) finalIconPath = candidate2;
      }

      if (finalIconPath && fs.existsSync(finalIconPath)) {
        const ext = path.extname(finalIconPath).toLowerCase().replace('.', '');
        const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : (ext === 'webp' ? 'image/webp' : 'image/png');
        const buffer = fs.readFileSync(finalIconPath);
        return `data:${mime};base64,${buffer.toString('base64')}`;
      }
      return null;
    } catch (err) {
      console.error('[ipc] get_project_icon error:', err);
      return null;
    }
  });

  ipcMain.handle('upload_project_icon', async (_event, args) => {
    try {
      const { projectDir, dataUrl } = args || {};
      if (!dataUrl) throw new Error('缺少图标数据');
      const targetDir = resolveTargetDir(projectDir);

      const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      const targetPaths = [
        path.join(SHELL_DIR, 'app/src/main/res/drawable-xxhdpi/icon.png'),
        path.join(SHELL_DIR, 'app/src/main/res/drawable/icon.png'),
        path.join(SHELL_DIR, 'app/src/main/res/mipmap-xxhdpi/ic_launcher.png'),
      ];
      if (targetDir) {
        targetPaths.push(path.join(targetDir, 'src/static/logo.png'));
        backupFile(path.join(targetDir, 'src/static/logo.png'));
      }

      for (const target of targetPaths) {
        const dir = path.dirname(target);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(target, buffer);
      }

      cleanStretchedSplash();
      if (targetDir) applyFastSplashScreen(targetDir);
      return { success: true };
    } catch (err) {
      console.error('[ipc] upload_project_icon error:', err);
      throw err;
    }
  });

  ipcMain.handle('verify_cert', async (_event, args) => {
    try {
      const { storeFile, storePassword, keyAlias, keyPassword, projectDir } = args || {};
      const targetDir = resolveTargetDir(projectDir);
      const cleanStoreFile = (storeFile || 'test.keystore').trim();
      const pw = (storePassword || '').trim();
      const certFile = resolveKeystorePath(cleanStoreFile, targetDir);

      let alias = (keyAlias || '').trim();

      // 若未指定别名，利用 probeKeystore 提取别名
      if (pw) {
        const probeRes = probeKeystore(certFile, [pw]);
        if (probeRes.ok) {
          if (!alias) alias = probeRes.keyAlias;
          saveKnownPassword(pw);
        }
      }

      const newCfg = {
        storeFile: cleanStoreFile,
        storePassword: pw,
        keyAlias: alias || 'test',
        keyPassword: (keyPassword || pw).trim(),
        isDefault: false,
      };

      const certResult = extractSha1(certFile, newCfg.storePassword, { noCache: true });
      if (!certResult.ok) {
        return { success: false, error: certResult.error || '证书或密码校验失败' };
      }

      if (!alias && certResult.alias) {
        newCfg.keyAlias = certResult.alias;
      }

      if (newCfg.storePassword) {
        saveKnownPassword(newCfg.storePassword);
      }

      fs.writeFileSync(SIGNING_CONFIG_FILE, JSON.stringify(newCfg, null, 2), 'utf8');
      updateGradleSigning(newCfg);

      const currentPackCfg = getPackConfig(targetDir) || {};
      currentPackCfg.signing = {
        ...newCfg,
        sha1: certResult.sha1,
      };
      savePackConfig(currentPackCfg, targetDir);

      return {
        success: true,
        sha1: certResult.sha1,
        keyAlias: newCfg.keyAlias,
        keyPassword: newCfg.keyPassword
      };
    } catch (err) {
      console.error('[ipc] verify_cert error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('import_cert_file', async (_event, args) => {
    try {
      const { filePath, projectDir } = args || {};
      if (!filePath || !fs.existsSync(filePath)) throw new Error('证书文件不存在');
      const targetDir = resolveTargetDir(projectDir);

      const cleanName = path.basename(filePath);
      const ext = path.extname(cleanName).toLowerCase();
      if (ext !== '.keystore' && ext !== '.jks') {
        throw new Error('仅支持 .keystore / .jks 证书文件');
      }

      const buffer = fs.readFileSync(filePath);
      const shellCertPath = path.join(SHELL_DIR, 'app', cleanName);
      const configCertPath = path.join(CONFIG_DIR, cleanName);

      fs.writeFileSync(shellCertPath, buffer);
      if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
      fs.writeFileSync(configCertPath, buffer);

      if (targetDir && fs.existsSync(path.join(targetDir, 'config'))) {
        fs.writeFileSync(path.join(targetDir, 'config', cleanName), buffer);
      }

      // 导入后立即全自动嗅探密码、别名与 SHA1
      const probeRes = probeKeystore(configCertPath);
      if (probeRes.ok) {
        const autoCfg = {
          storeFile: cleanName,
          storePassword: probeRes.storePassword,
          keyAlias: probeRes.keyAlias,
          keyPassword: probeRes.keyPassword,
          isDefault: false,
        };

        try {
          fs.writeFileSync(SIGNING_CONFIG_FILE, JSON.stringify(autoCfg, null, 2), 'utf8');
          updateGradleSigning(autoCfg);
          const currentPackCfg = getPackConfig(targetDir) || {};
          currentPackCfg.signing = {
            ...autoCfg,
            sha1: probeRes.sha1,
          };
          savePackConfig(currentPackCfg, targetDir);
        } catch (e) {}

        return {
          fileName: cleanName,
          autoFilled: true,
          storePassword: probeRes.storePassword,
          keyAlias: probeRes.keyAlias,
          keyPassword: probeRes.keyPassword,
          sha1: probeRes.sha1
        };
      }

      return {
        fileName: cleanName,
        autoFilled: false
      };
    } catch (err) {
      console.error('[ipc] import_cert_file error:', err);
      throw err;
    }
  });

  ipcMain.handle('pick_project_directory', async (_event, args) => {
    try {
      const defaultPath = args?.defaultPath && fs.existsSync(args.defaultPath) ? args.defaultPath : undefined;
      const res = await dialog.showOpenDialog(mainWindow, {
        title: '选择 uni-app 项目根目录',
        defaultPath,
        properties: ['openDirectory'],
      });
      if (!res.canceled && res.filePaths.length > 0) {
        return res.filePaths[0];
      }
      return null;
    } catch (err) {
      console.error('[ipc] pick_project_directory error:', err);
      return null;
    }
  });

  ipcMain.handle('pick_certificate_file', async () => {
    try {
      const res = await dialog.showOpenDialog(mainWindow, {
        title: '选择 Android 签名证书文件',
        properties: ['openFile'],
        filters: [{ name: 'KeyStore 证书', extensions: ['keystore', 'jks'] }],
      });
      if (!res.canceled && res.filePaths.length > 0) {
        return res.filePaths[0];
      }
      return null;
    } catch (err) {
      console.error('[ipc] pick_certificate_file error:', err);
      return null;
    }
  });

  ipcMain.handle('open_directory', async (_event, args) => {
    try {
      const dirPath = args?.dirPath;
      if (dirPath && fs.existsSync(dirPath)) {
        await shell.openPath(dirPath);
      }
    } catch (err) {
      console.error('[ipc] open_directory error:', err);
    }
  });

  ipcMain.handle('start_offline_build', async (event, args) => {
    try {
      if (isBuildBusy()) {
        event.sender.send('build-log', { text: '⏳ 已有打包任务正在运行中，请等待完成。\n', type: 'err' });
        event.sender.send('build-done', { success: false, message: '构建正在运行中' });
        return;
      }
      ACTIVE_BUILD = { startedAt: Date.now() };
      await runBuildPipeline(event.sender, args?.params);
    } catch (err) {
      ACTIVE_BUILD = null;
      console.error('[ipc] start_offline_build error:', err);
      event.sender.send('build-done', { success: false, message: err.message });
    }
  });
}

// ── App 生命周期 ────────────────────────────────────────────────────
app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
