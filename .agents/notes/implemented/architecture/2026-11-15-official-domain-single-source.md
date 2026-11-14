# Agent Note: Official-doc domain knowledge has one source

Status: implemented

## Problem

「是否官方文档域」一个概念三套匹配机制（authority.js 精确集+前缀、officialDocs.js 规则表、quality.js 后缀匹配），边缘结果分叉：`doc.rust-lang.org` 触发官方补充搜索，但 authority 加权得 0、enrich 的技术摘要偏好也拿不到——对照 docs.python.org 三者全中。host 归一化在 4 处复制（quality/authority/news×2）。

## Decision

- 新 `lib/host.js`：`normalizeHostname()` 与 `hostMatchesDomain()` 的唯一实现；authority/news/quality 全部改调。
- `OFFICIAL_DOC_HOSTS` 显式增加 `doc.rust-lang.org`：加权与技术摘要偏好对齐 GLOSSARY「官方文档域」定义；rust 三列一致性由测试锁死。
- ADR-0009 的补充触发条件与 officialDocs 的 RULES 域清单零变化；`searchWithDomains` 的 duck-type 检查保留（单 adapter 的 seam，另有决策）。

## Alternatives considered

- 声明「补充资格与加权先验允许是两份清单」并保留分叉：落选，分叉是三套匹配机制的意外乘积，无人决策过；若未来真要分叉，应在一份知识上显式声明差异。
- 统一 officialDocs 与 authority 的域名清单为一张表：落选，两份清单用途不同（按查询推荐补充域 vs 全域权威先验），合并会互相牵制；本决策只统一匹配机制与归一化。

## Consequences

- 行为变化：`doc.rust-lang.org` 的权威加权 0 → 0.2，其页面获得技术摘要偏好；其余域行为不变。
- 域名改动一处生效三处（补充、加权、技术摘要）；`hostMatchesDomain` 语义不变（host 侧也剥 www.，与旧实现仅在病态 `www.www.` 域分叉）。
