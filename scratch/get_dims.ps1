[System.Reflection.Assembly]::LoadWithPartialName('System.Drawing') | Out-Null
Get-ChildItem -Path "C:\Users\sorgar\ClaudeCode\assets\Monstruos\t*.png" | ForEach-Object {
    $img = [System.Drawing.Image]::FromFile($_.FullName)
    Write-Host ("Image: " + $_.Name + " Width: " + $img.Width + " Height: " + $img.Height + " Aspect: " + ($img.Width / $img.Height))
    $img.Dispose()
}
