#!/bin/zsh
set -eu
cd "$(dirname "$0")"
mkdir -p .local
if ! /usr/bin/curl --silent --fail http://127.0.0.1:4317/api/health >/dev/null 2>&1; then
  if [[ ! -d dist ]]; then
    /opt/homebrew/bin/npm run build
  fi
  # A normal per-user runtime avoids giving a background job access to Downloads.
  runtime_dir="$HOME/Library/Application Support/Scrollwork Studio"
  log_dir="$HOME/Library/Logs/Scrollwork Studio"
  mkdir -p "$runtime_dir" "$log_dir"
  /usr/bin/ditto dist "$runtime_dir/dist"
  /usr/bin/ditto server "$runtime_dir/server"
  /usr/bin/ditto node_modules "$runtime_dir/node_modules"
  cp package.json "$runtime_dir/package.json"
  # launchd owns the process so it survives the launching terminal or agent.
  /bin/launchctl remove local.scrollwork-studio >/dev/null 2>&1 || true
  /bin/launchctl submit -l local.scrollwork-studio -o "$log_dir/server.log" -e "$log_dir/server-error.log" -- /opt/homebrew/bin/node "$runtime_dir/server/index.js"
  for attempt in {1..50}; do
    if /usr/bin/curl --silent --fail http://127.0.0.1:4317/api/health >/dev/null 2>&1; then break; fi
    sleep 0.1
  done
fi
if ! /usr/bin/curl --silent --fail http://127.0.0.1:4317/api/health >/dev/null 2>&1; then
  echo 'Scrollwork Studio could not start. See ~/Library/Logs/Scrollwork Studio/server-error.log.'
  exit 1
fi
echo 'Scrollwork Studio is running at http://127.0.0.1:4317'
if [[ "${1:-}" != '--no-open' ]]; then /usr/bin/open http://127.0.0.1:4317; fi
