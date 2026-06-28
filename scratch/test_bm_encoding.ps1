$content = Get-Content -Path "C:\Users\sorgar\ClaudeCode\js\BotManager.js" -Raw
$matches = [regex]::Matches($content, 'includes\(''da?o''\)')
foreach ($m in $matches) {
    Write-Output "Matched includes: $($m.Value)"
}
# Find lines with 'daño'
$lines = Get-Content -Path "C:\Users\sorgar\ClaudeCode\js\BotManager.js"
for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match "daño") {
        Write-Output "Line $($i+1): $($lines[$i])"
        $chars = $lines[$i].ToCharArray()
        # Print part around daño
        $idx = $lines[$i].IndexOf("daño")
        if ($idx -ge 0) {
            $part = $lines[$i].Substring($idx, 4)
            $codes = foreach ($c in $part.ToCharArray()) { "[char]'$c' (code: $([int]$c))" }
            Write-Output "  Codes for '$part': $($codes -join ', ')"
        }
    }
}
