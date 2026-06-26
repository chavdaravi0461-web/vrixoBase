#!/usr/bin/env pwsh
# VrixoBase - Maintenance Script
# Usage: .\scripts\maintenance.ps1 [command]

param(
    [Parameter(Position=0)]
    [ValidateSet("status","logs","prune","restart","vacuum","reindex","ping","help")]
    [string]$Command = "status"
)

function Write-Info { Write-Host "[INFO] $args" -ForegroundColor Green }
function Write-Error { Write-Host "[ERROR] $args" -ForegroundColor Red }

function Get-Container($filter) {
    return docker ps --filter "name=$filter" --format "{{.Names}}" | Select-Object -First 1
}

function Show-Status {
    Write-Info "System Status:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>$null
    Write-Output ""
    Write-Info "Resource Usage:"
    docker stats --no-stream 2>$null
    Write-Output ""
    Write-Info "Disk Usage:"
    docker system df 2>$null
}

function Show-Logs {
    $containers = docker ps --format "{{.Names}}" 2>$null
    $tail = 50
    foreach ($c in $containers) {
        Write-Info "Last $tail lines for $c:"
        docker logs --tail $tail $c 2>&1 | Select-Object -Last $tail
        Write-Output ""
    }
}

function Invoke-Prune {
    Write-Info "Pruning Docker system..."
    docker system prune -f 2>$null
    Write-Info "Pruning volumes..."
    docker volume prune -f 2>$null
    Write-Info "Prune complete"
}

function Invoke-Restart {
    Write-Info "Restarting all VrixoBase services..."
    $composeFile = "C:\vrixoBase\docker-compose.yml"
    if (Test-Path $composeFile) {
        docker compose -f $composeFile restart 2>$null
        Write-Info "Services restarted"
    } else {
        Write-Error "docker-compose.yml not found"
    }
}

function Invoke-Vacuum {
    Write-Info "Running PostgreSQL VACUUM ANALYZE..."
    $container = Get-Container "vrixo.*postgres"
    if (-not $container) { $container = Get-Container "postgres" }
    if ($container) {
        docker exec $container psql --username=vrixo --dbname=vrixo -c "VACUUM ANALYZE;" 2>$null
        Write-Info "VACUUM ANALYZE complete"
    } else { Write-Error "PostgreSQL container not found" }
}

function Invoke-Reindex {
    Write-Info "Running PostgreSQL REINDEX..."
    $container = Get-Container "vrixo.*postgres"
    if (-not $container) { $container = Get-Container "postgres" }
    if ($container) {
        docker exec $container psql --username=vrixo --dbname=vrixo -c "REINDEX DATABASE vrixo;" 2>$null
        Write-Info "REINDEX complete"
    } else { Write-Error "PostgreSQL container not found" }
}

function Test-Ping {
    Write-Info "Connectivity tests..."
    $targets = @(
        @{ Name="Backend"; Url="http://localhost:4000/api/health" }
        @{ Name="Frontend"; Url="http://localhost:3000" }
        @{ Name="MinIO"; Url="http://localhost:9000/minio/health/live" }
        @{ Name="Nginx"; Url="http://localhost/health" }
    )
    foreach ($t in $targets) {
        try {
            $res = Invoke-WebRequest -Uri $t.Url -UseBasicParsing -TimeoutSec 5
            Write-Info "$($t.Name): HTTP $($res.StatusCode)"
        } catch { Write-Error "$($t.Name): $($_.Exception.Message)" }
    }
}

switch ($Command) {
    "status" { Show-Status }
    "logs" { Show-Logs }
    "prune" { Invoke-Prune }
    "restart" { Invoke-Restart }
    "vacuum" { Invoke-Vacuum }
    "reindex" { Invoke-Reindex }
    "ping" { Test-Ping }
    "help" {
        Write-Output "Usage: .\scripts\maintenance.ps1 [command]"
        Write-Output "Commands:"
        Write-Output "  status   - Show container status, resource usage, disk usage"
        Write-Output "  logs     - Show last 50 lines of each container"
        Write-Output "  prune    - Clean up unused Docker resources"
        Write-Output "  restart  - Restart all VrixoBase services"
        Write-Output "  vacuum   - Run PostgreSQL VACUUM ANALYZE"
        Write-Output "  reindex  - Run PostgreSQL REINDEX DATABASE"
        Write-Output "  ping     - Test connectivity to all services"
    }
}
