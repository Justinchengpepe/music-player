#!/bin/bash
# Codespaces 启动脚本
#
# 由 devcontainer.json 的 postStartCommand 调用。容器每次启动都会执行一次，
# 所以必须幂等 —— 已经在跑就直接退出，避免重复监听同一个端口。
#
# 日志写在 /tmp/vinyl-archive.log，查看：
#   tail -f /tmp/vinyl-archive.log
# 重启：
#   pkill -f 'node server.js' && npm start

set -e
cd "$(dirname "$0")/.."

if pgrep -f 'node server.js' >/dev/null; then
  echo "Vinyl Archive 已在运行，跳过启动"
  exit 0
fi

echo "启动 Vinyl Archive（首次冷启动约 30–60 秒）..."
exec npm start
