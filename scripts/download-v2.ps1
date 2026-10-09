# PowerShell 7. Acquire actual selected source files; never registers failed ones.
$ErrorActionPreference = 'Stop'
$sourceDir = Join-Path $PSScriptRoot 'source'
$selection = Get-Content (Join-Path $sourceDir 'selected-v2.json') -Raw | ConvertFrom-Json
$downloadItems = @($selection.candidates) + @($selection.calibration) + @($selection.extraCalibration)
$missing = @($downloadItems | Where-Object {-not (Test-Path -LiteralPath (Join-Path $sourceDir $_.filename))})
Write-Output "Fetching $($missing.Count) uncached V2 candidates, $($selection.candidates.Count) total"
$missing | ForEach-Object -ThrottleLimit 6 -Parallel {
    $item = $_
    $directory = $using:sourceDir
    $outFile = Join-Path $directory $item.filename
    $temporaryFile = $outFile + '.downloading'
    for ($attempt=0; $attempt -lt 3; $attempt++) {
        try {
            Invoke-WebRequest -Uri $item.sourceUrl -OutFile $temporaryFile -TimeoutSec 90
            Move-Item -LiteralPath $temporaryFile -Destination $outFile -Force
            return
        } catch {
            if ($attempt -eq 2) { Write-Output "UNAVAILABLE $($item.id): $($_.Exception.Message)" }
        }
    }
}
$report = foreach ($item in $selection.candidates) {
    $file = Join-Path $sourceDir $item.filename
    [PSCustomObject]@{id=$item.id;asset=$item.assetId;obtained=(Test-Path -LiteralPath $file);sourceUrl=$item.sourceUrl}
}
$report | ConvertTo-Json | Set-Content (Join-Path $sourceDir 'v2-download-report.json') -Encoding utf8
Write-Output "Downloaded $(@($report | Where-Object {$_.obtained}).Count)/$($report.Count) real candidates"
$report | Where-Object {-not $_.obtained} | ForEach-Object {Write-Output "MISSING $($_.id)"}
