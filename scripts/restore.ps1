#!/usr/bin/env pwsh
# VrixoBase - Enhanced Restore Script (PowerShell)
# Usage: .\scripts\restore.ps1 -BackupDir <path> [-DecryptionKey <hex>] [-Type full|table|project] [-ProjectId <id>] [-TableName <name>]

param(
    [Parameter(Mandatory=$true, Position=0)]
    [string]$BackupDir,
    [string]$DecryptionKey = $env:BACKUP_ENCRYPTION_KEY,
    [ValidateSet("full","table","project")]
    [string]$Type = "full",
    [string]$ProjectId,
    [string]$TableName,
    [switch]$Force
)

Write-Output "========================================="
Write-Output "  VrixoBase - Restore"
Write-Output "  Source:  $BackupDir"
Write-Output "  Type:    $Type"
Write-Output "========================================="
Write-Output ""

function Write-Info { Write-Host "[INFO] $args" -ForegroundColor Green }
function Write-Warn { Write-Host "[WARN] $args" -ForegroundColor Yellow }
function Write-Error { Write-Host "[ERROR] $args" -ForegroundColor Red }

# Validate backup directory
if (-not (Test-Path $BackupDir)) {
    Write-Error "Backup directory not found: $BackupDir"
    exit 1
}

# Decrypt files if needed
function Invoke-Decrypt {
    $encFiles = Get-ChildItem -Path $BackupDir -Filter "*.enc"
    if ($encFiles.Count -eq 0) { return }

    if (-not $DecryptionKey) {
        Write-Error "Encrypted backup found but no decryption key provided"
        exit 1
    }

    Write-Info "Decrypting backup files..."
    foreach ($file in $encFiles) {
        $decFile = $file.FullName -replace '\.enc$', ''
        & openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 -in $file.FullName -out $decFile -pass "pass:$DecryptionKey" 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Info "  Decrypted: $($file.Name)"
        } else {
            Write-Error "  Decryption failed: $($file.Name)"
        }
    }
}

# Verify integrity
function Test-Integrity {
    Write-Info "Verifying backup integrity..."

    $checksumFile = Join-Path $BackupDir "checksums.sha256"
    if (-not (Test-Path $checksumFile)) {
        Write-Warn "No checksums file found, skipping verification"
        return
    }

    $failed = $false
    Get-Content $checksumFile | ForEach-Object {
        $parts = $_ -split '\s+'
        if ($parts.Count -ge 2) {
            $expectedHash = $parts[0]
            $fileName = $parts[1]
            $filePath = Join-Path $BackupDir $fileName
            if (Test-Path $filePath) {
                $actualHash = (Get-FileHash -Path $filePath -Algorithm SHA256).Hash
                if ($expectedHash -ne $actualHash) {
                    Write-Error "  Checksum MISMATCH: $fileName"
                    $failed = $true
                }
            }
        }
    }

    if ($failed) { exit 1 }
    Write-Info "  Integrity verified"
}

function Get-ContainerName($filter) {
    return docker ps --filter "name=$filter" --format "{{.Names}}" | Select-Object -First 1
}

