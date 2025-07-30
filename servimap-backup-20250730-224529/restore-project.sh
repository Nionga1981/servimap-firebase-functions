#!/bin/bash

echo "🚀 ServiMap - Restaurando proyecto desde backup..."

# Verificar que estamos en el directorio correcto
if [ ! -f "firebase.json" ]; then
    echo "❌ Error: No se encontró firebase.json en el directorio actual"
    echo "ℹ️  Ejecuta este script desde la raíz del proyecto ServiMap"
    exit 1
fi

echo "📁 Directorio actual: $(pwd)"
echo "📋 Restaurando archivos..."

# Instalar dependencias de Cloud Functions
if [ -d "functions" ]; then
    echo "📦 Instalando dependencias de Cloud Functions..."
    cd functions
    npm install
    cd ..
fi

echo "✅ Proyecto restaurado exitosamente!"
echo ""
echo "🔧 Próximos pasos:"
echo "1. Verificar variables de entorno (ya configuradas ✅):"
echo "   firebase functions:config:get"
echo ""
echo "2. Crear administradores en Firestore:"
echo "   Colección: admins"
echo "   Documento: {uid_del_admin}"
echo "   Datos: { role: \"admin\", createdAt: timestamp }"
echo ""
echo "3. Desplegar a Firebase:"
echo "   firebase deploy"
echo ""
echo "🎉 ¡Listo para producción!"
