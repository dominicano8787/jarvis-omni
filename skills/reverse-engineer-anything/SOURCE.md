# Source

Vendored from [morluto/rea](https://github.com/morluto/rea) at commit
`42bbf33` (2026-11-24), path `.agents/skills/reverse-engineer-anything/`.
Skill version 63. MIT licensed; see `LICENSE` in this folder.

To update: copy that folder from a newer checkout of the REA repo over this
one, keeping `LICENSE` and this file.

Jarvis loads `SKILL.md` into the Reverse Engineering profile
(`server/experts.py`) and runs REA through the `rea_cli` tool
(`server/tools.py`). The REA MCP server is not wired into Jarvis, so MCP-only
tools named in the skill are reached through their CLI commands instead.