# Full restore
function Restore-Full {
    Write-Info "Performing FULL restore..."

    # PostgreSQL
    $dumpFile = Join-Path $BackupDir "postgres_full.dump"
    if (Test-Path $dumpFile) {
        Write-Info "  Restoring PostgreSQL..."
        $container = Get-ContainerName "vrixo.*postgres"
        if (-not $container) { $container = Get-ContainerName "postgres" }

        if ($container) {
            docker cp $dumpFile "${container}:/tmp/restore_full.dump"
            Write-Info "  Dropping existing data..."
            docker exec $container psql --username=vrixo --dbname=vrixo -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" 2>$null
            Write-Info "  Restoring from dump..."
            docker exec $container pg_restore --username=vrixo --dbname=vrixo --clean --if-exists --no-owner --no-privileges "/tmp/restore_full.dump"
            docker exec $container rm -f "/tmp/restore_full.dump"
            Write-Info "  PostgreSQL restore complete"
        } else {
            Write-Error "PostgreSQL container not found"
        }
    }

    # Redis
    $rdbFile = Join-Path $BackupDir "redis.rdb"
    if (Test-Path $rdbFile) {
        Write-Info "  Restoring Redis..."
        $container = Get-ContainerName "vrixo.*redis"
        if (-not $container) { $container = Get-ContainerName "redis" }
        if ($container) {
            docker exec $container redis-cli FLUSHALL 2>$null
            docker cp $rdbFile "${container}:/data/dump.rdb"
            docker exec $container redis-cli SHUTDOWN NOSAVE 2>$null
            Start-Sleep -Seconds 2
            docker restart $container 2>$null
            Write-Info "  Redis restore initiated (data loads on startup)"
        }
    }

    # MinIO
    $minioFile = Join-Path $BackupDir "minio.tar.gz"
    if (Test-Path $minioFile) {
        Write-Info "  Restoring MinIO..."
        $container = Get-ContainerName "vrixo.*minio"
        if (-not $container) { $container = Get-ContainerName "minio" }
        if ($container) {
            docker cp $minioFile "${container}:/tmp/restore_minio.tar.gz"
            docker exec $container rm -rf /data/*
            docker exec $container tar xzf "/tmp/restore_minio.tar.gz" -C /data
            docker exec $container rm -f "/tmp/restore_minio.tar.gz"
            Write-Info "  MinIO restore complete"
            # Restart MinIO to pick up restored data
            docker restart $container 2>$null
        }
    }

    # Verify recovery
    Write-Info "Verifying recovery..."
    Invoke-RecoveryVerification
}

# Table-level restore
function Restore-Table {
    if (-not $TableName) { Write-Error "TableName required for table-level restore"; exit 1 }

    $dumpFile = Join-Path $BackupDir "postgres_full.dump"
    if (-not (Test-Path $dumpFile)) {
        Write-Error "PostgreSQL dump not found for table-level restore"
        return
    }

    Write-Info "Restoring table: $TableName"
    $container = Get-ContainerName "vrixo.*postgres"
    if (-not $container) { $container = Get-ContainerName "postgres" }
    if (-not $container) { Write-Error "PostgreSQL container not found"; return }

    docker cp $dumpFile "${container}:/tmp/restore_table.dump"
    # pg_restore can restore individual tables with -t flag
    docker exec $container pg_restore --username=vrixo --dbname=vrixo --clean --if-exists --no-owner --no-privileges -t "$TableName" "/tmp/restore_table.dump"
    docker exec $container rm -f "/tmp/restore_table.dump"

    Write-Info "  Table '$TableName' restore complete"
}

# Project-level restore (restore schema for a specific project namespace)
function Restore-Project {
    if (-not $ProjectId) { Write-Error "ProjectId required for project-level restore"; exit 1 }

    $dumpFile = Join-Path $BackupDir "postgres_full.dump"
    if (-not (Test-Path $dumpFile)) {
        Write-Error "PostgreSQL dump not found"
        return
    }

    $schemaName = "proj_$ProjectId"
    Write-Info "Restoring schema: $schemaName"
    $container = Get-ContainerName "vrixo.*postgres"
    if (-not $container) { $container = Get-ContainerName "postgres" }
    if (-not $container) { Write-Error "PostgreSQL container not found"; return }

    docker cp $dumpFile "${container}:/tmp/restore_proj.dump"
    # Drop and recreate project schema, then restore with schema filter
    docker exec $container psql --username=vrixo --dbname=vrixo -c "DROP SCHEMA IF EXISTS $schemaName CASCADE; CREATE SCHEMA $schemaName;" 2>$null
    docker exec $container pg_restore --username=vrixo --dbname=vrixo --no-owner --no-privileges --schema="$schemaName" "/tmp/restore_proj.dump"
    docker exec $container rm -f "/tmp/restore_proj.dump"

    Write-Info "  Project '$ProjectId' restore complete"
}

# Recovery verification
function Invoke-RecoveryVerification {
    Write-Info "PostgreSQL recovery verification..."
    $container = Get-ContainerName "vrixo.*postgres"
    if (-not $container) { $container = Get-ContainerName "postgres" }
    if ($container) {
        $tableCount = docker exec $container psql --username=vrixo --dbname=vrixo -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" 2>$null
        Write-Info "  Tables restored: $($tableCount.Trim())"
    }

    Write-Info "Redis recovery verification..."
    $redisContainer = Get-ContainerName "vrixo.*redis"
    if (-not $redisContainer) { $redisContainer = Get-ContainerName "redis" }
    if ($redisContainer) {
        $ping = docker exec $redisContainer redis-cli PING 2>$null
        Write-Info "  Redis response: $ping"
    }

    Write-Info "MinIO recovery verification..."
    $minioContainer = Get-ContainerName "vrixo.*minio"
    if (-not $minioContainer) { $minioContainer = Get-ContainerName "minio" }
    if ($minioContainer) {
        $status = docker exec $minioContainer curl -sf http://localhost:9000/minio/health/live 2>$null
        Write-Info "  MinIO health: $($status ? 'healthy' : 'check failed')"
    }
}

# Main
Invoke-Decrypt
Test-Integrity

if (-not $Force) {
    Write-Warn "WARNING: This will OVERWRITE existing data!"
    $confirm = Read-Host "Are you sure you want to continue? [y/N] "
    if ($confirm -notmatch '^[yY]') {
        Write-Info "Restore cancelled."
        exit 0
    }
}

switch ($Type) {
    "full" { Restore-Full }
    "table" { Restore-Table }
    "project" { Restore-Project }
    default { Restore-Full }
}

Write-Output ""
Write-Output "========================================="
Write-Output "[INFO]  Restore complete!"
Write-Output "========================================="
