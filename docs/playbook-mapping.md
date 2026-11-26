# playbook 里点名的东西换成本机什么

`poteto-mode` 的 skill 和 playbook 里点名的执行者、模型、工具，按这张表换成本机有的。左列照原文，右列的每条在 2026-11-26 用 `command -v` 或路径逐个核过。

| playbook 里写的 | 本机换成什么 |
|---|---|
| `subagent_type: poteto-agent`，Cursor 云端验证者 | DSH 的 `subagent` 工具，派单第一行读 `worker.md` |
| Cursor 的模型 slug | 按 `~/.dsh/MODEL-ROUTING.md` 查，`provider` 填 `magpie` |
| `/deslop`（cursor-team-kit） | 没有这个命令；换成本仓库门禁 `pnpm check`、注释门禁、`autocorrect --fix` |
| `control-ui` / `control-cli` | 没有这两个命令；按 verify 的做法起隔离 DSH web，用 ego 操作 |
| `scripts/watch-pr/watch-pr`（要 bun） | 本机没有 bun；换 `gh pr checks --watch` |
| Cursor 的 `/loop` | 本机没有 |