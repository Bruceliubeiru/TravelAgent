# AI Skills Setup

This project is intended to use the shared AI Skills repository:

```text
https://github.com/Bruceliubeiru/ai-skills.git
```

## Add as Git submodule

Run this from the project root:

```bash
git submodule add https://github.com/Bruceliubeiru/ai-skills.git .skills
git commit -m "chore: add ai skills submodule"
git push
```

## After cloning this project

Use:

```bash
git clone --recurse-submodules <repo-url>
```

Or after normal clone:

```bash
git submodule update --init --recursive
```

## Use the skill

Ask your coding agent:

```text
请读取 .skills/idea-to-repo-growth-builder/SKILL.md，并进入 Idea-to-Repo Growth Builder 模式。
如果没有 PROJECT_STATUS.md，请先用 .skills/idea-to-repo-growth-builder/templates/PROJECT_STATUS_TEMPLATE.md 创建。
```
