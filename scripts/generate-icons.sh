#!/bin/bash

# Script para generar iconos de diferentes tamaños desde logobaseok.jpg
# Requiere ImageMagick (convert command)

SOURCE_LOGO="/workspaces/servimap-firebase-functions/public/images/logobaseok.jpg"
ICONS_DIR="/workspaces/servimap-firebase-functions/public/icons"

# Crear directorio de iconos si no existe
mkdir -p "$ICONS_DIR"

echo "🎨 Generando iconos desde logobaseok.jpg..."

# Tamaños para PWA manifest
sizes=(48 72 96 128 144 152 192 384 512)

for size in "${sizes[@]}"; do
    echo "📱 Generando icono ${size}x${size}..."
    if command -v convert &> /dev/null; then
        convert "$SOURCE_LOGO" -resize "${size}x${size}" "$ICONS_DIR/icon-${size}x${size}.png"
    else
        echo "⚠️  ImageMagick no está instalado. Copiando logo original..."
        cp "$SOURCE_LOGO" "$ICONS_DIR/icon-${size}x${size}.jpg"
    fi
done

# Generar iconos maskable (con padding para mejor visualización)
echo "🎭 Generando iconos maskable..."
if command -v convert &> /dev/null; then
    # Crear versión con padding para maskable
    convert "$SOURCE_LOGO" -resize 192x192 -gravity center -extent 192x192 -background transparent "$ICONS_DIR/maskable-icon-192x192.png"
    convert "$SOURCE_LOGO" -resize 512x512 -gravity center -extent 512x512 -background transparent "$ICONS_DIR/maskable-icon-512x512.png"
    
    # Crear versión monocromática
    convert "$SOURCE_LOGO" -colorspace Gray -resize 192x192 "$ICONS_DIR/monochrome-icon-192x192.png"
else
    echo "⚠️  ImageMagick no disponible, usando logo original..."
    cp "$SOURCE_LOGO" "$ICONS_DIR/maskable-icon-192x192.jpg"
    cp "$SOURCE_LOGO" "$ICONS_DIR/maskable-icon-512x512.jpg"
    cp "$SOURCE_LOGO" "$ICONS_DIR/monochrome-icon-192x192.jpg"
fi

# Generar shortcuts icons
echo "🔗 Generando iconos para shortcuts..."
if command -v convert &> /dev/null; then
    convert "$SOURCE_LOGO" -resize 96x96 "$ICONS_DIR/shortcut-search-96x96.png"
    convert "$SOURCE_LOGO" -resize 96x96 "$ICONS_DIR/shortcut-messages-96x96.png"  
    convert "$SOURCE_LOGO" -resize 96x96 "$ICONS_DIR/shortcut-wallet-96x96.png"
    convert "$SOURCE_LOGO" -resize 96x96 "$ICONS_DIR/shortcut-request-96x96.png"
    convert "$SOURCE_LOGO" -resize 192x192 "$ICONS_DIR/file-handler-icon.png"
else
    cp "$SOURCE_LOGO" "$ICONS_DIR/shortcut-search-96x96.jpg"
    cp "$SOURCE_LOGO" "$ICONS_DIR/shortcut-messages-96x96.jpg"  
    cp "$SOURCE_LOGO" "$ICONS_DIR/shortcut-wallet-96x96.jpg"
    cp "$SOURCE_LOGO" "$ICONS_DIR/shortcut-request-96x96.jpg"
    cp "$SOURCE_LOGO" "$ICONS_DIR/file-handler-icon.jpg"
fi

echo "✅ Iconos generados exitosamente en $ICONS_DIR"
echo "📱 Total de iconos: $(ls -1 "$ICONS_DIR" | wc -l)"

# Listar iconos generados
echo "📂 Iconos generados:"
ls -la "$ICONS_DIR"