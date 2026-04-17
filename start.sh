#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR"

invoke_cmd() {
    echo ""
    echo -e "\033[36m>>> $*\033[0m"
    echo ""
    pushd "$REPO_ROOT" > /dev/null
    if "$@"; then
        popd > /dev/null
        return 0
    else
        local code=$?
        popd > /dev/null
        echo ""
        echo -e "\033[33mCommand exited with code $code\033[0m"
        echo ""
        return 1
    fi
}

show_node_info() {
    echo ""
    printf "%-16s: \033[32m%s\033[0m\n" "Node.js version" "$(node --version)"
    printf "%-16s: \033[32m%s\033[0m\n" "pnpm version" "$(pnpm --version)"
    if [ -d "$REPO_ROOT/node_modules" ]; then
        printf "%-16s: \033[32m%s\033[0m\n" "Dependencies" "installed"
    else
        printf "%-16s: \033[31m%s\033[0m\n" "Dependencies" "NOT installed (run option 1)"
    fi
    echo ""
}

while true; do
    echo ""
    echo -e "\033[36mCNSL Developer CLI\033[0m"
    echo -e "\033[36m==================\033[0m"
    echo ""
    echo -e "\033[33mSetup\033[0m"
    echo "  1) Install dependencies (pnpm install)"
    echo "  2) Clean build output"
    echo ""
    echo -e "\033[33mDevelop\033[0m"
    echo "  3) Start dev server (build + watch + live reload)"
    echo "  4) Build only (one-time)"
    echo ""
    echo -e "\033[33mVerify\033[0m"
    echo "  5) Show environment info"
    echo "  6) Run ESLint"
    echo "  7) Run ESLint with auto-fix"
    echo ""
    echo -e "\033[33mTests\033[0m"
    echo "  8) Run all tests"
    echo "  9) Run full checks (lint + tests)"
    echo ""
    echo -e "\033[33mMisc\033[0m"
    echo "  0) Exit"
    echo ""
    read -rp "Select an option: " choice

    case "$choice" in
        1) invoke_cmd pnpm install ;;
        2) invoke_cmd pnpm run clean ;;
        3) invoke_cmd pnpm start ;;
        4) invoke_cmd pnpm run build ;;
        5) show_node_info ;;
        6) invoke_cmd pnpm run lint ;;
        7) invoke_cmd pnpm run lint:fix ;;
        8) invoke_cmd pnpm test ;;
        9)
            echo ""
            echo -e "\033[35m--- Lint ---\033[0m"
            lint_ok=true
            invoke_cmd pnpm run lint || lint_ok=false

            echo ""
            echo -e "\033[35m--- Tests ---\033[0m"
            test_ok=true
            invoke_cmd pnpm test || test_ok=false

            echo ""
            echo -e "\033[36m=== Results ===\033[0m"
            if $lint_ok; then
                echo -e "  Lint:  \033[32mPASS\033[0m"
            else
                echo -e "  Lint:  \033[31mFAIL\033[0m"
            fi
            if $test_ok; then
                echo -e "  Tests: \033[32mPASS\033[0m"
            else
                echo -e "  Tests: \033[31mFAIL\033[0m"
            fi
            echo ""
            ;;
        0)
            echo ""
            echo -e "\033[32mGoodbye!\033[0m"
            echo ""
            exit 0
            ;;
        *) echo -e "\033[31mInvalid option. Please try again.\033[0m" ;;
    esac
done
