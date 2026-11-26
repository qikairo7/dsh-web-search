# playbook 里点名的东西换成本机什么

`poteto-mode` 的 skill 和 playbook 里点名的执行者、模型、工具，按这张表换成本机有的。左列照原文，右列的每条在 2026-11-26 用 `command -v` 或路径逐个核过。

| playbook 里写的 | 本机换成什么 |
|---|---|
| `subagent_type: poteto-agent`，Cursor 云端验证者 | DSH 的 `subagent` 工具，派单第一行读 `worker.md` |
| Cursor 的模型 slug | 按 `~/.dsh/MODEL-ROUTING.md` 查，`provider` 填 `magpie` |
| `/deslop` from the `cursor-team-kit` plugin | 没有这个命令；换成本仓库的 `pnpm check`、`CODING_STANDARDS.md` 第 3 节注释纪律和 `autocorrect --fix` |
| `control-ui` or `control-cli` from `cursor-team-kit` | 没有这两个命令；按 verify 的做法起隔离 DSH web，用 ego 操作 |
| scripts/watch-pr/watch-pr | 本机没有 bun；换 `gh pr checks --watch` |
| Cursor 的 `/loop` | 本机没有 |
| `graphify` 看社区划分 | 不用 |
| `codegraph affected` 看改动影响面 | 留着，跑 `codegraph affected <文件>`，列出的测试全绿才算完 |
| 谁调谁、架构概览、跨仓库 | `codebase-memory-mcp cli` 的 `index_repository`、`trace_path`、`get_architecture` |