# PR 交付门禁

本文件定义所有 Pull Request 的提交前门禁。门禁适用于功能、修复、文档和发布改动。

## 固定顺序

1. 使用 `pr` skill 生成 PR 正文骨架。
2. 使用 `tech-doc-style-chinese` 按中文技术文档规范整理正文。
3. 使用 `humanizer-zh` 润色散文正文。

`humanizer-zh` 只处理散文。代码、命令、路径、URL、表格数据、数字、版本号和确定程度不得改动。

## 必需结构

PR 正文必须按顺序包含三个 `##` 标题：

- `## Summary`
- `## Evidence`
- `## Merge Danger`

### Summary

说明改了什么、为什么改。优先使用最小 diff、文件树、调用树或伪代码。不要写空泛铺垫。

### Evidence

必须包含：

- `Before:` 改动前的状态、失败测试、截图或命令输出。
- `After:` 改动后的状态、通过测试、截图或命令输出。

只写实际运行或实际观察到的结果。未运行的项目写 `not-run`，并说明原因和剩余风险；不能把未验证结果写成已验证。

### Merge Danger

必须包含：

- `Door:` `one-way` 或 `two-way`。
- `Blast Radius:` 一句话说明影响范围。
- `Revert:` 一句话说明怎么撤销（如 `git revert <squash commit>` / 关闭 `<flag>` / 回滚数据无需处理）。纯文档也写（`git revert` 即可）。

兼容性影响和监控要求按需补充。撤销路径是合并前的最后一道思考（Claude Code 同款 PR 模板三问之一）。

## 徽章

PR 正文末尾保留 `powered by dsh` 徽章。使用 `dsh-badge` skill 的固定 Markdown，不改颜色、文字和链接。徽章单独成段放在正文最后，不要写进 `Summary`、`Evidence` 或 `Merge Danger` 的正文句子；它可以位于最后一个 `##` 标题之后。`dependabot[bot]`、`renovate[bot]` 等自动 PR 跳过整个 PR 正文门禁，避免自动更新被章节或徽章要求卡住。

## 提交前检查

- `pnpm check` 退出码为 0。
- PR 正文通过：
  `node scripts/check-pr-gate.mjs --body-file <path>`
- 行为变化已同步 `README.md`、`README.zh.md`，用户可见变化已写入 `CHANGELOG.md`。
- 主账号终审 approve 前不合并、不发布；approve 后由 bot 执行 squash merge 与 tag 推送，release 工作流收 tag 后自动发布。
