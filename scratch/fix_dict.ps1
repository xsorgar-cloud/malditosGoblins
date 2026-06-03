$fffd = [char]0xFFFD
$replacements = @{
    "da${fffd}o" = 'daño'
    "Da${fffd}o" = 'Daño'
    "energ${fffd}a" = 'energía'
    "Energ${fffd}a" = 'Energía'
    "bot${fffd}n" = 'botón'
    "Bot${fffd}n" = 'Botón'
    "acci${fffd}n" = 'acción'
    "Acci${fffd}n" = 'Acción'
    "alg${fffd}n" = 'algún'
    "est${fffd}" = 'está'
    "ca${fffd}do" = 'caído'
    "versi${fffd}n" = 'versión'
    "colecci${fffd}n" = 'colección'
    "f${fffd}sico" = 'físico'
    "f${fffd}sica" = 'física'
    "t${fffd}calos" = 'tócalos'
    "penalizaci${fffd}n" = 'penalización'
    "r${fffd}pidas" = 'rápidas'
    "b${fffd}sica" = 'básica'
    "contin${fffd}as" = 'continúas'
    "ning${fffd}n" = 'ningún'
    "perder${fffd}s" = 'perderás'
    "almac${fffd}n" = 'almacén'
    "cur${fffd}" = 'curó'
    "otorg${fffd}" = 'otorgó'
    "infligi${fffd}" = 'infligió'
    "gener${fffd}" = 'generó'
    "anul${fffd}" = 'anuló'
    "sac${fffd}" = 'sacó'
    "num${fffd}ricos" = 'numéricos'
    "m${fffd}ltiples" = 'múltiples'
    "${fffd}nico" = 'único'
    "${fffd}ltimo" = 'último'
    "${fffd}ndice" = 'índice'
    "${fffd}cono" = 'ícono'
    "${fffd}ntimo" = 'íntimo'
    "Hab${fffd}is" = 'Habéis'
    "hab${fffd}is" = 'habéis'
}

function Fix-Text {
    param([string]$Path)
    $text = Get-Content $Path -Raw -Encoding UTF8
    foreach ($key in $replacements.Keys) {
        $text = $text -replace $key, $replacements[$key]
    }
    # Fix the missing ñ in the text directly
    $text = $text -replace "Senda de El Ze${fffd}or", "Senda de El Zeñor"
    $text = $text -replace "da${fffd}ar", "dañar"
    $text = $text -replace "a${fffd}adimos", "añadimos"
    $text = $text -replace "a${fffd}adir", "añadir"
    [System.IO.File]::WriteAllText((Resolve-Path $Path).Path, $text, [System.Text.Encoding]::UTF8)
    Write-Host "Fixed dictionary replacements in $Path"
}

Fix-Text "js\app.js"
Fix-Text "js\CombatManager.js"

# Index.html tiene (??) fijos.
$idx = Get-Content "index.html" -Raw -Encoding UTF8
$idx = $idx -replace '\(\?\?\?\?\)', '(estrellas4)'
$idx = $idx -replace '\(\?\?\?\)', '(estrellas3)'
$idx = $idx -replace '\(\?\?\)', '(estrellas2)'
$idx = $idx -replace '\(estrellas4\)', '(&starf;&starf;&starf;&starf;)'
$idx = $idx -replace '\(estrellas3\)', '(&starf;&starf;&starf;)'
$idx = $idx -replace '\(estrellas2\)', '(&starf;&starf;)'
[System.IO.File]::WriteAllText((Resolve-Path "index.html").Path, $idx, [System.Text.Encoding]::UTF8)
Write-Host "Fixed index.html stars"
