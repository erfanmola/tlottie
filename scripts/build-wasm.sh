#!/bin/sh
# Builds tlottie.wasm from the tlottie/ submodule (raw wasm32-unknown-unknown,
# no JS glue — see tlottie/src/bindings/wasm.rs) and copies it into
# src/core/tlottie.wasm, where the TS wasm loader (src/core/wasm.ts) expects it.
#
# Consumers of the built npm package never need a Rust toolchain: the wasm
# binary is committed as a source asset, this script is only for rebuilding
# it after pulling submodule updates or changing the Rust source.

set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repo_root=$(CDPATH= cd -- "$script_dir/.." && pwd)
submodule_dir="$repo_root/tlottie"
target=wasm32-unknown-unknown
profile=release

if [ ! -f "$submodule_dir/Cargo.toml" ]; then
  echo "error: tlottie/ submodule is not checked out (run: git submodule update --init)" >&2
  exit 1
fi

rustup_toolchain=""
if command -v rustup >/dev/null 2>&1; then
  rustup_toolchain=$(rustup show active-toolchain | awk 'NR == 1 { print $1 }')
  if ! rustup target list --toolchain "$rustup_toolchain" --installed | grep -qx "$target"; then
    echo "error: Rust target '$target' is not installed for '$rustup_toolchain'" >&2
    echo "install it with: rustup target add --toolchain $rustup_toolchain $target" >&2
    exit 1
  fi
fi

export CARGO_TARGET_DIR="$repo_root/target-wasm"
export RUSTFLAGS="${RUSTFLAGS:+$RUSTFLAGS }-C target-feature=+simd128"

build_cmd="cargo build --manifest-path $submodule_dir/Cargo.toml --target $target --profile $profile --no-default-features --features wasm"

if [ -n "$rustup_toolchain" ]; then
  # shellcheck disable=SC2086
  rustup run "$rustup_toolchain" $build_cmd
else
  # shellcheck disable=SC2086
  $build_cmd
fi

mkdir -p "$repo_root/src/core"
cp "$CARGO_TARGET_DIR/$target/$profile/tlottie.wasm" "$repo_root/src/core/tlottie.wasm"
echo "Built $repo_root/src/core/tlottie.wasm"
