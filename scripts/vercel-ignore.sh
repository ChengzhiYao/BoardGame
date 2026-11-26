#!/bin/bash
# Vercel「Ignored Build Step」:exit 0 = 跳过这次构建,exit 1 = 正常构建。目的:省构建费(Build CPU Minutes)。
# 规则:
#  1. 提交信息里有 [skip build] → 跳过
#  2. 非 main 分支默认不建预览;提交信息里写 [preview] 才建
#  3. main 上只改了文档、SQL、移动端壳、脚本等不影响网站的文件 → 跳过
msg="$(git log -1 --pretty=%B 2>/dev/null)"
if echo "$msg" | grep -q '\[skip build\]'; then echo "skip: [skip build]"; exit 0; fi
if [ "$VERCEL_GIT_COMMIT_REF" != "main" ]; then
  if echo "$msg" | grep -qi '\[preview\]'; then echo "build: preview requested"; exit 1; fi
  echo "skip: preview builds are off for branches (put [preview] in the commit message to build one)"; exit 0
fi
prev="$VERCEL_GIT_PREVIOUS_SHA"
if [ -n "$prev" ] && git cat-file -e "$prev^{commit}" 2>/dev/null; then
  if git diff --quiet "$prev" HEAD -- . ':(exclude)docs' ':(exclude)*.md' ':(exclude)supabase' ':(exclude)scripts' ':(exclude)design' ':(exclude)figma.config.json' ':(exclude)tsconfig.tsbuildinfo'; then
    echo "skip: only non-site files changed since $prev"; exit 0
  fi
fi
echo "build"; exit 1
