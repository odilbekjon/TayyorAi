# Playwright'ning rasmiy image'ida Node, Chromium, uning tizim kutubxonalari
# va shriftlar tayyor turadi. Versiya package-lock.json dagi "playwright"
# versiyasi bilan bir xil bo'lishi shart.
ARG BASE_IMAGE=mcr.microsoft.com/playwright:v1.64.1-noble

# 1-bosqich: TypeScript'ni JavaScript'ga yig'ish
FROM ${BASE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# 2-bosqich: faqat ishga tushirish uchun kerak narsalar
FROM ${BASE_IMAGE}
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
USER pwuser
# Sozlamalar hosting muhit o'zgaruvchilaridan olinadi, .env fayli kerak emas
CMD ["node", "dist/index.js"]
