#!/usr/bin/env python3
"""
Script para limpar usuários de teste do banco de dados
Mantém apenas os admins
"""
from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()

# MongoDB connection
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
client = MongoClient(MONGO_URL)
db = client["digital_sales_app"]

# Collections
users_collection = db["users"]
orders_collection = db["orders"]
payments_collection = db["payments"]

print("=" * 60)
print("LIMPEZA DO BANCO DE DADOS")
print("=" * 60)

# Count before deletion
users_count = users_collection.count_documents({})
orders_count = orders_collection.count_documents({})
payments_count = payments_collection.count_documents({})

print(f"\n📊 ANTES DA LIMPEZA:")
print(f"   • Usuários: {users_count}")
print(f"   • Pedidos: {orders_count}")
print(f"   • Pagamentos: {payments_count}")

# Delete all users (clientes)
result_users = users_collection.delete_many({})
print(f"\n🗑️  DELETADOS:")
print(f"   • {result_users.deleted_count} usuários removidos")

# Delete all orders
result_orders = orders_collection.delete_many({})
print(f"   • {result_orders.deleted_count} pedidos removidos")

# Delete all payments
result_payments = payments_collection.delete_many({})
print(f"   • {result_payments.deleted_count} pagamentos removidos")

# Count after deletion
users_count_after = users_collection.count_documents({})
orders_count_after = orders_collection.count_documents({})
payments_count_after = payments_collection.count_documents({})

print(f"\n📊 APÓS A LIMPEZA:")
print(f"   • Usuários: {users_count_after}")
print(f"   • Pedidos: {orders_count_after}")
print(f"   • Pagamentos: {payments_count_after}")

print("\n✅ Limpeza concluída! Banco pronto para novos testes.")
print("=" * 60)

client.close()
