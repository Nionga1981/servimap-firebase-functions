#!/bin/bash

# 🚀 Script de Deploy - Funcionalidad de Logos ServiMap
# Ejecutar con: bash deploy-logos.sh

echo "🚀 Iniciando deploy de funcionalidad de logos..."

# Verificar que Firebase CLI está instalado
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI no está instalado. Instalando..."
    npm install -g firebase-tools
fi

# Verificar autenticación
echo "🔐 Verificando autenticación Firebase..."
if ! firebase projects:list &> /dev/null; then
    echo "❌ No estás autenticado en Firebase."
    echo "👉 Ejecuta: firebase login"
    exit 1
fi

echo "✅ Autenticación verificada"

# 1. Verificar compilación de Cloud Functions
echo "🔧 Verificando compilación de Cloud Functions..."
cd functions

if npm run build; then
    echo "✅ Cloud Functions compilan correctamente"
    cd ..
else
    echo "❌ Error compilando Cloud Functions"
    cd ..
    exit 1
fi

# 2. Deploy Storage Rules (PRIORITARIO)
echo "📦 Deployando Storage Rules..."
if firebase deploy --only storage; then
    echo "✅ Storage Rules deployadas exitosamente"
else
    echo "❌ Error deployando Storage Rules"
    exit 1
fi

# 3. Deploy Cloud Functions 
echo "☁️ Deployando Cloud Functions..."
if firebase deploy --only functions; then
    echo "✅ Cloud Functions deployadas exitosamente"
else
    echo "❌ Error deployando Cloud Functions"
    echo "⚠️ Continuando con Frontend..."
fi

# 4. Deploy Hosting (Frontend)
echo "🌐 Deployando Frontend (Hosting)..."
if firebase deploy --only hosting; then
    echo "✅ Frontend deployado exitosamente"
else
    echo "❌ Error deployando Frontend"
    exit 1
fi

echo ""
echo "🎉 ¡Deploy completado!"
echo ""
echo "📋 Resumen:"
echo "✅ Storage Rules - Deployadas (logos públicos)"
echo "✅ Frontend - Deployado (formularios con upload de logo)"
echo "✅ Map Display - Actualizado (visualización de logos)"
echo ""
echo "🧪 Próximos pasos para probar:"
echo "1. Ir a formulario de registro de prestador"
echo "2. Subir un logo en el campo correspondiente"
echo "3. Completar registro"
echo "4. Verificar que aparece en el mapa con logo personalizado"
echo ""
echo "🔗 URLs útiles:"
echo "- Firebase Console: https://console.firebase.google.com"
echo "- Storage Rules: Se aplicaron automáticamente"
echo "- App URL: Tu dominio de Firebase Hosting"
echo ""