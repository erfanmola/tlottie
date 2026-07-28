#!/bin/sh
# Builds tlottie.wasm from the tlottie/ submodule (raw wasm32-unknown-unknown,
# no JS glue — see tlottie/src/bindings/wasm.rs), post-processes it with
# wasm-opt, and copies it into src/core/tlottie.wasm, where the TS wasm
# loader (src/core/wasm.ts) expects it.
#
# Consumers of the built npm package never need a Rust toolchain: the wasm
# binary is committed as a source asset, this script is only for rebuilding
# it after pulling submodule updates or changing the Rust source.
#
# Size/speed, measured on the current build (2026-07), 512x512, avg ms/frame:
#   cargo release profile (opt-level=3), untouched:   488 KB raw, 0.251ms/frame
#   + wasm-opt -Oz (this script):                      418 KB raw, 0.241ms/frame
#   [rejected] cargo release-size (opt-level=z)
#     + wasm-opt -Oz:                                  306 KB raw, 0.382ms/frame
# release-size (opt-level=z) gets ~37% smaller but is a real ~52% slower
# render path (worse codegen, not just DCE) — not worth it given both are
# already >2000fps theoretical, nowhere near a real bottleneck, and
# performance is the priority here. wasm-opt -Oz on the *release* profile
# gets a free ~14% size cut (pure DCE/strip) with no speed cost — that's
# what this script uses. The realistic wire size is smaller still: browsers
# negotiate gzip/brotli transparently over fetch(), so make sure whatever
# serves dist/tlottie.wasm sends Content-Encoding (most CDNs/static hosts do
# this automatically; a bare dev server might not).

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

built="$CARGO_TARGET_DIR/$target/$profile/tlottie.wasm"
mkdir -p "$repo_root/src/core"

if command -v bunx >/dev/null 2>&1; then
  bunx -p binaryen wasm-opt \
    -Oz \
    --enable-simd \
    --enable-nontrapping-float-to-int \
    --enable-bulk-memory \
    --enable-sign-ext \
    --enable-mutable-globals \
    --strip-debug \
    --strip-producers \
    --dce \
    --vacuum \
    "$built" \
    -o "$repo_root/src/core/tlottie.wasm"
else
  echo "warning: bunx not found, skipping wasm-opt — output will be larger than usual" >&2
  cp "$built" "$repo_root/src/core/tlottie.wasm"
fi

echo "Built $repo_root/src/core/tlottie.wasm ($(wc -c < "$repo_root/src/core/tlottie.wasm" | tr -d ' ') bytes)"
