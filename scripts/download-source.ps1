# Optional source acquisition. The normal app and generate:model are entirely offline.
$ErrorActionPreference = 'Stop'
$sourceDir = Join-Path $PSScriptRoot 'source'
$data = Get-Content (Join-Path $sourceDir 'anatomy-source-data.json') -Raw | ConvertFrom-Json
$bones = $data.skeletal | Where-Object { $_.nameEn -match 'rib|vertebra|sacrum|coccyx|sternum|hip bone|clavicle|scapula|humerus|femur|xiphoid' -and $_.nameEn -notmatch 'intervertebral' }
$vessels = $data.cardiovascular | Where-Object {
    ($_.id -match '^FJ(34|35|36)\d\d$' -and $_.nameEn -notmatch 'penis|testicular|pudendal|obturator|gluteal') -or
    $_.nameEn -match 'intercostal|internal thoracic|vertebral artery|vertebral vein|azygos|hemiazygos|coronary|thoraco|circumflex humeral|acromial|^left axillary|^right axillary' -or
    $_.id -in @('FJ1931','FJ1932','FJ2562')
}
$items = @($bones) + @($vessels)
$items | ConvertTo-Json -Depth 3 | Set-Content (Join-Path $sourceDir 'selected-source.json') -Encoding utf8
Write-Output "Acquiring $($items.Count) BodyParts3D OBJ components"
$items | ForEach-Object -ThrottleLimit 6 -Parallel {
    $item = $_
    $outDir = $using:sourceDir
    $path = Join-Path $outDir ($item.id + '.obj')
    if (Test-Path -LiteralPath $path) { return }
    $url = 'https://raw.githubusercontent.com/jixiangying/anatomy/main/isa_BP3D_4.0_obj_99/' + $item.id + '.obj'
    for ($attempt = 0; $attempt -lt 3; $attempt++) {
        try {
            Invoke-WebRequest -Uri $url -OutFile $path -TimeoutSec 45
            return
        } catch {
            if ($attempt -eq 2) { Write-Output "FAILED $($item.id): $($_.Exception.Message)" }
        }
    }
}
$files = Get-ChildItem -LiteralPath $sourceDir -Filter '*.obj'
Write-Output "Downloaded $($files.Count) meshes; $([Math]::Round(($files | Measure-Object Length -Sum).Sum / 1MB, 2)) MiB OBJ"
