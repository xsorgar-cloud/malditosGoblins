$content = Get-Content -Path "C:\Users\sorgar\ClaudeCode\js\database.js" -Raw
$matches = [regex]::Matches($content, '\{ id: ''espada_inicial''.+?\}')
foreach ($m in $matches) {
    Write-Output "Matched Espada Inicial: $($m.Value)"
    # Check character codes of the word "Daño" in the matched string
    if ($m.Value -match "effect: '(.+?)'") {
        $effect = $Matches[1]
        Write-Output "Effect: $effect"
        $chars = $effect.ToCharArray()
        $codes = foreach ($c in $chars) { "[char]'$c' (code: $([int]$c))" }
        Write-Output "Character Codes: $($codes -join ', ')"
    }
}
