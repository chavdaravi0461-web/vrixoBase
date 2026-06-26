#!/usr/bin/env pwsh
# VrixoBase - Comprehensive Health Check
# Usage: .\scripts\health-check.ps1 [-Watch] [-Interval 10]

param(
    [switch]$Watch,
    [int]$Interval = 10
)

function Write-Info { Write-Host "[INFO] $args" -ForegroundColor Green }
function Write-Warn { Write-Host "[WARN] $args" -ForegroundColor Yellow }
function Write-Error { Write-Host "[ERROR] $args" -ForegroundColor Red }
function Write-Pass { Write-Host "  ✅ $args" -ForegroundColor Green }
function Write-Fail { Write-Host "  ❌ $args" -ForegroundColor Red }

function Test-DockerHealth {
    $healthy = 0; $total = 0
    docker ps --format "{{.Names}}\t{{.Status}}" | ForEach-Object {
        $parts = $_ -split "`t"
        $total++
        if ($parts[1] -match "healthy|Up ") { $healthy++ } else { Write-Fail "Container $($parts[0]): $($parts[1])" }
    }
    if ($total -eq $healthy) { Write-Pass "All containers healthy ($healthy/$total)" }
    else { Write-Warn "$healthy/$total containers healthy" }
}

function Test-ApiHealth {
    $endpoints = @(
        @{ Name="Liveness"; Url="http://localhost:4000/api/health/liveness"; Expect="alive" }
        @{ Name="Readiness"; Url="http://localhost:4000/api/health/readiness"; Expect="ready" }
        @{ Name="Startup"; Url="http://localhost:4000/api/health/startup"; Expect="started" }
        @{ Name="Simple"; Url="http://localhost:4000/api/health"; Expect="healthy" }
        @{ Name="Version"; Url="http://localhost:4000/api/health/version"; Expect="version" }
    )

    foreach ($ep in $endpoints) {
        try {
            $res = Invoke-WebRequest -Uri $ep.Url -UseBasicParsing -TimeoutSec 5
            if ($res.Content -match $ep.Expect) { Write-Pass "$($ep.Name): OK" }
            else { Write-Fail "$($ep.Name): unexpected response" }
        } catch { Write-Fail "$($ep.Name): $($_.Exception.Message)" }
    }

    # Dependency health (detailed)
    try {
        $dep = Invoke-WebRequest -Uri "http://localhost:4000/api/health/dependencies" -UseBasicParsing -TimeoutSec 15 | Select-Object -ExpandProperty Content | ConvertFrom-Json
        $dep.data.checks.PSObject.Properties | ForEach-Object {
            $name = $_.Name
            $status = $_.Value.status
            $latency = $_.Value.latencyMs
            if ($status -eq "healthy") { Write-Pass "$name ($latency ms)" }
            elseif ($status -eq "degraded") { Write-Warn "$name: DEGRADED ($($_.Value.error))" }
            else { Write-Fail "$name: $status ($($_.Value.error))" }
        }
    } catch { Write-Fail "Dependencies endpoint: $($_.Exception.Message)" }
}

function Test-FrontendHealth {
    try {
        $res = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 5
        $status = if ($res.StatusCode -eq 200) { Write-Pass "Frontend: OK (HTTP $($res.StatusCode))" } else { Write-Fail "Frontend: HTTP $($res.StatusCode)" }
    } catch { Write-Warn "Frontend: Not available ($($_.Exception.Message))" }
}

function Test-NginxHealth {
    try {
        $res = Invoke-WebRequest -Uri "http://localhost/health" -UseBasicParsing -TimeoutSec 5
        if ($res.Content -match "healthy") { Write-Pass "Nginx: OK" } else { Write-Warn "Nginx: unexpected response" }
    } catch { Write-Warn "Nginx: Not available ($($_.Exception.Message))" }
}

function Test-PostgresHealth {
    try {
        $container = docker ps --filter "name=vrixo.*postgres" --format "{{.Names}}" | Select-Object -First 1
        if (-not $container) { $container = docker ps --filter "name=postgres" --format "{{.Names}}" | Select-Object -First 1 }
        if ($container) {
            $result = docker exec $container pg_isready -U vrixo -d vrixo 2>$null
            if ($result -match "accepting connections") { Write-Pass "PostgreSQL: accepting connections" }
            else { Write-Fail "PostgreSQL: $result" }
        } else { Write-Warn "PostgreSQL container not found" }
    } catch { Write-Fail "PostgreSQL check failed" }
}

function Test-RedisHealth {
    try {
        $container = docker ps --filter "name=vrixo.*redis" --format "{{.Names}}" | Select-Object -First 1
        if (-not $container) { $container = docker ps --filter "name=redis" --format "{{.Names}}" | Select-Object -First 1 }
        if ($container) {
            $ping = docker exec $container redis-cli PING 2>$null
            if ($ping -eq "PONG") { Write-Pass "Redis: PONG" } else { Write-Fail "Redis: $ping" }
        } else { Write-Warn "Redis container not found" }
    } catch { Write-Fail "Redis check failed" }
}

function Test-MinioHealth {
    try {
        $container = docker ps --filter "name=vrixo.*minio" --format "{{.Names}}" | Select-Object -First 1
        if (-not $container) { $container = docker ps --filter "name=minio" --format "{{.Names}}" | Select-Object -First 1 }
        if ($container) {
            $status = docker exec $container curl -sf -o /dev/null -w "%{http_code}" http://localhost:9000/minio/health/live 2>$null
            if ($status -eq "200") { Write-Pass "MinIO: healthy" } else { Write-Fail "MinIO: HTTP $status" }
        } else { Write-Warn "MinIO container not found" }
    } catch { Write-Fail "MinIO check failed" }
}

do {
    Clear-Host
    Write-Output "========================================="
    Write-Output "  VrixoBase - Health Check"
    Write-Output "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    Write-Output "========================================="
    Write-Output ""

    Write-Info "Docker Containers..."
    Test-DockerHealth
    Write-Output ""

    Write-Info "Backend API Health..."
    Test-ApiHealth
    Write-Output ""

    Write-Info "Database..."
    Test-PostgresHealth
    Write-Output ""

    Write-Info "Redis..."
    Test-RedisHealth
    Write-Output ""

    Write-Info "MinIO Storage..."
    Test-MinioHealth
    Write-Output ""

    Write-Info "Frontend..."
    Test-FrontendHealth
    Write-Output ""

    Write-Info "Nginx Reverse Proxy..."
    Test-NginxHealth

    if ($Watch) {
        Write-Output ""
        Write-Info "Watching every ${Interval}s... (Ctrl+C to stop)"
        Start-Sleep -Seconds $Interval
    }
} while ($Watch)
