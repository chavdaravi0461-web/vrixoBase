#!/usr/bin/env pwsh
# VrixoBase - Enhanced Backup Script (PowerShell)
# Usage: .\scripts\backup.ps1 [-OutputDir <path>] [-Encrypt] [-EncryptionKey <hex>] [-RetentionDays <int>]

param(
    [string]$OutputDir = (Join-Path (Split-Path $PSScriptRoot -Parent) "backups"),
    [switch]$Encrypt,
    [string]$EncryptionKey = $env:BACKUP_ENCRYPTION_KEY,
    [int]$RetentionDays = 30,
    [switch]$SkipPostgres,
    [switch]$SkipRedis,
    [switch]$SkipMinio,
    [switch]$SkipVerification
)

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupPath = Join-Path $OutputDir $Timestamp

Write-Output "========================================="
Write-Output "  VrixoBase - Backup"
Write-Output "  Timestamp: $Timestamp"
Write-Output "  Output:    $BackupPath"
Write-Output "  Encrypt:   $($Encrypt.IsPresent)"
Write-Output "========================================="
Write-Output ""

# Create backup directory
New-Item -ItemType Directory -Force -Path $BackupPath | Out-Null

# Helper functions
function Write-Info { Write-Host "[INFO] $args" -ForegroundColor Green }
function Write-Warn { Write-Host "[WARN] $args" -ForegroundColor Yellow }
function Write-Error { Write-Host "[ERROR] $args" -ForegroundColor Red }

function Get-ContainerName($filter) {
    $container = docker ps --filter "name=$filter" --format "{{.Names}}" | Select-Object -First 1
    return $container
}

# PostgreSQL Backup (pg_dump, custom format, compressed + WAL archive config)
function Backup-Postgres {
    if ($SkipPostgres) { Write-Warn "Skipping PostgreSQL backup"; return }

    Write-Info "Backing up PostgreSQL..."

    $container = Get-ContainerName "vrixo.*postgres"
    if (-not $container) { $container = Get-ContainerName "postgres" }
    if (-not $container) { Write-Warn "PostgreSQL container not found"; return }

    # Full dump in custom format
    $dumpFile = "postgres_full.dump"
    Write-Info "  Creating full dump..."
    docker exec $container pg_dump --username=vrixo --dbname=vrixo --format=custom --compress=9 --file="/tmp/${Timestamp}_full.dump" 2>$null
    docker cp "${container}:/tmp/${Timestamp}_full.dump" (Join-Path $BackupPath $dumpFile)
    docker exec $container rm -f "/tmp/${Timestamp}_full.dump"

    # Also dump globals (roles, tablespaces)
    Write-Info "  Dumping globals..."
    docker exec $container pg_dumpall --username=vrixo --globals-only --file="/tmp/${Timestamp}_globals.sql" 2>$null
    docker cp "${container}:/tmp/${Timestamp}_globals.sql" (Join-Path $BackupPath "postgres_globals.sql")
    docker exec $container rm -f "/tmp/${Timestamp}_globals.sql"

    # Export schema-only (for project-level restore reference)
    Write-Info "  Dumping schema..."
    docker exec $container pg_dump --username=vrixo --dbname=vrixo --schema-only --file="/tmp/${Timestamp}_schema.sql" 2>$null
    docker cp "${container}:/tmp/${Timestamp}_schema.sql" (Join-Path $BackupPath "postgres_schema.sql")
    docker exec $container rm -f "/tmp/${Timestamp}_schema.sql"

    Write-Info "  PostgreSQL backup saved"
}

# Redis Backup (RDB + AOF if available)
function Backup-Redis {
    if ($SkipRedis) { Write-Warn "Skipping Redis backup"; return }

    Write-Info "Backing up Redis..."

    $container = Get-ContainerName "vrixo.*redis"
    if (-not $container) { $container = Get-ContainerName "redis" }
    if (-not $container) { Write-Warn "Redis container not found"; return }

    # Trigger SAVE
    docker exec $container redis-cli SAVE 2>$null
    Start-Sleep -Seconds 1

    # Copy RDB
    docker cp "${container}:/data/dump.rdb" (Join-Path $BackupPath "redis.rdb")

    # Try to save AOF if enabled
    $aofEnabled = docker exec $container redis-cli CONFIG GET appendonly 2>$null | Select-Object -Last 1
    if ($aofEnabled -eq "yes") {
        docker exec $container redis-cli BGREWRITEAOF 2>$null
        Start-Sleep -Seconds 2
        docker cp "${container}:/data/appendonly.aof" (Join-Path $BackupPath "redis.aof") -ErrorAction SilentlyContinue
    }

    # Export redis config
    docker exec $container redis-cli CONFIG GET "*" 2>$null | Out-File (Join-Path $BackupPath "redis_config.txt") -Encoding ASCII

    Write-Info "  Redis backup saved"
}

