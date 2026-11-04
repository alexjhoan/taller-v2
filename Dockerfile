# -------------------------------------------------------------
# ETAPA 1: Compilación de la aplicación Next.js con NPM
# -------------------------------------------------------------
FROM node:18-alpine AS builder

WORKDIR /app

# Copiamos los archivos de dependencias (asegúrate de tener el package-lock.json o package.json)
COPY package.json package-lock.json* ./

# Si no existe package-lock.json, instalamos con npm install normal; si existe, usa ci para mayor velocidad
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copiamos el resto del código del frontend
COPY . .

# Ejecutamos el script de compilación (genera la carpeta 'out' definida en tu next.config.mjs)
RUN npm run build

# -------------------------------------------------------------
# ETAPA 2: Servidor Web ultraligero con Nginx
# -------------------------------------------------------------
FROM nginx:alpine AS runner

# Copiamos los archivos estáticos generados en la Etapa 1 a la carpeta pública de Nginx
COPY --from=builder /app/out /usr/share/nginx/html

# Exponemos el puerto estándar 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]