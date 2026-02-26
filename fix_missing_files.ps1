# fix_missing_files.ps1
# This script downloads missing CDN dependencies for offline use if requested.

$deps = @(
    @{ url="https://cdn.tailwindcss.com"; file="tailwindcss.js" },
    @{ url="https://unpkg.com/lucide@latest"; file="lucide.js" },
    @{ url="https://unpkg.com/react@18/umd/react.production.min.js"; file="react.js" },
    @{ url="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"; file="react-dom.js" },
    @{ url="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"; file="jspdf.js" },
    @{ url="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"; file="jszip.js" },
    @{ url="https://unpkg.com/jepub@2.1.4/dist/jepub.min.js"; file="jepub.js" },
    @{ url="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"; file="pdf.js" },
    @{ url="https://unpkg.com/docx@8.5.0/build/index.js"; file="docx.js" }
)

$outDir = "offline_deps"
if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir | Out-Null
}

foreach ($dep in $deps) {
    if (-not (Test-Path "$outDir\$($dep.file)")) {
        Write-Host "Downloading $($dep.file)..."
        Invoke-WebRequest -Uri $dep.url -OutFile "$outDir\$($dep.file)"
    } else {
        Write-Host "$($dep.file) already exists."
    }
}

Write-Host "All frontend dependencies are available in $outDir. Update index.html to use them if offline mode is needed."
