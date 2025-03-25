function Test-CommandExists {
    param ($command)
    $oldPreference = $ErrorActionPreference
    $ErrorActionPreference = 'stop'
    try {
        if (Get-Command $command) { return $true }
    } catch {
        return $false
    } finally {
        $ErrorActionPreference = $oldPreference
    }
}

if (-not (Test-CommandExists "spicetify")) {
    Write-Host "Error: Spicetify not found. Please install it first: https://spicetify.app/docs/getting-started" -ForegroundColor Red
    exit 1
}

try {
    try {
        $config = spicetify -c
        if ($null -eq $config) { throw "Cannot read spicetify config" }
        
        $m = $config | Select-String '"ExtensionsDirectory":\s*"(.*?)"'
        $d = if ($m) { $m.Matches.Groups[1].Value } else { "" }
        
        if ([string]::IsNullOrEmpty($d)) {
            $configPath = ""
            if (Test-Path "$env:APPDATA\spicetify\config-xpui.ini") {
                $configPath = "$env:APPDATA\spicetify\config-xpui.ini"
            } elseif (Test-Path "~/.config/spicetify/config-xpui.ini") {
                $configPath = "~/.config/spicetify/config-xpui.ini"
            }
            
            if (-not [string]::IsNullOrEmpty($configPath)) {
                $configContent = Get-Content $configPath
                $extLine = $configContent | Select-String "extensions_path = (.*)"
                if ($extLine) {
                    $d = $extLine.Matches.Groups[1].Value
                }
            }
            
            if ([string]::IsNullOrEmpty($d)) {
                $d = "$env:APPDATA\spicetify\Extensions"
            }
        }
    } catch {
        $d = "$env:APPDATA\spicetify\Extensions"
    }
    
    if (-not (Test-Path $d)) {
        try {
            New-Item -Path $d -ItemType Directory -Force | Out-Null
        } catch {
            Write-Host "Error: Failed to create extensions directory" -ForegroundColor Red
            exit 1
        }
    }
    
    $f = Join-Path $d "Image_Opener.js"
    $c = @(spicetify config | Select-String "Image_Opener\.js").Count -gt 0
    
    if (-not (Test-Path $f)) {
        try {
            Invoke-WebRequest -Uri "https://raw.githubusercontent.com/NightMortal/Custom-Spicetify-Extensions/main/Image_Opener/Image_Opener.js" -OutFile $f -UseBasicParsing -ErrorAction Stop
        } catch {
            Write-Host "Error: Failed to download extension" -ForegroundColor Red
            exit 1
        }
        
        try {
            spicetify config extensions Image_Opener.js
            spicetify apply
            Write-Host "Success: Image_Opener installed" -ForegroundColor Green
        } catch {
            Write-Host "Error: Failed to configure spicetify" -ForegroundColor Red
            exit 1
        }
    } elseif (-not $c) {
        try {
            spicetify config extensions Image_Opener.js
            spicetify apply
            Write-Host "Success: Image_Opener configured" -ForegroundColor Green
        } catch {
            Write-Host "Error: Failed to configure spicetify" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "Success: Image_Opener already installed and configured" -ForegroundColor Green
    }
} catch {
    Write-Host "Error: An unexpected error occurred" -ForegroundColor Red
    exit 1
}