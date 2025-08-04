#!/usr/bin/env node

/**
 * Script para generar Service Worker optimizado para ServiMap PWA
 * Combina Workbox con funcionalidades custom específicas para marketplace
 */

const fs = require('fs');
const path = require('path');

const SW_SRC = path.join(__dirname, '..', 'public', 'sw-enhanced.js');
const SW_DEST = path.join(__dirname, '..', 'public', 'sw.js');
const MANIFEST_PATH = path.join(__dirname, '..', 'public', 'manifest.json');

console.log('🔧 Generando Service Worker optimizado para ServiMap...');

try {
  // Leer el service worker enhanced
  if (fs.existsSync(SW_SRC)) {
    console.log('✅ Copiando Service Worker enhanced...');
    fs.copyFileSync(SW_SRC, SW_DEST);
  } else {
    console.log('⚠️  Service Worker enhanced no encontrado, generando básico...');
    generateBasicSW();
  }

  // Verificar manifest.json
  if (fs.existsSync(MANIFEST_PATH)) {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    console.log(`✅ Manifest válido para ${manifest.name}`);
    console.log(`   - Theme color: ${manifest.theme_color}`);
    console.log(`   - Start URL: ${manifest.start_url}`);
    console.log(`   - Display: ${manifest.display}`);
  } else {
    console.log('⚠️  Manifest.json no encontrado');
  }

  // Generar estadísticas
  const stats = fs.statSync(SW_DEST);
  console.log(`✅ Service Worker generado: ${(stats.size / 1024).toFixed(2)} KB`);
  
  console.log('\n🎉 PWA lista para producción!');
  console.log('\n📋 Próximos pasos:');
  console.log('   1. npm run build - Para construir la aplicación');
  console.log('   2. npm run pwa:serve - Para probar la PWA localmente');
  console.log('   3. Lighthouse audit para validar PWA score');

} catch (error) {
  console.error('❌ Error generando Service Worker:', error.message);
  process.exit(1);
}

function generateBasicSW() {
  const basicSW = `
// Basic Service Worker for ServiMap PWA
const CACHE_NAME = 'servimap-v1.0.0';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/offline.html',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});

console.log('ServiMap Basic SW loaded');
`;
  
  fs.writeFileSync(SW_DEST, basicSW.trim());
}