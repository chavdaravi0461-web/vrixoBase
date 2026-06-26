# Run full load-test suite (all VU levels, sequential)
# Usage: .\run-all-tests.ps1

$env:Path += ";C:\Program Files\k6"
$resultsDir = "C:\vrixoBase\backend\load-tests\results"
New-Item -ItemType Directory -Force -Path $resultsDir | Out-Null

$tests = @(
    @{ vus = 10;  duration = "30s" },
    @{ vus = 50;  duration = "30s" },
    @{ vus = 100; duration = "30s" },
    @{ vus = 250; duration = "30s" }
    # 500+ VUs will exceed capacity — run separately if needed
)

foreach ($test in $tests) {
    $vus = $test.vus
    $duration = $test.duration
    $export = Join-Path -Path $resultsDir -ChildPath "${vus}vu.json"
    Write-Host "=== Load test: $vus VUs ===" -ForegroundColor Cyan
    k6 run --vus $vus --duration $duration --summary-export $export "C:\vrixoBase\backend\load-tests\main.js"
    Write-Host "--- Completed: $vus VUs ---" -ForegroundColor Green
}
