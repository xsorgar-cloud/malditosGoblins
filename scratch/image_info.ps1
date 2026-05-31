Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile('assets/Monstruos/t1.png')
Write-Host "Width: $($img.Width) Height: $($img.Height)"
$img.Dispose()
