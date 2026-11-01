#!/bin/bash
set -euo pipefail

U=kou-runner
H=/Users/$U
R=$H/actions-runner
VER=2.338.0
TOKEN_FILE=/Users/admin/workdir/.kou-runner-token

[[ $EUID -eq 0 ]] || { echo "run with sudo" >&2; exit 1; }
[[ -s $TOKEN_FILE ]] || { echo "no registration token in $TOKEN_FILE" >&2; exit 1; }

if ! id "$U" >/dev/null 2>&1; then
  read -rsp "Пароль для нового пользователя $U: " PW; echo
  read -rsp "Ещё раз: " PW2; echo
  [[ -n $PW && $PW == "$PW2" ]] || { echo "пароли не совпали" >&2; exit 1; }
  sysadminctl -addUser "$U" -fullName "KOU runner" -password "$PW" -home "$H"
  createhomedir -c -u "$U" >/dev/null
  unset PW PW2
fi

mkdir -p "$R/_work"
if [[ ! -x $R/config.sh ]]; then
  curl -fsSL "https://github.com/actions/runner/releases/download/v$VER/actions-runner-osx-arm64-$VER.tar.gz" | tar xz -C "$R"
fi
if [[ ! -d $R/_work/kingofunderground ]]; then
  ditto /Users/admin/_work/kingofunderground "$R/_work/kingofunderground"
  rm -f "$R"/_work/kingofunderground/kingofunderground/docker-compose.*.yml
fi
printf '%s\n' "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin" > "$R/.path"
chown -R "$U":staff "$R"

if [[ ! -f $R/.runner ]]; then
  TOKEN="$(cat "$TOKEN_FILE")"
  sudo -u "$U" -H bash -c "cd '$R' && ./config.sh --unattended --url https://github.com/vadimptr/kingofunderground --token '$TOKEN' --name mac-mini-kou --work _work --replace"
  unset TOKEN
fi
rm -f "$TOKEN_FILE"
cp "$R/bin/runsvc.sh" "$R/runsvc.sh"
chown "$U":staff "$R/runsvc.sh"

SUDOERS=/etc/sudoers.d/kou-runner
printf '%s\n' "$U ALL=(admin) NOPASSWD: /Users/admin/workdir/deploy.sh kou master, /Users/admin/workdir/deploy.sh kou develop" > "$SUDOERS.tmp"
chmod 440 "$SUDOERS.tmp"
visudo -cf "$SUDOERS.tmp" >/dev/null
mv "$SUDOERS.tmp" "$SUDOERS"

PLIST=/Library/LaunchDaemons/actions.runner.kou.plist
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>actions.runner.kou</string>
    <key>ProgramArguments</key>
    <array>
      <string>$R/runsvc.sh</string>
    </array>
    <key>UserName</key>
    <string>$U</string>
    <key>GroupName</key>
    <string>staff</string>
    <key>WorkingDirectory</key>
    <string>$R</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$R/_diag/svc.stdout.log</string>
    <key>StandardErrorPath</key>
    <string>$R/_diag/svc.stderr.log</string>
    <key>EnvironmentVariables</key>
    <dict>
      <key>ACTIONS_RUNNER_SVC</key>
      <string>1</string>
      <key>HOME</key>
      <string>$H</string>
    </dict>
    <key>SessionCreate</key>
    <true/>
  </dict>
</plist>
EOF
chown root:wheel "$PLIST"
chmod 644 "$PLIST"
mkdir -p "$R/_diag"
chown "$U":staff "$R/_diag"

launchctl bootout system "$PLIST" 2>/dev/null || true
launchctl bootstrap system "$PLIST"

OLD=/Users/admin/Library/LaunchAgents/actions.runner.vadimptr-kingofunderground.mac_mini.plist
if [[ -f $OLD ]]; then
  launchctl bootout "gui/$(id -u admin)" "$OLD" 2>/dev/null || true
  mv "$OLD" "/Users/admin/workdir/old-runner-agent.plist.disabled"
fi

echo "готово: раннер mac-mini-kou запущен под $U, старый раннер под admin остановлен"
