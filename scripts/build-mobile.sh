#!/bin/bash

# Script completo para construir apps móviles de ServiMap
# Soporte para Android APK e iOS builds

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para logging
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Verificar dependencias
check_dependencies() {
    log_info "Verificando dependencias..."
    
    # Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js no está instalado"
        exit 1
    fi
    log_success "Node.js $(node --version)"
    
    # npm
    if ! command -v npm &> /dev/null; then
        log_error "npm no está instalado"
        exit 1
    fi
    log_success "npm $(npm --version)"
    
    # Capacitor CLI
    if ! command -v cap &> /dev/null; then
        log_warning "Capacitor CLI no encontrado, instalando..."
        npm install -g @capacitor/cli
    fi
    log_success "Capacitor CLI instalado"
    
    # Android SDK (si se va a construir Android)
    if [[ "$1" == "android" || "$1" == "all" ]]; then
        if [ -z "$ANDROID_HOME" ]; then
            log_error "ANDROID_HOME no está configurado"
            log_info "Por favor instala Android Studio y configura ANDROID_HOME"
            exit 1
        fi
        log_success "Android SDK encontrado en $ANDROID_HOME"
    fi
    
    # Xcode (si se va a construir iOS en macOS)
    if [[ "$1" == "ios" || "$1" == "all" ]]; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            if ! command -v xcodebuild &> /dev/null; then
                log_error "Xcode no está instalado"
                exit 1
            fi
            log_success "Xcode encontrado"
        else
            log_warning "iOS build solo está disponible en macOS"
            if [[ "$1" == "ios" ]]; then
                exit 1
            fi
        fi
    fi
}

# Limpiar builds anteriores
clean_builds() {
    log_info "Limpiando builds anteriores..."
    
    # Limpiar Next.js build
    rm -rf .next
    rm -rf out
    
    # Limpiar node_modules si se especifica
    if [[ "$CLEAN_DEPS" == "true" ]]; then
        rm -rf node_modules
        log_info "Reinstalando dependencias..."
        npm install
    fi
    
    log_success "Builds anteriores limpiados"
}

# Construir aplicación web
build_web() {
    log_info "Construyendo aplicación web..."
    
    # Verificar variables de entorno
    if [ ! -f .env.local ]; then
        log_warning ".env.local no encontrado, usando valores por defecto"
    fi
    
    # Build de Next.js con export estático
    npm run build
    
    if [ $? -eq 0 ]; then
        log_success "Aplicación web construida exitosamente"
    else
        log_error "Error construyendo aplicación web"
        exit 1
    fi
    
    # Generar Service Worker
    npm run pwa:generate-sw
    
    log_success "PWA lista"
}

# Preparar Capacitor
prepare_capacitor() {
    log_info "Preparando Capacitor..."
    
    # Sync de Capacitor
    npx cap sync
    
    if [ $? -eq 0 ]; then
        log_success "Capacitor sincronizado"
    else
        log_error "Error sincronizando Capacitor"
        exit 1
    fi
}

# Construir Android APK
build_android() {
    log_info "Construyendo APK de Android..."
    
    # Abrir Android Studio para configuración manual si es necesario
    if [[ "$INTERACTIVE" == "true" ]]; then
        log_info "Abriendo Android Studio para revisión..."
        npx cap open android
        read -p "Presiona Enter cuando hayas terminado la configuración en Android Studio..."
    fi
    
    # Build del APK
    cd android
    
    # Limpiar build anterior
    ./gradlew clean
    
    # Build debug o release
    if [[ "$BUILD_TYPE" == "release" ]]; then
        log_info "Construyendo APK de release..."
        ./gradlew assembleRelease
        
        APK_PATH="app/build/outputs/apk/release/app-release.apk"
        if [ -f "$APK_PATH" ]; then
            # Copiar APK a directorio de builds
            mkdir -p ../builds
            cp "$APK_PATH" "../builds/servimap-release-$(date +%Y%m%d-%H%M%S).apk"
            log_success "APK de release generado en builds/"
        else
            log_error "No se pudo generar el APK de release"
            exit 1
        fi
    else
        log_info "Construyendo APK de debug..."
        ./gradlew assembleDebug
        
        APK_PATH="app/build/outputs/apk/debug/app-debug.apk"
        if [ -f "$APK_PATH" ]; then
            mkdir -p ../builds
            cp "$APK_PATH" "../builds/servimap-debug-$(date +%Y%m%d-%H%M%S).apk"
            log_success "APK de debug generado en builds/"
        else
            log_error "No se pudo generar el APK de debug"
            exit 1
        fi
    fi
    
    cd ..
}

