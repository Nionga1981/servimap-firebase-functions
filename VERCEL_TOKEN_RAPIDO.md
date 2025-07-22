# 🔑 Configurar Vercel con Token (Método Directo)

## Paso 1: Obtén tu Token
1. Ve a: https://vercel.com/account/tokens
2. Haz clic en **"Create Token"**
3. Ponle un nombre (ej: "ServiMap CLI")
4. Copia el token que aparece

## Paso 2: Usa el Token
Ejecuta este comando con TU token:
```bash
vercel --token TU_TOKEN_AQUI
```

## Alternativa: Deploy desde la Web
Si prefieres evitar el CLI, puedes hacer deploy directamente desde la web:

1. Ve a: https://vercel.com/new
2. Haz clic en **"Import Third-Party Git Repository"**
3. Pega esta URL: `https://github.com/tu-usuario/servimap`
   O si no tienes GitHub, usa **"Deploy from CLI"** y sigue las instrucciones

## Opción Más Rápida Sin Token:
Si todo esto es muy complicado, podemos usar **Netlify Drop**:
1. Ejecuta: `npm run build`
2. Ve a: https://app.netlify.com/drop
3. Arrastra la carpeta `.next` ahí
4. ¡Listo! URL instantánea sin login