#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: install.sh [--source SOURCE_DIR]

Install verify-docs into the current repository root. --source is intended for
local development and tests; normal use downloads the package from GitHub.
EOF
}

source_root=""
while (($#)); do
  case "$1" in
    --source)
      if (($# < 2)); then
        usage >&2
        exit 2
      fi
      source_root="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage >&2
      exit 2
      ;;
  esac
done

target_root="$PWD"
temp_root=""
prepared_root=""
cleanup() {
  if [[ -n "$temp_root" ]]; then
    rm -rf "$temp_root"
  fi
  if [[ -n "$prepared_root" ]]; then
    rm -rf "$prepared_root"
  fi
}
trap cleanup EXIT

if ! command -v node >/dev/null 2>&1; then
  echo "verify-docs requires Node.js 22.23.2 (Node 22). Node.js was not found." >&2
  exit 1
fi
node_version="$(node --version)"
if [[ ! "$node_version" =~ ^v([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
  echo "verify-docs requires Node.js 22.23.2 or later. Current version: $node_version" >&2
  exit 1
fi
node_major="${BASH_REMATCH[1]}"
node_minor="${BASH_REMATCH[2]}"
node_patch="${BASH_REMATCH[3]}"
if (( node_major < 22 ||
      (node_major == 22 && node_minor < 23) ||
      (node_major == 22 && node_minor == 23 && node_patch < 2) )); then
  echo "verify-docs requires Node.js 22.23.2 or later. Current version: $node_version" >&2
  exit 1
fi

if [[ -z "$source_root" ]]; then
  script_path="${BASH_SOURCE[0]:-}"
  if [[ -n "$script_path" && -f "$script_path" ]]; then
    script_dir="$(cd "$(dirname "$script_path")" && pwd)"
    if [[ -f "$script_dir/scripts/document-structure-verifier.mjs" ]]; then
      source_root="$script_dir"
    fi
  fi
  if [[ -z "$source_root" ]]; then
    source_repository="${VERIFY_DOCS_SOURCE_REPOSITORY:-MichinaoShimizu/verify-docs}"
    source_ref="${VERIFY_DOCS_SOURCE_REF:-main}"
    temp_root="$(mktemp -d)"
    archive="$temp_root/verify-docs.tar.gz"
    echo "Downloading verify-docs from $source_repository ($source_ref)..."
    curl -fsSL \
      "https://github.com/$source_repository/archive/refs/heads/$source_ref.tar.gz" \
      -o "$archive"
    tar -xzf "$archive" -C "$temp_root"
    source_file="$(find "$temp_root" -type f -path '*/scripts/document-structure-verifier.mjs' -print -quit)"
    if [[ -n "$source_file" ]]; then
      source_root="$(dirname "$(dirname "$source_file")")"
    fi
  fi
fi

if [[ ! -f "$source_root/scripts/document-structure-verifier.mjs" ]]; then
  echo "verify-docs source not found at: $source_root" >&2
  exit 1
fi

prepared_root="$(mktemp -d)"
echo "Preparing standalone skills..."
node "$source_root/scripts/prepare-skill-distribution.mjs" --output="$prepared_root" >/dev/null

files=(
  scripts/document-structure-verifier.mjs
  scripts/markdown-structure.mjs
  scripts/document-structure-extractor.mjs
  scripts/select-canonical.mjs
  scripts/evaluate-autonomous-output.mjs
  scripts/vendor
  .agents/skills/verify-docs
  .agents/skills/dedupe-docs
  .agents/skills/tighten-docs
)
bundled_skills=(
  verify-docs
  dedupe-docs
  tighten-docs
)

work_record_ignore='.verify-docs/dist/*.work.md'

item_source_root() {
  if [[ "$1" == .agents/skills/* ]]; then
    printf '%s\n' "$prepared_root"
  else
    printf '%s\n' "$source_root"
  fi
}

has_work_record_ignore() {
  local gitignore="$1"
  local entry

  [[ -f "$gitignore" ]] || return 1
  while IFS= read -r entry || [[ -n "$entry" ]]; do
    case "$entry" in
      "$work_record_ignore"|"/$work_record_ignore"|'.verify-docs/'|'/.verify-docs/'|'.verify-docs/**'|'/.verify-docs/**'|'.verify-docs/dist/'|'/.verify-docs/dist/'|'.verify-docs/dist/*'|'/.verify-docs/dist/*'|'.verify-docs/dist/**'|'/.verify-docs/dist/**'|'*.work.md'|'**/*.work.md')
        return 0
        ;;
    esac
  done < "$gitignore"
  return 1
}

ensure_work_record_ignore() {
  local gitignore="$target_root/.gitignore"

  if has_work_record_ignore "$gitignore"; then
    echo "Kept existing ignore rule for verify-docs temporary work records"
    return
  fi

  if [[ -s "$gitignore" ]]; then
    printf '\n' >> "$gitignore"
  fi
  printf '# verify-docs: temporary work records\n%s\n' "$work_record_ignore" >> "$gitignore"
  echo "Added ignore rule for verify-docs temporary work records"
}

ensure_default_config() {
  local source_config="$source_root/verify-docs.config.json"
  local target_config="$target_root/verify-docs.config.json"

  if [[ -e "$target_config" || -L "$target_config" ]]; then
    echo "Kept existing verify-docs configuration"
    return
  fi

  cp "$source_config" "$target_config"
  echo "Created verify-docs.config.json with default settings"
}

required_instruction_start='<!-- verify-docs:required-skill:start -->'
required_instruction_end='<!-- verify-docs:required-skill:end -->'
claude_import_start='<!-- verify-docs:agents-import:start -->'
claude_import_end='<!-- verify-docs:agents-import:end -->'

marker_pair_is_valid() {
  local path="$1"
  local start="$2"
  local end="$3"
  local starts=0
  local ends=0

  [[ -f "$path" ]] || return 0
  starts="$(grep -Fxc "$start" "$path" || true)"
  ends="$(grep -Fxc "$end" "$path" || true)"
  [[ "$starts" == "$ends" && "$starts" -le 1 ]]
}

validate_required_skill_instructions() {
  local agents="$target_root/AGENTS.md"
  local claude="$target_root/CLAUDE.md"

  if ! marker_pair_is_valid "$agents" "$required_instruction_start" "$required_instruction_end"; then
    echo "verify-docs installation stopped; AGENTS.md has an incomplete required-skill block." >&2
    exit 1
  fi
  if ! marker_pair_is_valid "$claude" "$claude_import_start" "$claude_import_end"; then
    echo "verify-docs installation stopped; CLAUDE.md has an incomplete verify-docs import block." >&2
    exit 1
  fi
}

ensure_required_skill_instruction() {
  local agents="$target_root/AGENTS.md"

  if [[ -f "$agents" ]] && grep -Fqx "$required_instruction_start" "$agents"; then
    echo "Kept required verify-docs instruction in AGENTS.md"
    return
  fi
  if [[ ! -e "$agents" ]]; then
    printf '# Agent Instructions\n' > "$agents"
  fi
  if [[ -s "$agents" ]]; then
    printf '\n' >> "$agents"
  fi
  printf '%s\n' "$required_instruction_start" >> "$agents"
  cat >> "$agents" <<'EOF'
## Markdown文書の変更

Markdown文書を追加・更新・削除・レビューする際は、必ず`verify-docs`を使う。変更後に
`node scripts/document-structure-verifier.mjs`を実行し、結果を報告する。文書の追加、移動、
分割、削除、複数文書の変更、または違反の是正は、verify-docsの完全是正手順に従う。

文書レビュー、複数のMarkdown文書の追加・更新・削除、または検証でサイズ超過・重複が
見つかった回は、`verify-docs`、`dedupe-docs`、`tighten-docs`、最終`verify-docs`の順に
実行する。dedupe-docsとtighten-docsは安全モードで意味を変えず、判断できない候補は
利用者へ質問する。

文書を変更した各工程の直後に`verify-docs`を再実行する。違反が残れば、その違反を生んだ
工程へ戻って是正し、通過するまで次の工程または完了報告へ進まない。

無駄を減らすレビューでは、dedupe-docsとtighten-docsの一巡を、文書の変更がなくなり
verify-docsが通過するまで繰り返す。同じ候補を繰り返しても変更できない、または判断が
必要な場合は利用者へ質問する。

Markdownが100文書以上ある場合、文書を100件以下の読解単位に分けて記録する。ただし
verify-docsによる機械検証は開始時と完了時に全件へ実行し、任意の抽出や一部の通過だけで
完了にしない。dedupe-docsの候補と判断は単一の作業記録へ集約し、読解単位をまたぐ候補も
比較する。
EOF
  printf '%s\n' "$required_instruction_end" >> "$agents"
  echo "Added required verify-docs instruction to AGENTS.md"
}

ensure_claude_agents_import() {
  local claude="$target_root/CLAUDE.md"

  if [[ -f "$claude" ]] && grep -Fqx "$claude_import_start" "$claude"; then
    echo "Kept AGENTS.md import in CLAUDE.md"
    return
  fi
  if [[ ! -e "$claude" ]]; then
    printf '%s\n@AGENTS.md\n%s\n' "$claude_import_start" "$claude_import_end" > "$claude"
  else
    if [[ -s "$claude" ]]; then
      printf '\n' >> "$claude"
    fi
    printf '%s\n@AGENTS.md\n%s\n' "$claude_import_start" "$claude_import_end" >> "$claude"
  fi
  echo "Added AGENTS.md import to CLAUDE.md"
}

conflicts=()
for item in "${files[@]}"; do
  item_root="$(item_source_root "$item")"
  if [[ -d "$item_root/$item" ]]; then
    while IFS= read -r -d '' source_file; do
      relative_path="${source_file#"$item_root/"}"
      target_file="$target_root/$relative_path"
      if [[ -e "$target_file" ]] && ! cmp -s "$source_file" "$target_file"; then
        conflicts+=("$relative_path")
      fi
    done < <(find "$item_root/$item" -type f -print0)
  else
    target_file="$target_root/$item"
    if [[ -e "$target_file" ]] && ! cmp -s "$item_root/$item" "$target_file"; then
      conflicts+=("$item")
    fi
  fi
done

if ((${#conflicts[@]})); then
  echo "verify-docs installation stopped; these files already exist with different contents:" >&2
  printf '  %s\n' "${conflicts[@]}" >&2
  echo "Review or move the conflicting files, then run the installer again." >&2
  exit 1
fi

validate_required_skill_instructions

skill_alias_conflicts=()
for agent_dir in .claude .kiro; do
  skills_dir="$target_root/$agent_dir/skills"
  if [[ -L "$skills_dir" ]]; then
    if [[ "$(readlink "$skills_dir")" == "../.agents/skills" ]]; then
      continue
    fi
    skill_alias_conflicts+=("$agent_dir/skills (different symbolic link)")
    continue
  fi
  if [[ -e "$skills_dir" && ! -d "$skills_dir" ]]; then
    skill_alias_conflicts+=("$agent_dir/skills (not a directory)")
    continue
  fi
  for skill in "${bundled_skills[@]}"; do
    alias="$skills_dir/$skill"
    expected="../../.agents/skills/$skill"
    if [[ -L "$alias" && "$(readlink "$alias")" == "$expected" ]]; then
      continue
    fi
    if [[ -e "$alias" || -L "$alias" ]]; then
      skill_alias_conflicts+=("$agent_dir/skills/$skill")
    fi
  done
done

if ((${#skill_alias_conflicts[@]})); then
  echo "verify-docs installation stopped; these skill paths cannot be replaced with package links:" >&2
  printf '  %s\n' "${skill_alias_conflicts[@]}" >&2
  echo "Move the conflicting paths, then run the installer again." >&2
  exit 1
fi

echo "Installing verify-docs files..."
for item in "${files[@]}"; do
  item_root="$(item_source_root "$item")"
  if [[ -d "$item_root/$item" ]]; then
    while IFS= read -r -d '' source_file; do
      relative_path="${source_file#"$item_root/"}"
      target_file="$target_root/$relative_path"
      if [[ ! -e "$target_file" ]]; then
        mkdir -p "$(dirname "$target_file")"
        cp "$source_file" "$target_file"
      fi
    done < <(find "$item_root/$item" -type f -print0)
  else
    target_file="$target_root/$item"
    if [[ ! -e "$target_file" ]]; then
      mkdir -p "$(dirname "$target_file")"
      cp "$item_root/$item" "$target_file"
    fi
  fi
done

ensure_work_record_ignore
ensure_default_config
ensure_required_skill_instruction
ensure_claude_agents_import

for agent_dir in .claude .kiro; do
  skills_dir="$target_root/$agent_dir/skills"
  if [[ -L "$skills_dir" && "$(readlink "$skills_dir")" == "../.agents/skills" ]]; then
    continue
  fi
  mkdir -p "$skills_dir"
  for skill in "${bundled_skills[@]}"; do
    if [[ -L "$skills_dir/$skill" ]] \
      && [[ "$(readlink "$skills_dir/$skill")" == "../../.agents/skills/$skill" ]]; then
      continue
    fi
    ln -s "../../.agents/skills/$skill" "$skills_dir/$skill"
  done
done

echo "Installed verify-docs into $target_root"
echo "Run: node scripts/document-structure-verifier.mjs"
