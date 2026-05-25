$path = 'js\app.js'
$lines = [System.IO.File]::ReadAllLines($path)
$newLines = $lines[0..2158] + $lines[2354..($lines.Length - 1)]
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllLines($path, $newLines, $utf8NoBom)
