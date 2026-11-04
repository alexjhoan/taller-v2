# -------------------------------------------------------------
# ETAPA 1: Compilación de la aplicación Next.js
# -------------------------------------------------------------
FROM node:18-alpine AS builder

WORKDIR /app

# Copiamos los archivos de dependencias
COPY package.json ./

# Instalamos las dependencias necesarias
RUN yarn install --frozen-lockfile

# Copiamos el resto del código del frontend
COPY . .

# Ejecutamos el script de compilación (genera la carpeta 'out')
RUN yarn build

# -------------------------------------------------------------
# ETAPA 2: Servidor Web ultraligero con Nginx
# -------------------------------------------------------------
FROM nginx:alpine AS runner

# Copiamos los archivos estáticos generados en la Etapa 1 a la carpeta pública de Nginx
COPY --from=builder /app/out /usr/share/nginx/html

# Exponemos el puerto estándar 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]