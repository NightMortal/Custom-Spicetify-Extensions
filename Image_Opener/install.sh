#!/bin/bash
set -e

if ! command -v spicetify &> /dev/null; then
    echo "Error: Spicetify not found. Please install it first."
    exit 1
fi

if [[ "$OSTYPE" == "darwin"* ]]; then
    default_dir="$HOME/.config/spicetify/Extensions"
    config_file="$HOME/.config/spicetify/config-xpui.ini"
elif [[ "$OSTYPE" == "linux"* ]]; then
    default_dir="$HOME/.config/spicetify/Extensions"
    config_file="$HOME/.config/spicetify/config-xpui.ini"
else
    echo "Error: Unsupported operating system"
    exit 1
fi

extensions_dir=""

if spicetify -c &> /dev/null; then
    extensions_dir=$(spicetify -c | grep "ExtensionsDirectory" | cut -d '"' -f2)
fi

if [ -z "$extensions_dir" ] && [ -f "$config_file" ]; then
    ext_line=$(grep "extensions_path" "$config_file" 2>/dev/null || echo "")
    if [ ! -z "$ext_line" ]; then
        extensions_dir=$(echo "$ext_line" | cut -d '=' -f2 | tr -d ' ')
    fi
fi

if [ -z "$extensions_dir" ]; then
    extensions_dir="$default_dir"
fi

if [ ! -d "$extensions_dir" ]; then
    mkdir -p "$extensions_dir" || { echo "Error: Failed to create extensions directory"; exit 1; }
fi

extension_file="$extensions_dir/Image_Opener.js"
is_configured=$(spicetify config | grep -c "Image_Opener.js" || echo "0")

if [ ! -f "$extension_file" ]; then
    if command -v curl &> /dev/null; then
        curl -s -o "$extension_file" "https://raw.githubusercontent.com/NightMortal/Custom-Spicetify-Extensions/main/Image_Opener/Image_Opener.js" || {
            echo "Error: Failed to download extension";
            exit 1;
        }
    elif command -v wget &> /dev/null; then
        wget -q -O "$extension_file" "https://raw.githubusercontent.com/NightMortal/Custom-Spicetify-Extensions/main/Image_Opener/Image_Opener.js" || {
            echo "Error: Failed to download extension";
            exit 1;
        }
    else
        echo "Error: Neither curl nor wget found"
        exit 1
    fi
    
    if [ ! -f "$extension_file" ] || [ ! -s "$extension_file" ]; then
        echo "Error: Downloaded file is empty or missing"
        exit 1
    fi
    
    spicetify config extensions Image_Opener.js || { echo "Error: Failed to configure spicetify"; exit 1; }
    spicetify apply || { echo "Error: Failed to apply configuration"; exit 1; }
    echo "Success: Image_Opener installed"
    
elif [ "$is_configured" -eq 0 ]; then
    spicetify config extensions Image_Opener.js || { echo "Error: Failed to configure spicetify"; exit 1; }
    spicetify apply || { echo "Error: Failed to apply configuration"; exit 1; }
    echo "Success: Image_Opener configured"
    
else
    echo "Success: Image_Opener already installed and configured"
fi

exit 0
