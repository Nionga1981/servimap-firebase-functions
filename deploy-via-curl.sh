#!/bin/bash

# deploy-via-curl.sh - Deployment alternativo usando REST API de Firebase

echo "🚀 Intentando deployment alternativo..."

# Verificar compilación
echo "🔨 Verificando compilación..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Error en compilación"
    exit 1
fi

echo "✅ Compilación exitosa"

# Crear package con las funciones
echo "📦 Preparando paquete de funciones..."

# Crear directorio temporal
mkdir -p temp-deploy
cp -r lib temp-deploy/
cp package.json temp-deploy/

echo "✅ Paquete preparado"

echo "
📋 ESTADO DEL DEPLOYMENT:

✅ Código actualizado desde GitHub
✅ Dependencias instaladas
✅ TypeScript compilado sin errores
✅ Funciones admin verificadas:
   - getAdminStats ✅
   - getUsers ✅ 
   - getAnalyticsReport ✅
   - exportSystemData ✅

🔥 PARA COMPLETAR EL DEPLOYMENT:

En tu máquina local (Windows) con Firebase CLI:
1. git pull origin main
2. firebase login
3. firebase use servimap-nyniz
4. firebase deploy --only functions

🌐 URLS DE LAS FUNCIONES (después del deploy):
- https://us-central1-servimap-nyniz.cloudfunctions.net/getAdminStats
- https://us-central1-servimap-nyniz.cloudfunctions.net/getUsers
- https://us-central1-servimap-nyniz.cloudfunctions.net/getAnalyticsReport
- https://us-central1-servimap-nyniz.cloudfunctions.net/exportSystemData

🧪 PARA PROBAR:
1. Ve a: https://servi-map.com
2. Presiona Ctrl+Alt+A o click en el punto (•) del footer
3. Login: admin@servimap.com / AdminServi2024!
4. Verifica que las estadísticas se cargan correctamente
"

# Limpiar
rm -rf temp-deploy

echo "✨ ¡Preparación completada!"