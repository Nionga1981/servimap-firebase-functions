#!/bin/bash

# ServiMap Android Build Script
echo "🤖 ServiMap Android Build Script"
echo "================================"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "capacitor.config.ts" ]; then
    echo -e "${RED}Error: capacitor.config.ts not found. Please run this script from the project root.${NC}"
    exit 1
fi

# Function to build APK
build_apk() {
    echo -e "${YELLOW}Building Android APK...${NC}"
    
    # Sync the latest changes
    echo "1. Syncing Capacitor..."
    npx cap sync android
    
    # Navigate to Android directory
    cd android
    
    # Clean previous builds
    echo "2. Cleaning previous builds..."
    ./gradlew clean
    
    # Build debug APK
    echo "3. Building debug APK..."
    ./gradlew assembleDebug
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ APK built successfully!${NC}"
        echo -e "${GREEN}Location: android/app/build/outputs/apk/debug/app-debug.apk${NC}"
        
        # Get APK size
        APK_SIZE=$(du -h app/build/outputs/apk/debug/app-debug.apk | cut -f1)
        echo -e "${GREEN}Size: $APK_SIZE${NC}"
        
        # Copy to root directory for easy access
        cp app/build/outputs/apk/debug/app-debug.apk ../ServiMap-debug.apk
        echo -e "${GREEN}Copied to: ServiMap-debug.apk${NC}"
    else
        echo -e "${RED}❌ Build failed!${NC}"
        exit 1
    fi
    
    cd ..
}

# Function to build release APK
build_release() {
    echo -e "${YELLOW}Building Release APK...${NC}"
    echo -e "${RED}Note: This requires a keystore file. Please follow the guide to create one.${NC}"
    
    # Check if keystore exists
    if [ ! -f "android/app/servimap-release.keystore" ]; then
        echo -e "${RED}Keystore not found. Creating one now...${NC}"
        echo "Please enter the following information for your keystore:"
        
        cd android/app
        keytool -genkey -v -keystore servimap-release.keystore -alias servimap -keyalg RSA -keysize 2048 -validity 10000
        cd ../..
    fi
    
    cd android
    ./gradlew assembleRelease
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Release APK built successfully!${NC}"
        echo -e "${GREEN}Location: android/app/build/outputs/apk/release/app-release.apk${NC}"
        cp app/build/outputs/apk/release/app-release.apk ../ServiMap-release.apk
    else
        echo -e "${RED}❌ Release build failed!${NC}"
    fi
    
    cd ..
}

# Main menu
echo "Select build type:"
echo "1) Debug APK (for testing)"
echo "2) Release APK (for distribution)"
echo "3) Both"
echo "4) Clean build directories"
echo "5) Open in Android Studio"

read -p "Enter your choice (1-5): " choice

case $choice in
    1)
        build_apk
        ;;
    2)
        build_release
        ;;
    3)
        build_apk
        build_release
        ;;
    4)
        echo "Cleaning build directories..."
        cd android
        ./gradlew clean
        cd ..
        echo -e "${GREEN}✅ Clean completed!${NC}"
        ;;
    5)
        echo "Opening in Android Studio..."
        npx cap open android
        ;;
    *)
        echo -e "${RED}Invalid choice!${NC}"
        exit 1
        ;;
esac

echo ""
echo "🎉 Done! Your APK is ready for testing."
echo ""
echo "To install on a connected device:"
echo "  adb install ServiMap-debug.apk"
echo ""
echo "To share with testers:"
echo "  Upload ServiMap-debug.apk to Google Drive or similar"