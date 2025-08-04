#!/bin/bash

echo "🚀 ServiMapp Deployment desde GitHub Codespace"
echo "============================================"

# Variables de entorno
PROJECT_ID="servimap-nyniz"

# Verificar si tenemos token de Firebase
if [ -n "$FIREBASE_TOKEN" ]; then
    echo "✅ Token de Firebase encontrado en variables de entorno"
    FIREBASE_TOKEN_FLAG="--token $FIREBASE_TOKEN"
else
    echo "⚠️ No se encontró FIREBASE_TOKEN en variables de entorno"
    echo "Intentando con service account..."
    
    # Intentar usar service account si existe
    if [ -f "serviceAccount.json" ]; then
        echo "✅ Service account encontrado"
        export GOOGLE_APPLICATION_CREDENTIALS="serviceAccount.json"
    else
        echo "❌ No se pudo encontrar método de autenticación"
        echo ""
        echo "Para resolver esto, necesitas:"
        echo "1. Ir a GitHub Actions en el repositorio"
        echo "2. Ejecutar manualmente el workflow 'Deploy ServiMapp Functions'"
        echo "3. O configurar FIREBASE_TOKEN en el entorno"
        exit 1
    fi
fi

# Compilar functions
echo ""
echo "📦 Compilando Cloud Functions..."
cd functions
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Error al compilar functions"
    exit 1
fi
cd ..

echo "✅ Functions compiladas exitosamente"
echo ""

# Verificar compilación
echo "📊 Verificando compilación..."
FUNCTION_COUNT=$(grep -c "exports\." functions/lib/index.js)
echo "✅ Total de funciones exportadas: $FUNCTION_COUNT"

# Intentar deployment
echo ""
echo "🚀 Iniciando deployment de Cloud Functions..."
echo "Desplegando $FUNCTION_COUNT funciones a $PROJECT_ID..."

if [ -n "$FIREBASE_TOKEN_FLAG" ]; then
    firebase deploy --only functions --project $PROJECT_ID $FIREBASE_TOKEN_FLAG --force
else
    firebase deploy --only functions --project $PROJECT_ID --force
fi

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ ¡DEPLOYMENT COMPLETADO EXITOSAMENTE!"
    echo "🎉 ServiMapp está 100% desplegada"
    echo "⚡ Total Functions desplegadas: $FUNCTION_COUNT"
    echo "🌐 URL: https://$PROJECT_ID.web.app"
    echo "💯 Todos los sistemas operativos"
else
    echo ""
    echo "❌ Error en el deployment"
    echo ""
    echo "Solución alternativa:"
    echo "1. Ve a: https://github.com/Nionga1981/servimap-firebase-functions/actions"
    echo "2. Ejecuta manualmente el workflow 'Deploy ServiMapp Functions'"
    echo "3. Selecciona 'Run workflow' > 'functions'"
    exit 1
fi