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
# Format o'zgartirish uchun: LibreOffice (Word/Excel/PowerPoint → PDF), poppler (PDF → rasm),
# pdf2docx (PDF → Word) va Microsoft shriftlariga o'lchami mos shriftlar (Times New Roman, Calibri, Cambria o'rniga)
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
    libreoffice-writer libreoffice-calc libreoffice-impress \
    poppler-utils python3-venv \
    fonts-liberation2 fonts-crosextra-carlito fonts-crosextra-caladea \
 && python3 -m venv /opt/pdf2docx \
 && /opt/pdf2docx/bin/pip install --no-cache-dir pdf2docx==0.5.13 \
 && apt-get clean && rm -rf /var/lib/apt/lists/*
ENV PDF2DOCX_PATH=/opt/pdf2docx/bin/pdf2docx
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
USER pwuser
# Sozlamalar hosting muhit o'zgaruvchilaridan olinadi, .env fayli kerak emas
CMD ["node", "dist/index.js"]
