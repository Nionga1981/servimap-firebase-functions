#!/bin/bash

# Script para facilitar pruebas en dispositivos móviles
echo "🚀 Iniciando ServiMap para pruebas móviles..."

# Colores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Obtener IP local
IP=$(hostname -I | awk '{print $1}')
if [ -z "$IP" ]; then
    # Para macOS
    IP=$(ipconfig getifaddr en0)
fi

echo -e "${BLUE}Tu IP local es: ${GREEN}$IP${NC}"
echo ""

# Iniciar Next.js en modo desarrollo
echo "Iniciando servidor Next.js..."
echo -e "Accede desde tu móvil a: ${GREEN}http://$IP:3000${NC}"
echo ""
echo "📱 Instrucciones para probar:"
echo "1. Asegúrate de que tu móvil esté en la misma red WiFi"
echo "2. Abre Chrome (Android) o Safari (iOS)"
echo "3. Navega a http://$IP:3000"
echo "4. Para instalar como PWA:"
echo "   - Android: Menú ⋮ → 'Añadir a pantalla de inicio'"
echo "   - iOS: Botón compartir → 'Añadir a pantalla de inicio'"
echo ""
echo "Presiona Ctrl+C para detener el servidor"
echo ""

# Iniciar servidor con host 0.0.0.0 para permitir conexiones externas
npm run dev -- -H 0.0.0.0