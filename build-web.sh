#!/bin/bash

# Script para build de produção do frontend

echo "🚀 Iniciando build de produção para web..."

# Navegar para o diretório do frontend
cd /app/frontend

# Limpar builds anteriores
echo "🧹 Limpando builds anteriores..."
rm -rf web-build
rm -rf dist
rm -rf .expo

# Instalar dependências (se necessário)
echo "📦 Verificando dependências..."
yarn install

# Fazer build para web
echo "🔨 Construindo aplicação web..."
export NODE_ENV=production
export EXPO_PUBLIC_BACKEND_URL=${EXPO_PUBLIC_BACKEND_URL:-"http://localhost:8001"}

# Build usando expo
if yarn web:build; then
    echo "✅ Build concluído com sucesso!"
    echo "📁 Arquivos estáticos gerados em: /app/frontend/web-build"
    
    # Mostrar tamanho dos arquivos
    echo "📊 Tamanho dos arquivos:"
    du -sh web-build
    
    echo ""
    echo "🎉 Pronto para deploy!"
    echo "Arquivos podem ser servidos com qualquer servidor web (nginx, apache, etc.)"
else
    echo "❌ Erro no build!"
    exit 1
fi