# Review Lessons（错题本）

收 review 与实测中反复出现的教训，直到它晋升为正式标准。正式实现与 review 规则在 [CODING_STANDARDS.md](CODING_STANDARDS.md)；本文只收五项齐全的教训条目，不收猜测。

## 机制

- 每条教训五项齐全：规则（一句话、可执行）、为什么（违反的后果）、证据（commit、issue 链接或实测命令与输出，必须有出处）、Seen 计数、最近一次日期。
- 同一教训再次出现：Seen 加一、更新日期、追加证据；不改写旧证据。
- Seen=2：优先把教训「机械化」成守卫测试或机械检查（如 `test/architecture.test.js`、`scripts/verify-docs.mjs`），让门禁替人记住；确实无法机械化才继续留在本表。
- Seen=3：把规则晋升进 [CODING_STANDARDS.md](CODING_STANDARDS.md) 或该事实的唯一 home 文档；晋升不删旧条目，原条目保留证据与计数，状态改「已晋升」。
- 验证状态如实标注：没实际跑过的项标 `not-run`，不伪装成已验证；证据缺失的教训先补证据再入表。
- 本表随 review 累积教训，当前收录 6 条。

## 教训表

| 规则 | 为什么 | 证据 | Seen | 最近日期 | 状态 |
|---|---|---|---|---|---|
| 等待/重试步骤须核对「本 job 超时 vs 循环总预算 vs 被等待 job 超时」三者自洽 | 矛盾时 check 绿但超 10min 会误杀 release，新引入失败模式；本地干跑测不出 job 级超时 | PR#101 release.yml:24 vs :43-70 vs check.yml:21，三轴独立发现 | 1 | 2026-11-19 | open |
| 多触发路径 workflow 用 $GITHUB_SHA 前须按触发类型核对语义；被发布 commit 用 checkout 后 git rev-parse HEAD 定位 | workflow_dispatch 时 GITHUB_SHA 是派发 ref HEAD，非 inputs.tag commit，会等错 commit 的 check | PR#101 release.yml:29 vs :44 | 1 | 2026-11-19 | open |
| 渐进式披露类改动必须逐信息点在全仓找落点，PR 自述的『已有对应内容』不作数 | 搬家做成了丢失，且自述掩盖 | PR#104 S1：额度表与 Provider 矩阵删除后无新家，需求轴+质量轴独立收敛；README:57/README.en:57 多 Key 规则指向 docs/configuration.md 但该文件无此内容；architecture.md:118 仍称 README 掌默认值与配额 | 2 | 2026-11-19 | open |
| 搬移内容类改动，新写入的 Markdown 结构须逐处核对渲染：标题独立成行、双语小节对称；CI 绿不等于结构对（门禁不覆盖全部文件的标题结构） | 搬家把标题粘进正文行，双语导语被删，门禁全绿仍带病 | PR#104 修复轮 round1 引入 configuration.md:7 标题粘连+导语双丢，三轴复审收敛 | 1 | 2026-11-19 | open |
| 声称修复 issue 的 PR 正文用 Fixes/Closes/Resolves 引用；合并后核对 issue 已关，悬挂的补关 | Refs 不触发 GitHub 自动关闭，issue 悬挂无人发现 | PR#96 正文 Refs #91；#91 OPEN 至 2026-11-19 手动补关；PR#103 正文『修复 #97』无 closing 关键字，#97 手动补关 | 2 | 2026-11-19 | open |
| 提交前核对提交信息：标题单行、正文非空且末尾独立一行 Verified-by，不得出现字面 \n | 空正文或粘连戳让 §8 审计链断裂，git log --grep 无法区分已验证与未声明 | #89/#93/#94 正文为空无戳；#95 整条字面 \n 单行；#107 要点间字面 \n | 1 | 2026-11-19 | open |

新条目追加在表尾；一次 review 里同一教训只记一次。
