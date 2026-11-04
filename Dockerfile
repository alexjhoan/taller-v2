# -------------------------------------------------------------
# ETAPA 1: Compilación de la aplicación Next.js con NPM
# -------------------------------------------------------------
FROM node:18-alpine AS builder

WORKDIR /app

# 1. Copiamos los archivos de dependencias primero para aprovechar la caché de Docker
COPY package.json package-lock.json* ./

# 2. Instalamos las dependencias
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# 3. ¡CRÍTICO! Copiamos todo el código fuente del proyecto antes de compilar
COPY . .

# 4. Ejecutamos el script de compilación (lee tu next.config.mjs y genera la carpeta 'out')
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