# Construir iOS App
build_ios() {
    log_info "Construyendo app de iOS..."
    
    if [[ "$OSTYPE" != "darwin"* ]]; then
        log_error "iOS build solo está disponible en macOS"
        exit 1
    fi
    
    # Abrir Xcode para configuración manual si es necesario
    if [[ "$INTERACTIVE" == "true" ]]; then
        log_info "Abriendo Xcode para revisión..."
        npx cap open ios
        read -p "Presiona Enter cuando hayas terminado la configuración en Xcode..."
    fi
    
    cd ios/App
    
    # Build del proyecto iOS
    if [[ "$BUILD_TYPE" == "release" ]]; then
        log_info "Construyendo para App Store..."
        xcodebuild -workspace App.xcworkspace -scheme App -configuration Release archive -archivePath ../builds/ServiMap.xcarchive
        
        if [ $? -eq 0 ]; then
            log_success "Archive de iOS generado"
            log_info "Para subir a App Store, usa Xcode Organizer"
        else
            log_error "Error generando archive de iOS"
            exit 1
        fi
    else
        log_info "Construyendo para simulador..."
        xcodebuild -workspace App.xcworkspace -scheme App -configuration Debug -sdk iphonesimulator -derivedDataPath ../builds/
        
        if [ $? -eq 0 ]; then
            log_success "Build de iOS para simulador generado"
        else
            log_error "Error construyendo para simulador"
            exit 1
        fi
    fi
    
    cd ../..
}

# Función principal
main() {
    local platform="$1"
    local build_type="${2:-debug}"
    
    echo "🚀 ServiMap Mobile Build Script"
    echo "================================"
    
    # Validar argumentos
    if [[ "$platform" != "android" && "$platform" != "ios" && "$platform" != "all" ]]; then
        echo "Uso: $0 [android|ios|all] [debug|release] [options]"
        echo ""
        echo "Opciones:"
        echo "  --clean-deps    Limpiar y reinstalar node_modules"
        echo "  --interactive   Abrir IDEs para configuración manual"
        echo ""
        echo "Ejemplos:"
        echo "  $0 android debug"
        echo "  $0 ios release --interactive"
        echo "  $0 all release --clean-deps"
        exit 1
    fi
    
    # Procesar opciones adicionales
    for arg in "$@"; do
        case $arg in
            --clean-deps)
            CLEAN_DEPS="true"
            ;;
            --interactive)
            INTERACTIVE="true"
            ;;
        esac
    done
    
    export BUILD_TYPE="$build_type"
    
    # Crear directorio de builds
    mkdir -p builds
    
    # Ejecutar pasos
    check_dependencies "$platform"
    clean_builds
    build_web
    prepare_capacitor
    
    # Construir según plataforma
    case $platform in
        android)
            build_android
            ;;
        ios)
            build_ios
            ;;
        all)
            build_android
            if [[ "$OSTYPE" == "darwin"* ]]; then
                build_ios
            else
                log_warning "Saltando iOS build (no es macOS)"
            fi
            ;;
    esac
    
    echo ""
    log_success "🎉 Build completado exitosamente!"
    
    if [ -d "builds" ]; then
        echo ""
        echo "📦 Archivos generados:"
        ls -la builds/
    fi
    
    echo ""
    echo "📋 Próximos pasos:"
    if [[ "$platform" == "android" || "$platform" == "all" ]]; then
        echo "  - Para Android: Sube el APK a Google Play Console"
    fi
    if [[ "$platform" == "ios" || "$platform" == "all" ]]; then
        echo "  - Para iOS: Usa Xcode Organizer para subir a App Store"
    fi
}

# Ejecutar función principal con todos los argumentos
main "$@"