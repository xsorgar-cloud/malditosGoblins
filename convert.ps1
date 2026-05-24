$text = [System.IO.File]::ReadAllText("C:\Users\sorgar\ClaudeCode\js\app.js")
$utf8NoBom = New-Object System.Text.UTF8Encoding $False
[System.IO.File]::WriteAllText("C:\Users\sorgar\ClaudeCode\js\app.js", $text, $utf8NoBom)
