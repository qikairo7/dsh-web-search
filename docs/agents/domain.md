# Domain Docs

This is a single-context repository. Read the domain docs before exploring code:

- [GLOSSARY.md](../../GLOSSARY.md) at the repo root defines the project's terms.
- [docs/adr/](../adr/) holds accepted architecture decisions; read the ADRs that touch the area you are changing.
- If `GLOSSARY-MAP.md` appears, read it and each context glossary it points to.

Use glossary terms in issue titles, refactor proposals, hypotheses, tests, and docs. Do not drift to synonyms the glossary avoids. If a term is missing, either you are inventing language the project does not use, or there is a real gap to note.

If output contradicts an existing ADR, say so explicitly before overriding it.

If a glossary or ADR file is missing, proceed silently. Do not flag the absence or suggest creating one; `/domain-modeling` creates these files when terms or decisions are actually settled.
