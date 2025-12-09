#!/bin/bash

# Script para servir o app web localmente (teste)

echo "🌐 Servindo aplicação web..."

cd /app/frontend

# Verificar se web-build existe
if [ ! -d "web-build" ]; then
    echo "⚠️  Pasta web-build não encontrada. Executando build primeiro..."
    bash ../build-web.sh
fi

# Instalar servidor HTTP simples se não existir
if ! command -v serve &> /dev/null; then
    echo "📦 Instalando 'serve'..."
    npm install -g serve
fi

# Servir arquivos estáticos
echo "✅ Aplicação disponível em: http://localhost:3000"
serve -s web-build -l 3000