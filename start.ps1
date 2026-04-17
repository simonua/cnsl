#!/usr/bin/env pwsh

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Set UTF-8 encoding for console output
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$ScriptDir = Split-Path -Path $MyInvocation.MyCommand.Path -Parent
$RepoRoot = $ScriptDir

function Invoke-Cmd {
    $flatArgs = @()
    foreach ($a in $args) {
        if ($a -is [System.Collections.IEnumerable] -and -not ($a -is [string])) {
            $flatArgs += $a
        } else {
            $flatArgs += $a
        }
    }

    Write-Host "`n>>> $($flatArgs -join ' ')`n" -ForegroundColor Cyan
    Push-Location $RepoRoot
    try {
        if ($flatArgs.Count -eq 0) {
            throw "No command specified"
        }

        $exe = $flatArgs[0]
        $cmdArgs = @()

        if ($flatArgs.Count -gt 1) {
            $cmdArgs = @($flatArgs[1..($flatArgs.Count - 1)])
        }

        $global:LASTEXITCODE = 0
        & $exe @cmdArgs | Out-Host
        $commandSucceeded = $?
        $exitCode = if ($commandSucceeded) { $LASTEXITCODE } else { [Math]::Max($LASTEXITCODE, 1) }
    }
    catch {
        Write-Host ""
        Write-Host "Command failed: $_" -ForegroundColor Red
        Write-Host ""
        return $false
    }
    finally {
        Pop-Location
    }

    if ($exitCode -ne 0) {
        Write-Host ""
        Write-Host "Command exited with code $exitCode" -ForegroundColor Yellow
        Write-Host ""
        return $false
    }

    return $true
}

function Show-NodeInfo {
    $w = 16
    Write-Host ""
    Write-Host ("Node.js version".PadRight($w) + ": ") -ForegroundColor White -NoNewline
    Write-Host "$(node --version)" -ForegroundColor Green
    Write-Host ("pnpm version".PadRight($w) + ": ") -ForegroundColor White -NoNewline
    Write-Host "$(pnpm --version)" -ForegroundColor Green

    $nodeModules = Join-Path $RepoRoot "node_modules"
    if (Test-Path $nodeModules) {
        Write-Host ("Dependencies".PadRight($w) + ": ") -ForegroundColor White -NoNewline
        Write-Host "installed" -ForegroundColor Green
    } else {
        Write-Host ("Dependencies".PadRight($w) + ": ") -ForegroundColor White -NoNewline
        Write-Host "NOT installed (run option 1)" -ForegroundColor Red
    }
    Write-Host ""
}

function Test-Pnpm {
    return [bool](Get-Command pnpm -ErrorAction SilentlyContinue)
}

while ($true) {
    Write-Host ""
    Write-Host "CNSL Developer CLI" -ForegroundColor Cyan
    Write-Host "==================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Setup" -ForegroundColor Yellow
    Write-Host "  1) Install dependencies (pnpm install)"
    Write-Host "  2) Clean build output"
    Write-Host ""
    Write-Host "Develop" -ForegroundColor Yellow
    Write-Host "  3) Start dev server (build + watch + live reload)"
    Write-Host "  4) Build only (one-time)"
    Write-Host ""
    Write-Host "Verify" -ForegroundColor Yellow
    Write-Host "  5) Show environment info"
    Write-Host "  6) Run ESLint"
    Write-Host "  7) Run ESLint with auto-fix"
    Write-Host ""
    Write-Host "Tests" -ForegroundColor Yellow
    Write-Host "  8) Run all tests"
    Write-Host "  9) Run full checks (lint + tests)"
    Write-Host ""
    Write-Host "Misc" -ForegroundColor Yellow
    Write-Host "  0) Exit"
    Write-Host ""
    $choice = Read-Host "Select an option"

    switch ($choice) {
        '1' {
            if (Test-Pnpm) {
                $null = Invoke-Cmd "pnpm" "install"
            } else {
                Write-Host ""
                Write-Host "pnpm is not installed. Install it with: npm install -g pnpm" -ForegroundColor Red
                Write-Host ""
            }
        }
        '2' {
            $null = Invoke-Cmd "pnpm" "run" "clean"
        }
        '3' {
            $null = Invoke-Cmd "pnpm" "start"
        }
        '4' {
            $null = Invoke-Cmd "pnpm" "run" "build"
        }
        '5' {
            Show-NodeInfo
        }
        '6' {
            $null = Invoke-Cmd "pnpm" "run" "lint"
        }
        '7' {
            $null = Invoke-Cmd "pnpm" "run" "lint:fix"
        }
        '8' {
            $null = Invoke-Cmd "pnpm" "test"
        }
        '9' {
            Write-Host ""
            Write-Host "--- Lint ---" -ForegroundColor Magenta
            $lintOk = Invoke-Cmd "pnpm" "run" "lint"

            Write-Host ""
            Write-Host "--- Tests ---" -ForegroundColor Magenta
            $testOk = Invoke-Cmd "pnpm" "test"

            Write-Host ""
            Write-Host "=== Results ===" -ForegroundColor Cyan
            if ($lintOk) {
                Write-Host "  Lint:  PASS" -ForegroundColor Green
            } else {
                Write-Host "  Lint:  FAIL" -ForegroundColor Red
            }
            if ($testOk) {
                Write-Host "  Tests: PASS" -ForegroundColor Green
            } else {
                Write-Host "  Tests: FAIL" -ForegroundColor Red
            }
            Write-Host ""
        }
        '0' {
            Write-Host ""
            Write-Host "Goodbye!" -ForegroundColor Green
            Write-Host ""
            exit 0
        }
        Default {
            Write-Host "Invalid option. Please try again." -ForegroundColor Red
        }
    }
}
