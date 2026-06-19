#!/usr/bin/env python
# -*- coding: utf-8 -*-
# deploy.py

import paramiko
import os
import sys

HOST = "204.168.240.223"
USER = "root"
PASSWORD = "Nigerr13091984@"
REMOTE_DIR = "/opt/roast-bot"
LOCAL_DIR = os.path.dirname(os.path.abspath(__file__))

FILES = [
    "package.json",
    "ecosystem.config.js",
    ".env",
    "db/schema.sql",
    "src/bot.js",
    "src/cron.js",
    "src/prompts/system.js",
    "src/services/ai.js",
    "src/services/card.js",
    "src/services/db.js",
    "src/services/moderation.js",
    "src/handlers/start.js",
    "src/handlers/photo.js",
    "src/handlers/text.js",
    "src/handlers/roast.js",
    "src/handlers/payment.js",
    "src/handlers/top.js",
]

def run(client, cmd, ignore_error=False):
    print("  $ " + cmd[:80])
    stdin, stdout, stderr = client.exec_command(cmd, get_pty=False)
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    if out:
        for line in out.split("\n")[:5]:
            print("    " + line)
    if err and not ignore_error:
        for line in err.split("\n")[:3]:
            print("  [err] " + line)
    return out

def upload_file(sftp, local_path, remote_path):
    remote_dir = "/".join(remote_path.split("/")[:-1])
    try:
        sftp.mkdir(remote_dir)
    except:
        pass
    sftp.put(local_path, remote_path)
    print("  OK: " + remote_path)

def main():
    print("\n[*] Connecting to " + HOST + "...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        client.connect(HOST, username=USER, password=PASSWORD, timeout=15)
        print("[+] Connected!\n")
    except Exception as e:
        print("[-] Connection failed: " + str(e))
        sys.exit(1)

    # Node.js check
    print("[*] Checking Node.js...")
    node_ver = run(client, "node -v 2>/dev/null || echo NOT_INSTALLED")
    if "NOT_INSTALLED" in node_ver or not node_ver.strip().startswith("v"):
        print("  Installing Node.js 22...")
        run(client, "curl -fsSL https://deb.nodesource.com/setup_22.x | bash - > /dev/null 2>&1")
        run(client, "apt-get install -y nodejs > /dev/null 2>&1")
        node_ver = run(client, "node -v")
    print("  Node.js: " + node_ver)

    # pm2 check
    print("\n[*] Checking pm2...")
    pm2_ver = run(client, "pm2 -v 2>/dev/null || echo NOT_INSTALLED")
    if "NOT_INSTALLED" in pm2_ver:
        print("  Installing pm2...")
        run(client, "npm install -g pm2 > /dev/null 2>&1")
        pm2_ver = run(client, "pm2 -v")
    print("  pm2: " + pm2_ver)

    # Create dirs
    print("\n[*] Creating directories...")
    for d in [
        REMOTE_DIR,
        REMOTE_DIR + "/src/services",
        REMOTE_DIR + "/src/handlers",
        REMOTE_DIR + "/src/prompts",
        REMOTE_DIR + "/db",
        REMOTE_DIR + "/logs",
        REMOTE_DIR + "/cards",
    ]:
        run(client, "mkdir -p " + d, ignore_error=True)

    # Upload files
    print("\n[*] Uploading files...")
    sftp = client.open_sftp()
    for rel_path in FILES:
        local_full = os.path.join(LOCAL_DIR, rel_path.replace("/", os.sep))
        remote_full = REMOTE_DIR + "/" + rel_path
        if not os.path.exists(local_full):
            print("  SKIP (not found): " + rel_path)
            continue
        upload_file(sftp, local_full, remote_full)
    sftp.close()

    # npm install
    print("\n[*] npm install on server...")
    run(client, "cd " + REMOTE_DIR + " && npm install --omit=dev 2>&1 | tail -3")

    # pm2 restart
    print("\n[*] Starting bot via pm2...")
    run(client, "pm2 delete roast-bot 2>/dev/null || true", ignore_error=True)
    run(client, "cd " + REMOTE_DIR + " && pm2 start ecosystem.config.js")
    run(client, "pm2 save")
    run(client, "pm2 startup systemd -u root --hp /root 2>/dev/null | tail -2", ignore_error=True)

    # Status
    print("\n[*] Bot status:")
    run(client, "pm2 status")

    print("\n[+] Deploy complete!")
    print("    Logs: ssh root@" + HOST + " 'pm2 logs roast-bot --lines 30'")
    client.close()

if __name__ == "__main__":
    main()
