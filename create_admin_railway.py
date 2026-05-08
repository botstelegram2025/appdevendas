#!/usr/bin/env python3
"""
Script para criar admin no MongoDB do Railway
"""
from pymongo import MongoClient
from passlib.context import CryptContext
from datetime import datetime

# MongoDB connection
MONGO_URL = "mongodb://mongo:AfGFjdBxmTtPaeAsbGpKogQFNLqrXYGz@mongodb.railway.internal:27017"
DB_NAME = "digital_sales_app"

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Conectar ao MongoDB
print("🔌 Conectando ao MongoDB do Railway...")
client = MongoClient(MONGO_URL)
db = client[DB_NAME]

# Admin data
admin_cpf = "99064820104"
admin_password = "152316"
admin_name = "Administrador"

# Hash da senha
password_hash = pwd_context.hash(admin_password)

print(f"👤 Criando admin: {admin_name}")
print(f"📋 CPF: {admin_cpf}")
print(f"🔒 Senha: {admin_password}")

# Verificar se admin já existe
existing_admin = db.admins.find_one({"cpf": admin_cpf})

if existing_admin:
    print("⚠️  Admin já existe! Atualizando senha...")
    result = db.admins.update_one(
        {"cpf": admin_cpf},
        {"$set": {
            "password_hash": password_hash,
            "name": admin_name,
            "updated_at": datetime.now()
        }}
    )
    print(f"✅ Admin atualizado! Modified: {result.modified_count}")
else:
    print("➕ Criando novo admin...")
    admin_doc = {
        "cpf": admin_cpf,
        "name": admin_name,
        "password_hash": password_hash,
        "created_at": datetime.now()
    }
    result = db.admins.insert_one(admin_doc)
    print(f"✅ Admin criado com sucesso! ID: {result.inserted_id}")

# Verificar
admin = db.admins.find_one({"cpf": admin_cpf})
print("\n📊 Admin no banco:")
print(f"   - Nome: {admin['name']}")
print(f"   - CPF: {admin['cpf']}")
print(f"   - Senha hash: {admin['password_hash'][:50]}...")
print(f"   - Created: {admin.get('created_at', 'N/A')}")

print("\n✅ Pronto! Agora você pode fazer login com:")
print(f"   CPF: {admin_cpf}")
print(f"   Senha: {admin_password}")

client.close()
