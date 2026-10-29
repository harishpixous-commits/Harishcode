#!/usr/bin/env bash
# publish-homebrew.sh <sign-macos dir> <build-archives dir>: updates harishcode-v2 in harishpixous-commits/homebrew-tap over SSH
# with its write deploy key (HOMEBREW_TAP_DEPLOY_KEY) and registers the homebrew update artifact.
. "$(dirname "$0")/lib.sh"

if ! dry_run; then
  test -n "${HOMEBREW_TAP_DEPLOY_KEY:-}" || die "Missing HOMEBREW_TAP_DEPLOY_KEY"
  ssh_dir=$(mktemp -d)
  printf '%s\n' "$HOMEBREW_TAP_DEPLOY_KEY" > "$ssh_dir/key"
  chmod 600 "$ssh_dir/key"
  echo "github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl" > "$ssh_dir/known_hosts"
  export GIT_SSH_COMMAND="ssh -i $ssh_dir/key -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=$ssh_dir/known_hosts"
fi

push_git "git@github.com:harishpixous-commits/homebrew-tap.git" \
  "chore: update harishcode-v2 to $HARISHCODE_VERSION" bash "$release_dir/render-homebrew.sh" "$1" "$2"
publish_update cli homebrew '{"package": "harishpixous-commits/tap/harishcode-v2"}'
