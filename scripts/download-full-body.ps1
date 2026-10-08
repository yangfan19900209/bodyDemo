# Requires PowerShell 7. Downloads only uncached, selected OBJ components.
$ErrorActionPreference = 'Stop'
$sourceDir = Join-Path $PSScriptRoot 'source'
$items = Get-Content (Join-Path $sourceDir 'selected-full-body.json') -Raw | ConvertFrom-Json
$urls = @{}
# Begin with the primary 4.0 mirror. API quota or LFS lookup must not block it.
$resolved = foreach ($item in $items) {
    if ($item.remoteMirror) { continue }
    $url = 'https://raw.githubusercontent.com/jixiangying/anatomy/main/isa_BP3D_4.0_obj_99/' + $item.id + '.obj'
    [PSCustomObject]@{ id=$item.id; url=$url }
}
$resolved | ConvertTo-Json | Set-Content (Join-Path $sourceDir 'full-body-download-urls.json') -Encoding utf8
$missing = @($resolved | Where-Object {-not (Test-Path -LiteralPath (Join-Path $sourceDir ($_.id+'.obj')))})
Write-Output "Fetching $($missing.Count) uncached meshes; $($items.Count) selected total"
$missing | ForEach-Object -ThrottleLimit 6 -Parallel {
    $outDir = $using:sourceDir
    $item = $_
    if (-not $item.url) { Write-Output "FAILED $($item.id): missing URL"; return }
    $dest = Join-Path $outDir ($item.id + '.obj')
    for ($attempt=0; $attempt -lt 3; $attempt++) {
        try { Invoke-WebRequest -Uri $item.url -OutFile $dest -TimeoutSec 60; return }
        catch { if ($attempt -eq 2) { Write-Output "FAILED $($item.id): $($_.Exception.Message)" } }
    }
}
$treeFile = Join-Path $sourceDir 'bodyparts43-paths.json'
if (Test-Path -LiteralPath $treeFile) {
    $paths = Get-Content $treeFile -Raw | ConvertFrom-Json
} else {
    # GitHub's public immutable tree-list route avoids REST API quota entirely.
    try {
        $treeResponse = Invoke-RestMethod 'https://github.com/olivercase/body_parts_3d_api/tree-list/fd527e6f4daf732fd814314d9257df5877b844bc' -Headers @{Accept='application/json'} -TimeoutSec 45
        $paths = @($treeResponse.paths)
    } catch { $paths = @() }
    # A tree-only partial Git clone is a fallback when tree-list is unavailable.
    if (-not $paths.Count) {
    # No checkout, LFS smudge or anatomical blob download occurs at this step.
    $metadataRepo = Join-Path $sourceDir 'bodyparts43-git-metadata'
    if (-not (Test-Path -LiteralPath (Join-Path $metadataRepo '.git'))) {
        git -c core.autocrlf=false clone --filter=blob:none --no-checkout --depth 1 --single-branch 'https://github.com/olivercase/body_parts_3d_api.git' $metadataRepo
        if ($LASTEXITCODE -ne 0) { throw 'Could not read the 4.3 repository tree' }
    }
    $paths = @(git -C $metadataRepo ls-tree -r --name-only HEAD)
    if ($LASTEXITCODE -ne 0) { throw 'Could not list 4.3 source paths' }
    }
    $paths | ConvertTo-Json | Set-Content $treeFile -Encoding utf8
}
foreach ($filePath in $paths) {
    if ($filePath -match '^meshes/(FJ\d+)_.*\.obj$') {
        $id = $Matches[1]
        $encodedPath = ($filePath.Split('/') | ForEach-Object {[Uri]::EscapeDataString($_)}) -join '/'
        $urls[$id] = 'https://media.githubusercontent.com/media/olivercase/body_parts_3d_api/main/' + $encodedPath
    }
}
$secondary = foreach ($item in $items | Where-Object {$_.remoteMirror}) {
    [PSCustomObject]@{id=$item.id;url=$urls[$item.id]}
}
@($resolved)+@($secondary) | ConvertTo-Json | Set-Content (Join-Path $sourceDir 'full-body-download-urls.json') -Encoding utf8
Write-Output "Fetching $($secondary.Count) real 4.3 lung-parenchyma components"
$secondary | ForEach-Object -ThrottleLimit 4 -Parallel {
    $item = $_
    $outDir = $using:sourceDir
    $dest = Join-Path $outDir ($item.id+'.obj')
    if (Test-Path -LiteralPath $dest) { return }
    if (-not $item.url) { Write-Output "FAILED $($item.id): no source URL"; return }
    try { Invoke-WebRequest $item.url -OutFile $dest -TimeoutSec 60 }
    catch { Write-Output "FAILED $($item.id): $($_.Exception.Message)" }
}
$stillMissing = @($items | Where-Object {-not (Test-Path -LiteralPath (Join-Path $sourceDir ($_.id+'.obj')))})
Write-Output "Missing after download: $($stillMissing.id -join ', ')"
if ($stillMissing.Count) { throw 'Some selected source components are still missing' }
Write-Output "All selected source meshes downloaded"
