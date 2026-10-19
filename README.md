# DSH Desktop Tweaks（桌面增强）

DeepSeek Harness 桌面端修改：F11 全屏切换，终端内使用 Ctrl+C/V 复制粘贴。两个功能各自带开关，入口在 **设置 → 通用**：

- **F11 切换窗口全屏**：进入全屏时隐藏「应用 / 编辑」菜单栏与后退、前进按钮，内容顶到屏幕最上沿；退出全屏后恢复。
- **终端使用 Ctrl+C/V 复制粘贴**：终端内有选区时 `Ctrl+C` 复制、无选区时照常发送 `SIGINT`；`Ctrl+V` 直接粘贴（走 xterm 的粘贴通道，多行文本不会弹确认）。

不修改 DSH 本身，只通过客户端插件注入少量事件监听与样式；两个开关都可独立关闭，关闭后行为与原生完全一致。

## 安装

### 方式 A：插件市场（DSH 0.2.1+，推荐）

1. 设置 → 插件 → 组合包，启用实验性的「自定义插件市场」（启用后插件页会出现「发现」）。
2. 在「发现」页点「添加索引源」，填入：
   ```
   https://amstlkqp114514.github.io/dsh-desktop-tweaks/index.json
   ```
3. 搜索「桌面增强」或「Desktop Tweaks」，点安装。

> 索引是托管在 GitHub Pages 的静态 JSON，市场只校验格式、不验证声明，请以安装确认框里显示的来源为准。

### 方式 B：命令行（任何版本）

```bash
dsh plugin --profile desktop add dsh-desktop-tweaks
```

桌面端的 profile 名是 `desktop`；换成你自己的 profile 名即可。安装后重启桌面端。

### 方式 C：本地 tarball / 源码目录 / Git

```bash
# tarball
npm pack
dsh plugin --profile desktop add ./dsh-desktop-tweaks-0.1.1.tgz

# 本地目录（link，改代码立即生效，适合开发）
dsh plugin --profile desktop add /path/to/dsh-desktop-tweaks

# Git（锁定 commit，无需构建步骤，也不需要 allowBuilds）
dsh plugin --profile desktop add "github:amstlkqp114514/dsh-desktop-tweaks#<commit sha>"
```

### 这些安装方式有什么区别

| 方式                            | 实际行为                                                    | 适合         |
| ------------------------------- | ----------------------------------------------------------- | ------------ |
| 市场 / `add dsh-desktop-tweaks` | pnpm 从 npm registry 安装预构建包，与市场安装完全同一套流程 | 普通用户     |
| 本地目录                        | `link:`，profile 里只放软链接                               | 开发调试     |
| tgz / git                       | 把包内容复制进 profile，与源目录脱钩                        | 分发、锁版本 |

本插件是纯 ESM、无构建步骤；只有带 `prepare` 构建脚本的包才需要在 `pnpm-workspace.yaml` 里配置 `allowBuilds`。

## 设置入口

设置 → 通用 → 「F11 切换窗口全屏」「终端 Ctrl+C/V 复制粘贴」。默认开启，状态保存在本地 `localStorage`（键 `dsh-desktop-tweaks/settings`）。

## 兼容性

- DSH 桌面端 **0.2.0-rc.2** 及以上（F11 与内置终端都是桌面端能力）。
- 市场「发现」页需要 **0.2.1-rc.1** 及以上，且属于实验性组合包。

## 已知限制

- 按 `Esc` 退出全屏是浏览器 / Electron 的原生行为，插件不拦截、不干预。
- 全屏瞬间右上角偶发的「xxx px × xxx px」是 **DevTools 打开时 Chromium 的窗口尺寸 OSD**，关掉开发者工具（Ctrl+Shift+I）即可，与插件无关。
- 只处理桌面端主窗口与内置终端；浏览器版（`dsh web`）没有窗口概念，F11 开关自然无效。

## 开发

```bash
node --check lib/index.js
node --check lib/client.js
```

调试时把仓库目录 link 进 profile，改完重启桌面端（或走客户端插件 HMR）：

```bash
dsh plugin --profile desktop add ./
```

## 发布（维护者）

```bash
npm version patch          # 改版本
npm login                  # 登录 npm
npm publish                # 未 scoped 的包默认就是公开的
node scripts/make-index.mjs   # 重新生成 site/index.json 与图标
git add site && git commit -m "site: <version>" && git push
```

GitHub Pages 需要在仓库 **Settings → Pages → Build and deployment** 里把 Source 选为 **GitHub Actions**（工作流在 `.github/workflows/pages.yml`）。

### 想改用 scoped 包名？

`scope` 就是 npm 用户名（或组织名）的前缀，包名形如 `@你的用户名/dsh-desktop-tweaks`。scoped 包默认私有，发布时要加 `--access public`：

```bash
npm publish --access public
```

本仓库没有硬编码包名：索引脚本从 `package.json` 读取 name / version，改完重新生成索引即可。

## License

MIT © 2026 青柑橘

---

**English**: DeepSeek Harness desktop tweaks: an F11 fullscreen toggle (hides the Windows menu bar and the back/forward buttons while fullscreen), and Ctrl+C / Ctrl+V copy and paste inside the built-in terminal. Both are switchable in **Settings → General**. Install with `dsh plugin --profile desktop add dsh-desktop-tweaks`, or add the market index `https://amstlkqp114514.github.io/dsh-desktop-tweaks/index.json`. MIT licensed.
