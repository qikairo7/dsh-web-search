# ADR-0016: 设置页设计 token 视觉层与内嵌字体

## 状态

已接受（2026-11-22，#238）

## 背景

#238 要求设置页视觉切换到 ElevenLabs 纸感风。设计资产已入库：根 DESIGN.md 是视觉真源，docs/design/ 三件（tokens.json / variables.css / theme.css）承载 token。当前 client.js 全部颜色经宿主注入的 `--dsw-alias-*` 变量消费，宿主变量的值不属于本仓，无法承载本仓的设计真源。

字体方面，仓库原本无 @font-face、无字体文件；宿主对包内字体文件没有直接 URL 通道，但插件可经 `webServer.register` 注册同源路由（health/models/quotas 先例），包内文件可以经它供出。

## 决策

1. **token 换轨，alias 降级为兼容层**。client.js 在样式注入时定义 `--dsw2-*` 变量：light 值逐条取自 docs/design/variables.css；dark 无真源，按同气质推导（暖黑非冷黑， violet-spark 提亮一档保对比）。八个 `--dsw-alias-*` 变量保留并重定向到 dsw2 值（宿主已注入的旧值被同 name 的后声明覆盖），页面内部样式直接消费 dsw2。不改宿主 design-platform.css。
2. **字体真文件内嵌**。Inter 300/400/500 与 Geist Mono 400 的 latin 子集 woff2（共约 151KB）入 `lib/fonts/`，随包发布（package.json#files 增加 `lib/fonts/*`）；`lib/fonts-routes.js` 注册 `GET /dsh-web-search/fonts/<file>` 同源供文件，信任模型与 health 路由一致（Connection service 的 requestRejection，未挂载时本地 same-origin 检查 fail-closed），另加连接对端必须 loopback 的加固。Waldenburg 是 Schick Toikka 商用字体、不在 Google Fonts：font-family 栈保留其占位，本机安装或维护者后供字体文件即生效，Latin 显示字形由 Inter 300 承担（DESIGN.md 记载的官方替代）；中文自动回退系统字体栈。
3. **深色模式跟随宿主**。主题由宿主 `body[data-ds-dark-theme]` 属性控制；dsw2 的 dark 值挂在该属性选择器上，不使用 prefers-color-scheme 自行判断。

## 备选否决

- Google Fonts CDN 外链：设置页离线可用性被破坏，且引入第三方运行时请求，否决。
- 直接改宿主 dsw alias 的值：#227 定案不动宿主变量，否决。
- prefers-color-scheme 自行切主题：与宿主主题状态可能分裂，跟随宿主 data-ds-dark-theme，否决。
- base64 data: URI 内嵌进 client.js：bundle 膨胀约 200KB（约三分之一增量），否决。
- wreq 运行时下载字体：给设置页引入网络依赖与启动延迟，否决。
