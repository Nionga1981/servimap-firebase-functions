#!/bin/bash

# deploy-admin-functions.sh - Script para deployment de funciones admin
# Este script debe ejecutarse en un ambiente con Firebase CLI autenticado

echo "🚀 Preparando deployment de funciones admin..."

# Verificar que tenemos las funciones necesarias
echo "📋 Verificando funciones de admin dashboard..."

if [ -f "/workspaces/servimap-firebase-functions/functions/src/adminDashboard.ts" ]; then
    echo "✅ adminDashboard.ts encontrado"
else
    echo "❌ adminDashboard.ts no encontrado"
    exit 1
fi

# Verificar que están exportadas en index.ts
if grep -q "adminDashboard" functions/src/index.ts; then
    echo "✅ Funciones admin exportadas en index.ts"
else
    echo "❌ Funciones admin no exportadas en index.ts"
    echo "Agregando exportación..."
    echo "" >> functions/src/index.ts
    echo "// Admin Dashboard Functions" >> functions/src/index.ts
    echo "export * from './adminDashboard';" >> functions/src/index.ts
fi

# Compilar
echo "🔨 Compilando TypeScript..."
cd functions
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Compilación exitosa"
else
    echo "❌ Error en compilación"
    exit 1
fi

cd ..

# Mostrar funciones que se van a deployar
echo "📋 Funciones de admin que se deployarán:"
echo "  - getAdminStats"
echo "  - getUsers" 
echo "  - getAnalyticsReport"
echo "  - exportSystemData"

echo ""
echo "🎯 INSTRUCCIONES PARA EL DEPLOYMENT:"
echo ""
echo "1. En tu máquina local (con Firebase CLI autenticado):"
echo "   git pull origin main"
echo "   firebase use servimap-nyniz"
echo "   firebase deploy --only functions"
echo ""
echo "2. O deployment específico de funciones admin:"
echo "   firebase deploy --only functions:getAdminStats,functions:getUsers,functions:getAnalyticsReport,functions:exportSystemData"
echo ""
echo "3. Verificar deployment:"
echo "   firebase functions:list"
echo ""
echo "🔗 URLs de las funciones (después del deployment):"
echo "  - getAdminStats: https://us-central1-servimap-nyniz.cloudfunctions.net/getAdminStats"
echo "  - getUsers: https://us-central1-servimap-nyniz.cloudfunctions.net/getUsers"
echo "  - getAnalyticsReport: https://us-central1-servimap-nyniz.cloudfunctions.net/getAnalyticsReport"
echo "  - exportSystemData: https://us-central1-servimap-nyniz.cloudfunctions.net/exportSystemData"
echo ""
echo "✨ ¡Todo listo para deployment!"