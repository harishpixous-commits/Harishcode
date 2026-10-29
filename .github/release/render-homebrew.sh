#!/usr/bin/env bash
# render-homebrew.sh <sign-macos dir> <build-archives dir> <tap dir>: writes Formula harishcode-v2.rb with the
# hashes of the signed macOS and the Linux archives.
. "$(dirname "$0")/lib.sh"

macos=$1 archives=$2 tap=$3
sum() { sha256 "$1" | cut -c1-64; }
base="https://harishcode.ai/files/bin/$HARISHCODE_VERSION"
cat > "$tap/harishcode-v2.rb" <<FORMULA
# typed: false
# frozen_string_literal: true

class HarishcodeV2 < Formula
  desc "HarishCode V2 - the AI coding agent for the terminal"
  homepage "https://github.com/harishpixous-commits/Harishcode"
  version "$HARISHCODE_VERSION"
  license "MIT"

  depends_on "ripgrep"
  conflicts_with "harishcode", because: "both install an harishcode binary"

  on_macos do
    if Hardware::CPU.arm?
      url "$base/harishcode-darwin-arm64.zip"
      sha256 "$(sum "$macos/harishcode-darwin-arm64.zip")"
    else
      url "$base/harishcode-darwin-x64-baseline.zip"
      sha256 "$(sum "$macos/harishcode-darwin-x64-baseline.zip")"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      url "$base/harishcode-linux-arm64.tar.gz"
      sha256 "$(sum "$archives/harishcode-linux-arm64.tar.gz")"
    else
      url "$base/harishcode-linux-x64-baseline.tar.gz"
      sha256 "$(sum "$archives/harishcode-linux-x64-baseline.tar.gz")"
    end
  end

  def install
    bin.install "harishcode"
  end
end
FORMULA
cat "$tap/harishcode-v2.rb"
