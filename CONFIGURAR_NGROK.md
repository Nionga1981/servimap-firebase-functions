# 🚀 Configurar ngrok en 2 minutos

## Pasos rápidos:

### 1. Crear cuenta gratuita (1 minuto)
Ve a: https://dashboard.ngrok.com/signup
- Puedes usar GitHub/Google para login rápido
- Es completamente gratis

### 2. Obtener tu token (30 segundos)
Después de login, ve a:
https://dashboard.ngrok.com/get-started/your-authtoken

Copia el comando que aparece, será algo como:
```bash
ngrok config add-authtoken TU_TOKEN_AQUI
```

### 3. Ejecutar el comando del token
Pega y ejecuta el comando en tu terminal

### 4. ¡Listo! Ahora ejecuta:
```bash
ngrok http 3000
```

## Verás algo así:
```
Forwarding  https://abc123.ngrok-free.app -> http://localhost:3000
```

¡Esa URL `https://abc123.ngrok-free.app` es la que usarás en tu móvil!

## Ventajas de ngrok:
- ✅ Funciona siempre (no importa la red)
- ✅ HTTPS automático (mejor para PWA)
- ✅ URL pública accesible desde cualquier lugar
- ✅ No necesitas configurar firewall
- ✅ Funciona hasta con datos móviles