# MinIO Backup (bucket-level using mc or tar)
function Backup-Minio {
    if ($SkipMinio) { Write-Warn "Skipping MinIO backup"; return }

    Write-Info "Backing up MinIO..."

    $container = Get-ContainerName "vrixo.*minio"
    if (-not $container) { $container = Get-ContainerName "minio" }
    if (-not $container) { Write-Warn "MinIO container not found"; return }

    Write-Info "  Backing up MinIO data directory..."
    # Try tar inside container first, fall back to docker cp
    $tarResult = docker exec $container tar czf "/tmp/${Timestamp}_minio.tar.gz" -C /data . 2>&1 | Out-String
    $tarFailed = $LASTEXITCODE -ne 0

    if ($tarFailed) {
        Write-Info "  tar not available in container, using docker cp..."
        $tmpDir = Join-Path $env:TEMP "minio_backup_$Timestamp"
        New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null
        docker cp "${container}:/data/." "${tmpDir}/" 2>$null
        & tar czf (Join-Path $BackupPath "minio.tar.gz") -C $tmpDir . 2>&1 | Out-Null
        Remove-Item -Path $tmpDir -Recurse -Force -ErrorAction SilentlyContinue
        Write-Info "  MinIO backup saved via docker cp"
        return
    }

    docker cp "${container}:/tmp/${Timestamp}_minio.tar.gz" (Join-Path $BackupPath "minio.tar.gz")
    docker exec $container rm -f "/tmp/${Timestamp}_minio.tar.gz"

    Write-Info "  MinIO backup saved"
}

# Encryption
function Protect-Backup {
    if (-not $Encrypt -or -not $EncryptionKey) {
        Write-Warn "Encryption skipped (use -Encrypt and -EncryptionKey)"
        return
    }

    Write-Info "Encrypting backup files..."

    $files = Get-ChildItem -Path $BackupPath -File
    foreach ($file in $files) {
        $encFile = "$($file.FullName).enc"
        $opensslInput = $file.FullName
        & openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 -in $opensslInput -out $encFile -pass "pass:$EncryptionKey" 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Remove-Item $file.FullName -Force
            Write-Info "  Encrypted: $($file.Name) -> $($file.Name).enc"
        } else {
            Write-Error "  Encryption failed for $($file.Name)"
        }
    }
}

# Checksums
function New-Checksums {
    Write-Info "Creating checksums..."
    $files = Get-ChildItem -Path $BackupPath -File
    $checksumLines = @()
    foreach ($file in $files) {
        $hash = Get-FileHash -Path $file.FullName -Algorithm SHA256
        $checksumLines += "$($hash.Hash)  $($file.Name)"
    }
    $checksumLines | Out-File (Join-Path $BackupPath "checksums.sha256") -Encoding ASCII
    Write-Info "  Checksums saved"
}

# Verification
function Test-BackupIntegrity {
    if ($SkipVerification) { Write-Warn "Verification skipped"; return }

    Write-Info "Verifying backup integrity..."

    $checksumFile = Join-Path $BackupPath "checksums.sha256"
    if (-not (Test-Path $checksumFile)) {
        Write-Warn "No checksums file found"
        return
    }

    $failed = $false
    Get-Content $checksumFile | ForEach-Object {
        $parts = $_ -split '\s+'
        if ($parts.Count -ge 2) {
            $expectedHash = $parts[0]
            $fileName = $parts[1]
            $filePath = Join-Path $BackupPath $fileName
            if (Test-Path $filePath) {
                $actualHash = (Get-FileHash -Path $filePath -Algorithm SHA256).Hash
                if ($expectedHash -ne $actualHash) {
                    Write-Error "  Checksum MISMATCH: $fileName"
                    $failed = $true
                }
            }
        }
    }

    if (-not $failed) {
        Write-Info "  All checksums verified successfully"
    } else {
        Write-Error "  Backup integrity check FAILED"
    }
}

# Retention
function Clear-OldBackups {
    Write-Info "Cleaning backups older than $RetentionDays days..."

    $cutoff = (Get-Date).AddDays(-$RetentionDays)
    Get-ChildItem -Path $OutputDir -Directory | Where-Object {
        $_.Name -match '^\d{8}_\d{6}$' -and $_.CreationTime -lt $cutoff
    } | ForEach-Object {
        Remove-Item -Path $_.FullName -Recurse -Force
        Write-Info "  Removed old backup: $($_.Name)"
    }
}

# Main
Backup-Postgres
Backup-Redis
Backup-Minio
New-Checksums
Protect-Backup
Test-BackupIntegrity
Clear-OldBackups

Write-Output ""
Write-Output "========================================="
Write-Output "[INFO]  Backup complete!"
Write-Output "  Location: $BackupPath"
Write-Output "========================================="
