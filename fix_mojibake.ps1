$cleanPath = "js\app_clean.js"
$cleanLines = Get-Content $cleanPath -Encoding UTF8

function Fix-File {
    param([string]$Path)
    $corruptedLines = Get-Content $Path -Encoding UTF8
    $fixedCount = 0
    for ($i = 0; $i -lt $corruptedLines.Count; $i++) {
        if ($corruptedLines[$i].Contains([char]0xFFFD) -or $corruptedLines[$i].Contains("")) {
            $parts = $corruptedLines[$i].Split([char]0xFFFD, "") | Where-Object { $_.Trim().Length -gt 2 }
            $found = $false
            foreach ($cleanLine in $cleanLines) {
                $matchAll = $true
                foreach ($part in $parts) {
                    if (-not $cleanLine.Contains($part)) {
                        $matchAll = $false
                        break
                    }
                }
                if ($matchAll -and $parts.Count -gt 0) {
                    $corruptedLines[$i] = $cleanLine
                    $found = $true
                    $fixedCount++
                    break
                }
            }
        }
    }
    $corruptedLines | Out-File $Path -Encoding UTF8
    Write-Host "Fixed $fixedCount lines in $Path"
}

Fix-File "js\CombatManager.js"
Fix-File "js\app.js"
