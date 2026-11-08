#!/bin/sh
# PreToolUse guard for work on this repository.
# Reads the hook input (JSON) on stdin and blocks with exit 2 when the tool call
# looks destructive or touches secrets. The whole command is matched, so absolute
# paths (/bin/rm), shell wrappers (bash -c '...') and git global options
# (git -C . push) are caught as well as the plain forms.

input=$(cat)

# Only a shell command is screened for destructive patterns; for file tools only
# the path is checked, so editing docs that mention these commands still works.
case "$input" in
  *'"tool_name":"Bash"'* | *'"tool_name": "Bash"'*) cmd=$input ;;
  *) cmd= ;;
esac
paths=$(printf '%s' "$input" | grep -Eo '"(file_path|notebook_path|path)"[[:space:]]*:[[:space:]]*"[^"]*"')

block() {
  echo "Blocked by .claude/hooks/guard.sh: $1. Ask the maintainer to run it by hand if it is really needed." >&2
  exit 2
}

match() {
  printf '%s' "$cmd" | grep -Eq -- "$1"
}

# Destructive shell commands.
match '(^|[^[:alnum:]_-])rm[[:space:]]+(-[[:alpha:]]*[rR][[:alpha:]]*[[:space:]]+-?[[:alpha:]]*f|-[[:alpha:]]*f[[:alpha:]]*[[:space:]]+-?[[:alpha:]]*[rR]|-[[:alpha:]]*([rR][[:alpha:]]*f|f[[:alpha:]]*[rR]))' && block "rm -rf"
match '(^|[^[:alnum:]_-])rm[[:space:]].*--recursive' && block "rm --recursive"
match 'find[[:space:]].*(-delete|-exec[[:space:]]+rm)' && block "find -delete"
match 'git([[:space:]]+-[^[:space:]]+([[:space:]]+[^-[:space:]][^[:space:]]*)?)*[[:space:]]+push[[:space:]](.*[[:space:]])?(--force|-f([[:space:]]|$|\\|")|\+[^[:space:]])' && block "git push --force / -f / --force-with-lease"
match 'git([[:space:]]+-[^[:space:]]+([[:space:]]+[^-[:space:]][^[:space:]]*)?)*[[:space:]]+reset[[:space:]]+--hard' && block "git reset --hard"
match 'git([[:space:]]+-[^[:space:]]+([[:space:]]+[^-[:space:]][^[:space:]]*)?)*[[:space:]]+clean[[:space:]]+-[[:alpha:]]*f' && block "git clean -fdx"
match 'git([[:space:]]+-[^[:space:]]+([[:space:]]+[^-[:space:]][^[:space:]]*)?)*[[:space:]]+branch[[:space:]]+-D' && block "git branch -D"
match '(^|[^[:alnum:]_-])sudo[[:space:]]' && block "sudo"
match 'chmod[[:space:]]+-R[[:space:]]+777' && block "chmod -R 777"
match '(^|[^[:alnum:]_-])dd[[:space:]].*of=/dev/' && block "dd to a device"
match '(^|[^[:alnum:]_-])mkfs' && block "mkfs"
match '(curl|wget)[[:space:]].*\|[[:space:]]*(sudo[[:space:]]+)?(ba|z)?sh' && block "curl | sh"
match 'terraform[[:space:]]+destroy' && block "terraform destroy"
match 'kubectl[[:space:]]+delete' && block "kubectl delete"
match '(npm|pnpm|yarn)[[:space:]]+publish' && block "npm publish"
match '(DROP|drop)[[:space:]]+(TABLE|DATABASE|SCHEMA|table|database|schema)|(TRUNCATE|truncate)[[:space:]]' && block "DROP TABLE"

# Secrets: .env files (examples are fine), keys and credential stores.
secret() {
  printf '%s\n%s' "$cmd" "$paths" | grep -Eq -- "$1"
}
secret '(^|[[:space:]/"=:])\.env("|[[:space:]]|$|\.(local|development|production|test|prod|dev)([^[:alnum:]]|$))' && block "a .env file"
secret '\.(pem|key|p12|pfx)("|[[:space:]]|$)' && block "a key file (*.pem / *.key)"
secret '(\.ssh|\.aws|\.gnupg)/' && block "~/.ssh, ~/.aws or ~/.gnupg"
secret '(\.npmrc|\.netrc|\.pypirc)("|[[:space:]]|$)' && block ".npmrc / .netrc"
secret '(^|/|")credentials(\.json)?("|[[:space:]]|$)' && block "a credentials file"
secret 'id_(rsa|ed25519|ecdsa|dsa)' && block "an SSH key"

exit 0
