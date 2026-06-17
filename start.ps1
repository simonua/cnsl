#!/usr/bin/env pwsh

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$ScriptDir = Split-Path -Path $MyInvocation.MyCommand.Path -Parent
$RepoRoot = $ScriptDir

function Invoke-Cmd {
    param(
        [Parameter(Mandatory, Position = 0)]
        [string] $Executable,

        [Parameter(Position = 1, ValueFromRemainingArguments = $true)]
        [string[]] $Arguments
    )

    $displayCommand = (@($Executable) + $Arguments) -join ' '
    Write-Host "`n>>> $displayCommand`n" -ForegroundColor Cyan
    Push-Location $RepoRoot
    try {
        $global:LASTEXITCODE = 0
        & $Executable @Arguments | Out-Host
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

function Test-Tool {
    param([Parameter(Mandatory)][string] $Name)

    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Write-StatusLine {
    param(
        [Parameter(Mandatory)][string] $Label,
        [Parameter(Mandatory)][string] $Value,
        [ConsoleColor] $Color = [ConsoleColor]::Green
    )

    Write-Host ($Label.PadRight(18) + ': ') -ForegroundColor White -NoNewline
    Write-Host $Value -ForegroundColor $Color
}

function Test-DevServer {
    $client = [System.Net.Sockets.TcpClient]::new()
    try {
        $connection = $client.ConnectAsync('127.0.0.1', 9090)
        return $connection.Wait(250) -and $client.Connected
    }
    catch {
        return $false
    }
    finally {
        $client.Dispose()
    }
}

function Show-EnvironmentInfo {
    Write-Host ""
    Write-Host "Local environment" -ForegroundColor Cyan
    Write-Host "-----------------" -ForegroundColor Cyan
    Write-StatusLine 'Repository' $RepoRoot
    Write-StatusLine 'PowerShell' $PSVersionTable.PSVersion.ToString()

    if (Test-Tool 'node') {
        Write-StatusLine 'Node.js' ((& node --version) | Out-String).Trim()
    }
    else {
        Write-StatusLine 'Node.js' 'not found (Node.js 24 or newer is required)' Red
    }

    if (Test-Tool 'pnpm') {
        Write-StatusLine 'pnpm' ((& pnpm --version) | Out-String).Trim()
    }
    else {
        Write-StatusLine 'pnpm' 'not found' Red
    }

    $nodeModules = Join-Path $RepoRoot 'node_modules'
    if (Test-Path $nodeModules) {
        Write-StatusLine 'Dependencies' 'installed'
    } else {
        Write-StatusLine 'Dependencies' 'not installed (run option 2)' Red
    }

    if (Test-Path (Join-Path $RepoRoot 'out')) {
        Write-StatusLine 'Build output' 'present'
    }
    else {
        Write-StatusLine 'Build output' 'not built' Yellow
    }

    if (Test-DevServer) {
        Write-StatusLine 'Dev server' 'running at http://localhost:9090/'
    }
    else {
        Write-StatusLine 'Dev server' 'not running' Yellow
    }

    if (Test-Tool 'git') {
        $branch = ((& git branch --show-current 2>$null) | Out-String).Trim()
        if ($branch) {
            Write-StatusLine 'Git branch' $branch
        }
    }

    Write-Host ""
}

function Invoke-CheckSuite {
    param(
        [Parameter(Mandatory)][string] $Title,
        [Parameter(Mandatory)][object[]] $Steps,
        [switch] $StopOnFailure
    )

    $results = [System.Collections.Generic.List[object]]::new()
    Write-Host "`n=== $Title ===" -ForegroundColor Magenta

    foreach ($step in $Steps) {
        $stepArguments = [string[]] $step.Arguments
        $passed = Invoke-Cmd $step.Executable @stepArguments
        $results.Add([PSCustomObject]@{ Name = $step.Name; Passed = $passed })

        if (-not $passed -and $StopOnFailure) {
            Write-Host "Stopping because $($step.Name) failed." -ForegroundColor Yellow
            break
        }
    }

    Write-Host "`n=== Results ===" -ForegroundColor Cyan
    foreach ($result in $results) {
        $status = if ($result.Passed) { 'PASS' } else { 'FAIL' }
        $color = if ($result.Passed) { 'Green' } else { 'Red' }
        Write-Host ("  {0,-22} {1}" -f $result.Name, $status) -ForegroundColor $color
    }
    Write-Host ""

    return -not ($results.Passed -contains $false)
}

function Invoke-FocusedTest {
    Write-Host ""
    $testInput = Read-Host 'Test file (for example, tests/services/data-manager.test.js)'
    if ([string]::IsNullOrWhiteSpace($testInput)) {
        Write-Host 'No test file selected.' -ForegroundColor Yellow
        return
    }

    $candidate = $testInput.Trim().Trim('"').Trim("'")
    if (-not [System.IO.Path]::IsPathRooted($candidate)) {
        $candidate = Join-Path $RepoRoot $candidate
    }

    try {
        $testPath = (Resolve-Path -LiteralPath $candidate -ErrorAction Stop).Path
        $testsRoot = (Resolve-Path -LiteralPath (Join-Path $RepoRoot 'tests')).Path
    }
    catch {
        Write-Host "Test file not found: $testInput" -ForegroundColor Red
        return
    }

    $isTestFile = $testPath.EndsWith('.test.js', [System.StringComparison]::OrdinalIgnoreCase)
    $isInTests = $testPath.StartsWith($testsRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)
    if (-not $isTestFile -or -not $isInTests) {
        Write-Host 'Choose a *.test.js file inside the tests directory.' -ForegroundColor Red
        return
    }

    $null = Invoke-Cmd 'node' '--test' $testPath
}

while ($true) {
    Write-Host ""
    Write-Host "CNSL Developer CLI" -ForegroundColor Cyan
    Write-Host "==================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Setup" -ForegroundColor Yellow
    Write-Host "  1) Show local environment"
    Write-Host "  2) Install dependencies"
    Write-Host "  u) Update dependencies"
    Write-Host ""
    Write-Host "Develop" -ForegroundColor Yellow
    Write-Host "  3) Start live-reload server (Ctrl+C to return)"
    Write-Host "  4) Start one-time build and server"
    Write-Host "  5) Build once"
    Write-Host "  c) Clean build output"
    Write-Host ""
    Write-Host "Verify" -ForegroundColor Yellow
    Write-Host "  6) Run quick checks (lint + choose affected unit test)"
    Write-Host "  7) Run release checks"
    Write-Host "  l) Run ESLint"
    Write-Host "  f) Run ESLint with auto-fix"
    Write-Host "  d) Validate active-season data"
    Write-Host "  p) Build and verify PWA output"
    Write-Host ""
    Write-Host "Tests" -ForegroundColor Yellow
    Write-Host "  8) Run all unit tests (explicit full-suite investigation)"
    Write-Host "  9) Run full unit coverage (explicit full-suite investigation)"
    Write-Host "  t) Run one unit-test file"
    Write-Host "  b) Run browser and accessibility tests"
    Write-Host ""
    Write-Host "Performance" -ForegroundColor Yellow
    Write-Host "  m) Measure local route and PWA performance"
    Write-Host ""
    Write-Host "Misc" -ForegroundColor Yellow
    Write-Host "  g) Show Git status"
    Write-Host "  0) Exit"
    Write-Host ""
    $choice = (Read-Host "Select an option").Trim().ToLowerInvariant()

    switch ($choice) {
        '1' {
            Show-EnvironmentInfo
        }
        '2' {
            $null = Invoke-Cmd 'pnpm' 'install'
        }
        'u' {
            $null = Invoke-Cmd 'pnpm' 'update'
        }
        '3' {
            $null = Invoke-Cmd 'pnpm' 'start'
        }
        '4' {
            $null = Invoke-Cmd 'pnpm' 'run' 'start:simple'
        }
        '5' {
            $null = Invoke-Cmd 'pnpm' 'run' 'build'
        }
        'c' {
            $null = Invoke-Cmd 'pnpm' 'run' 'clean'
        }
        '6' {
            if (Invoke-Cmd 'pnpm' 'run' 'lint') {
                Invoke-FocusedTest
            }
        }
        '7' {
            $steps = @(
                [PSCustomObject]@{ Name = 'Lint'; Executable = 'pnpm'; Arguments = @('run', 'lint') }
                [PSCustomObject]@{ Name = 'Season data'; Executable = 'pnpm'; Arguments = @('run', 'validate:data') }
                [PSCustomObject]@{ Name = 'Dependency audit'; Executable = 'pnpm'; Arguments = @('audit', '--audit-level', 'high') }
                [PSCustomObject]@{ Name = 'Build'; Executable = 'pnpm'; Arguments = @('run', 'build') }
                [PSCustomObject]@{ Name = 'PWA output'; Executable = 'pnpm'; Arguments = @('run', 'verify:pwa') }
            )
            $null = Invoke-CheckSuite 'Release checks' $steps -StopOnFailure
            Write-Host 'Run each affected unit-test file and browser ID separately for this release candidate.' -ForegroundColor Yellow
        }
        'l' {
            $null = Invoke-Cmd 'pnpm' 'run' 'lint'
        }
        'f' {
            $null = Invoke-Cmd 'pnpm' 'run' 'lint:fix'
        }
        'd' {
            $null = Invoke-Cmd 'pnpm' 'run' 'validate:data'
        }
        'p' {
            $steps = @(
                [PSCustomObject]@{ Name = 'Build'; Executable = 'pnpm'; Arguments = @('run', 'build') }
                [PSCustomObject]@{ Name = 'PWA output'; Executable = 'pnpm'; Arguments = @('run', 'verify:pwa') }
            )
            $null = Invoke-CheckSuite 'PWA verification' $steps -StopOnFailure
        }
        '8' {
            $null = Invoke-Cmd 'pnpm' 'test'
        }
        '9' {
            $null = Invoke-Cmd 'pnpm' 'run' 'test:coverage'
        }
        't' {
            Invoke-FocusedTest
        }
        'b' {
            $null = Invoke-Cmd 'pnpm' 'run' 'test:browser:nightly'
        }
        'm' {
            $null = Invoke-Cmd 'pnpm' 'run' 'measure:performance'
        }
        'g' {
            $null = Invoke-Cmd 'git' 'status' '--short' '--branch'
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
