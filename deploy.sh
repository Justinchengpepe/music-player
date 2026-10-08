#!/bin/bash
# Oracle Cloud / 任意 Ubuntu 服务器一键部署脚本
# 用法（在服务器上）：bash deploy.sh
set -e

echo "==> 安装 Node 20 + npm"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs npm

echo "==> 安装 PM2（进程守护，重启自动拉起）"
sudo npm install -g pm2

echo "==> 安装项目依赖"
cd "$(dirname "$0")"
npm install

echo "==> 启动服务"
pm2 start server.js --name music-player
pm2 save
pm2 startup

echo ""
echo "✅ 部署完成！"
echo "   本地测试：curl http://localhost:8088/"
echo "   公网访问：http://<你的服务器公网IP>:8088"
