# Sunflower Market Pro

Plataforma de análisis para Sunflower Land con mercado P2P, gráficos, cálculo de crafting y comparación de FLOWER por Coin.

## Publicación en Vercel

1. Descarga y descomprime este proyecto.
2. En GitHub, abre el repositorio `316107648/sfl-market-desk`.
3. Usa **Add file > Upload files** y sube todo el contenido de esta carpeta (no la carpeta exterior).
4. Escribe un mensaje como `Iniciar Sunflower Market Pro` y confirma con **Commit changes**.
5. Vercel detectará el cambio y hará el despliegue automáticamente. Si todavía estás en la pantalla inicial de Vercel, pulsa **Deploy** después de subir los archivos.

## Desarrollo local

```bash
npm install
npm run dev
```

Abre `http://localhost:3000`.

## Datos

La ruta `/api/prices` consulta `https://sfl.world/api/v1/prices` desde el servidor, evitando el bloqueo CORS del navegador. La fuente comunitaria indica que los precios se actualizan aproximadamente cada 15 minutos.

Cuando la fuente externa no responde, la interfaz muestra claramente el modo de demostración.
