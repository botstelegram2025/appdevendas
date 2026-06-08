from fastapi import FastAPI, HTTPException, Depends, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from pymongo import MongoClient
from bson import ObjectId
import os
import jwt
import bcrypt
from dotenv import load_dotenv
import httpx
import hashlib
import hmac
import uuid
import calendar
from apscheduler.schedulers.background import BackgroundScheduler
import atexit

load_dotenv()

app = FastAPI(
    title="MARKIMAGEM TV API",
    description="API para venda de produtos digitais (IPTV, ativações)",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check endpoint para Railway
@app.get("/")
async def root():
    """
    Health check endpoint
    """
    return {
        "status": "online",
        "service": "MARKIMAGEM TV API",
        "version": "1.0.0",
        "endpoints": {
            "docs": "/docs",
            "health": "/health",
            "products": "/api/products",
            "categories": "/api/categories"
        }
    }

@app.get("/health")
async def health_check():
    """
    Health check detalhado
    """
    try:
        # Testar conexão com MongoDB
        client.server_info()
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"
    
    return {
        "status": "healthy",
        "database": db_status,
        "timestamp": datetime.now().isoformat()
    }

# MongoDB connection
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "digital_sales_app")
client = MongoClient(MONGO_URL)
db = client[DB_NAME]

# Collections
users_collection = db["users"]
admins_collection = db["admins"]
categories_collection = db["categories"]
products_collection = db["products"]
orders_collection = db["orders"]
payments_collection = db["payments"]
whatsapp_sessions_collection = db["whatsapp_sessions"]
business_hours_collection = db["business_hours"]

# Mercado Pago credentials (DESATIVADO - Usando PIX Direto)
# MERCADOPAGO_ACCESS_TOKEN = os.getenv("MERCADOPAGO_ACCESS_TOKEN")
# MERCADOPAGO_PUBLIC_KEY = os.getenv("MERCADOPAGO_PUBLIC_KEY")
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key-change-this")

# Configurações PIX Direto (Nubank)
PIX_KEY = os.getenv("PIX_KEY", "61995021362")  # Chave PIX (telefone)
PIX_KEY_TYPE = os.getenv("PIX_KEY_TYPE", "PHONE")  # PHONE, EMAIL, CPF, CNPJ, EVP
PIX_MERCHANT_NAME = os.getenv("PIX_MERCHANT_NAME", "MARQUES SOUSA LIMA DE OLIVEIRA")
PIX_MERCHANT_CITY = os.getenv("PIX_MERCHANT_CITY", "BRASILIA")

# Configurações de isolamento WhatsApp
WHATSAPP_INSTANCE_PREFIX = os.getenv("WHATSAPP_INSTANCE_PREFIX", "mkimg_")
WHATSAPP_ALLOWED_NUMBER = os.getenv("WHATSAPP_ALLOWED_NUMBER", "556195179918")
print(f"🔒 WhatsApp - Prefixo: {WHATSAPP_INSTANCE_PREFIX}, Número autorizado: {WHATSAPP_ALLOWED_NUMBER}")

def generate_pix_payload(amount: float, txid: str = None, description: str = None) -> str:
    """
    Gera o payload PIX (BR Code) para QR Code
    Formato EMV conforme especificação do Banco Central do Brasil
    """
    
    # Função para calcular CRC16-CCITT-FALSE (padrão PIX)
    def calculate_crc16(payload: str) -> str:
        crc = 0xFFFF
        polynomial = 0x1021
        
        for byte in payload.encode('utf-8'):
            crc ^= (byte << 8)
            for _ in range(8):
                if crc & 0x8000:
                    crc = ((crc << 1) ^ polynomial) & 0xFFFF
                else:
                    crc = (crc << 1) & 0xFFFF
        
        return format(crc, '04X')
    
    # Função para criar campo TLV (Tag-Length-Value)
    def tlv(tag: str, value: str) -> str:
        length = str(len(value)).zfill(2)
        return f"{tag}{length}{value}"
    
    # Formatar chave PIX (telefone precisa de +55)
    pix_key = PIX_KEY
    if PIX_KEY_TYPE == "PHONE":
        pix_key = f"+55{PIX_KEY}" if not PIX_KEY.startswith("+") else PIX_KEY
    
    # Merchant Account Information (ID 26)
    # 00: GUI do PIX (br.gov.bcb.pix)
    # 01: Chave PIX
    gui = tlv("00", "br.gov.bcb.pix")
    key = tlv("01", pix_key)
    merchant_account = tlv("26", gui + key)
    
    # Montar payload
    payload_parts = []
    
    # 00 - Payload Format Indicator
    payload_parts.append(tlv("00", "01"))
    
    # 01 - Point of Initiation Method (12 = dinâmico, pode ser usado uma vez)
    payload_parts.append(tlv("01", "12"))
    
    # 26 - Merchant Account Information
    payload_parts.append(merchant_account)
    
    # 52 - Merchant Category Code (0000 = não especificado)
    payload_parts.append(tlv("52", "0000"))
    
    # 53 - Transaction Currency (986 = BRL)
    payload_parts.append(tlv("53", "986"))
    
    # 54 - Transaction Amount
    amount_str = f"{amount:.2f}"
    payload_parts.append(tlv("54", amount_str))
    
    # 58 - Country Code
    payload_parts.append(tlv("58", "BR"))
    
    # 59 - Merchant Name (máximo 25 caracteres)
    merchant_name = PIX_MERCHANT_NAME[:25].upper()
    payload_parts.append(tlv("59", merchant_name))
    
    # 60 - Merchant City (máximo 15 caracteres)
    merchant_city = PIX_MERCHANT_CITY[:15].upper()
    payload_parts.append(tlv("60", merchant_city))
    
    # 62 - Additional Data Field Template
    if txid:
        # 05 - Reference Label (txid)
        txid_field = tlv("05", txid[:25])
        payload_parts.append(tlv("62", txid_field))
    
    # Juntar payload sem CRC
    payload_without_crc = "".join(payload_parts)
    
    # Adicionar campo CRC (63) com placeholder
    payload_with_crc_placeholder = payload_without_crc + "6304"
    
    # Calcular CRC16
    crc = calculate_crc16(payload_with_crc_placeholder)
    
    # Payload final
    final_payload = payload_without_crc + "6304" + crc
    
    return final_payload

# WAHA WhatsApp API credentials (New Multi-Instance API)
WAHA_API_URL = os.getenv("WAHA_API_URL", "https://scintillating-growth-production.up.railway.app")
WAHA_API_TOKEN = os.getenv("WAHA_API_TOKEN", "")
WAHA_API_EMAIL = os.getenv("WAHA_API_EMAIL", "markimgem2014@gmail.com")
WAHA_API_PASSWORD = os.getenv("WAHA_API_PASSWORD", "Aw@3eszx")
WAHA_SESSION = os.getenv("WAHA_SESSION", "default")
ADMIN_WHATSAPP_NUMBER = os.getenv("ADMIN_WHATSAPP", "556195021362")

# Cache para o token da API WhatsApp
_whatsapp_token_cache = {
    "token": WAHA_API_TOKEN,
    "expires_at": None
}

async def get_whatsapp_api_token():
    """Obtém token válido da API WhatsApp, renovando se necessário"""
    global _whatsapp_token_cache
    
    # Se já temos um token e não expirou, usar ele
    if _whatsapp_token_cache["token"] and _whatsapp_token_cache["expires_at"]:
        if datetime.utcnow() < _whatsapp_token_cache["expires_at"]:
            return _whatsapp_token_cache["token"]
    
    # Token expirado ou não existe, fazer login
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{WAHA_API_URL}/api/auth/login",
                json={
                    "email": WAHA_API_EMAIL,
                    "password": WAHA_API_PASSWORD
                },
                timeout=10.0
            )
            
            if response.status_code == 200:
                data = response.json()
                new_token = data.get("access_token")
                if new_token:
                    # Token válido por ~23 horas (margem de segurança)
                    _whatsapp_token_cache["token"] = new_token
                    _whatsapp_token_cache["expires_at"] = datetime.utcnow() + timedelta(hours=23)
                    print(f"✅ Token WhatsApp API renovado com sucesso")
                    return new_token
            
            print(f"⚠️ Falha ao renovar token WhatsApp: {response.status_code}")
            # Retornar token antigo como fallback
            return _whatsapp_token_cache["token"] or WAHA_API_TOKEN
            
    except Exception as e:
        print(f"❌ Erro ao renovar token WhatsApp: {e}")
        return _whatsapp_token_cache["token"] or WAHA_API_TOKEN

# Pydantic Models
class UserRegister(BaseModel):
    name: str
    phone: str
    cpf: str
    email: Optional[str] = None
    password: str

class UserLogin(BaseModel):
    identifier: str  # CPF or phone
    password: str

class AdminLogin(BaseModel):
    cpf: str
    password: str

class Category(BaseModel):
    name: str
    icon: str = "📦"
    order: int = 0
    active: bool = True

class ProductCreate(BaseModel):
    name: str
    description: str
    price: float
    category_id: str
    type: str  # "activation" or "credits"
    required_fields: List[str] = []
    discount_rules: List[Dict[str, Any]] = []  # [{"min_quantity": 20, "discount_percent": 5}]
    active: bool = True
    image: Optional[str] = None  # Base64 encoded image
    links: Optional[List[Dict[str, Any]]] = []  # [{"title": "Link", "url": "https://...", "visibility": "admin_only" | "all"}]

class OrderItem(BaseModel):
    product_id: str
    quantity: int = 1
    unit_price: float
    fields_data: Dict[str, str] = {}  # {"MAC": "ABC123", "OTP": "xyz"}
    subtotal: float

class OrderCreate(BaseModel):
    items: List[OrderItem]
    total: float
    discount: float = 0
    final_total: float

class PaymentCreate(BaseModel):
    order_id: str
    payer_email: str

# Helper functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, role: str = "user") -> str:
    payload = {
        "user_id": user_id,
        "role": role,
        "exp": datetime.utcnow() + timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def verify_token(token: str) -> Dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except:
        raise HTTPException(status_code=401, detail="Invalid token")

def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.replace("Bearer ", "")
    return verify_token(token)

def get_admin_user(authorization: str = Header(None)):
    user = get_current_user(authorization)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# Routes
@app.get("/api/health")
async def health_check():
    return {"status": "ok", "message": "Digital Sales API"}

# Auth Routes
@app.post("/api/auth/register")
async def register(user: UserRegister):
    # Check if user exists
    if users_collection.find_one({"$or": [{"cpf": user.cpf}, {"phone": user.phone}]}):
        raise HTTPException(status_code=400, detail="User already exists")
    
    # Normalizar telefone para garantir que começa com 55
    normalized_phone = normalize_phone_number(user.phone)
    
    user_doc = {
        "name": user.name,
        "phone": normalized_phone,
        "cpf": user.cpf,
        "email": user.email,
        "password_hash": hash_password(user.password),
        "created_at": datetime.utcnow()
    }
    result = users_collection.insert_one(user_doc)
    token = create_token(str(result.inserted_id), "user")
    
    return {
        "token": token,
        "user": {
            "id": str(result.inserted_id),
            "name": user.name,
            "phone": user.phone,
            "email": user.email
        }
    }

@app.post("/api/auth/login")
async def login(credentials: UserLogin):
    user = users_collection.find_one({
        "$or": [{"cpf": credentials.identifier}, {"phone": credentials.identifier}]
    })
    
    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(str(user["_id"]), "user")
    
    return {
        "token": token,
        "user": {
            "id": str(user["_id"]),
            "name": user["name"],
            "phone": user["phone"],
            "email": user.get("email")
        }
    }

@app.get("/api/auth/me")
async def get_me(current_user: Dict = Depends(get_current_user)):
    user = users_collection.find_one({"_id": ObjectId(current_user["user_id"])})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "id": str(user["_id"]),
        "name": user["name"],
        "phone": user["phone"],
        "email": user.get("email")
    }

@app.put("/api/auth/profile")
async def update_profile(
    name: Optional[str] = None,
    phone: Optional[str] = None,
    email: Optional[str] = None,
    current_user: Dict = Depends(get_current_user)
):
    user_id = current_user["user_id"]
    update_data = {}
    
    if name:
        update_data["name"] = name
    if phone:
        update_data["phone"] = normalize_phone_number(phone)
    if email:
        update_data["email"] = email
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": update_data}
    )
    
    updated_user = users_collection.find_one({"_id": ObjectId(user_id)})
    
    return {
        "id": str(updated_user["_id"]),
        "name": updated_user["name"],
        "phone": updated_user["phone"],
        "email": updated_user.get("email")
    }

# Admin Auth
@app.post("/api/admin/login")
async def admin_login(credentials: AdminLogin):
    admin = admins_collection.find_one({"cpf": credentials.cpf})
    
    if not admin or not verify_password(credentials.password, admin["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid admin credentials")
    
    token = create_token(str(admin["_id"]), "admin")
    
    return {
        "token": token,
        "admin": {
            "id": str(admin["_id"]),
            "name": admin["name"],
            "cpf": admin["cpf"]
        }
    }

@app.post("/api/admin/create")
async def create_admin(name: str, cpf: str, password: str):
    # Check if admin exists
    if admins_collection.find_one({"cpf": cpf}):
        raise HTTPException(status_code=400, detail="Admin already exists")
    
    admin_doc = {
        "name": name,
        "cpf": cpf,
        "password_hash": hash_password(password),
        "role": "admin",
        "created_at": datetime.utcnow()
    }
    result = admins_collection.insert_one(admin_doc)
    
    return {"id": str(result.inserted_id), "message": "Admin created successfully"}

# Categories Routes
@app.get("/api/categories")
async def get_categories():
    categories = list(categories_collection.find({"active": True}).sort("order", 1))
    for cat in categories:
        cat["id"] = str(cat["_id"])
        del cat["_id"]
    return categories

@app.post("/api/categories")
async def create_category(category: Category, current_user: Dict = Depends(get_admin_user)):
    cat_doc = category.dict()
    cat_doc["created_at"] = datetime.utcnow()
    result = categories_collection.insert_one(cat_doc)
    cat_doc["id"] = str(result.inserted_id)
    del cat_doc["_id"]
    return cat_doc

@app.put("/api/categories/{category_id}")
async def update_category(category_id: str, category: Category, current_user: Dict = Depends(get_admin_user)):
    result = categories_collection.update_one(
        {"_id": ObjectId(category_id)},
        {"$set": category.dict()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"message": "Category updated"}

@app.delete("/api/categories/{category_id}")
async def delete_category(category_id: str, current_user: Dict = Depends(get_admin_user)):
    # Check if category has products
    if products_collection.find_one({"category_id": category_id}):
        raise HTTPException(status_code=400, detail="Category has products")
    
    result = categories_collection.delete_one({"_id": ObjectId(category_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"message": "Category deleted"}

# Products Routes
@app.get("/api/products")
async def get_products(category_id: Optional[str] = None):
    query = {"active": True}
    if category_id:
        query["category_id"] = category_id
    
    products = list(products_collection.find(query))
    for prod in products:
        prod["id"] = str(prod["_id"])
        del prod["_id"]
        # Converter campo 'image' para 'image_url' para compatibilidade frontend
        if prod.get("image"):
            prod["image_url"] = prod["image"]
        # Para usuários normais, filtrar links - mostrar apenas os com visibility "all"
        if prod.get("links"):
            prod["links"] = [link for link in prod["links"] if link.get("visibility") == "all"]
    return products

@app.get("/api/admin/products")
async def get_products_admin(category_id: Optional[str] = None, current_user: Dict = Depends(get_admin_user)):
    """Lista produtos para admin - inclui TODOS os links"""
    query = {}
    if category_id:
        query["category_id"] = category_id
    
    products = list(products_collection.find(query))
    for prod in products:
        prod["id"] = str(prod["_id"])
        del prod["_id"]
        if prod.get("image"):
            prod["image_url"] = prod["image"]
        # Admin vê todos os links
    return products

@app.get("/api/products/{product_id}")
async def get_product(product_id: str):
    product = products_collection.find_one({"_id": ObjectId(product_id)})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    product["id"] = str(product["_id"])
    del product["_id"]
    # Converter campo 'image' para 'image_url' para compatibilidade frontend
    if product.get("image"):
        product["image_url"] = product["image"]
    # Para usuários normais, filtrar links
    if product.get("links"):
        product["links"] = [link for link in product["links"] if link.get("visibility") == "all"]
    return product

@app.post("/api/products")
async def create_product(product: ProductCreate, current_user: Dict = Depends(get_admin_user)):
    prod_doc = product.dict()
    prod_doc["created_at"] = datetime.utcnow()
    result = products_collection.insert_one(prod_doc)
    prod_doc["id"] = str(result.inserted_id)
    del prod_doc["_id"]
    return prod_doc

@app.put("/api/products/{product_id}")
async def update_product(product_id: str, product: ProductCreate, current_user: Dict = Depends(get_admin_user)):
    result = products_collection.update_one(
        {"_id": ObjectId(product_id)},
        {"$set": product.dict()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product updated"}

@app.delete("/api/products/{product_id}")
async def delete_product(product_id: str, current_user: Dict = Depends(get_admin_user)):
    result = products_collection.delete_one({"_id": ObjectId(product_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product deleted"}

@app.patch("/api/products/{product_id}/toggle-status")
async def toggle_product_status(product_id: str, current_user: Dict = Depends(get_admin_user)):
    """Toggle product online/offline status"""
    product = products_collection.find_one({"_id": ObjectId(product_id)})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Toggle o status active
    new_status = not product.get("active", True)
    
    products_collection.update_one(
        {"_id": ObjectId(product_id)},
        {"$set": {"active": new_status}}
    )
    
    return {
        "message": f"Produto {'ativado' if new_status else 'desativado'} com sucesso",
        "active": new_status
    }

# Orders Routes
@app.post("/api/orders")
async def create_order(order: OrderCreate, current_user: Dict = Depends(get_current_user)):
    order_doc = order.dict()
    order_doc["user_id"] = current_user["user_id"]
    order_doc["payment_status"] = "pending"
    order_doc["delivery_status"] = "awaiting_payment"
    order_doc["created_at"] = datetime.utcnow()
    order_doc["updated_at"] = datetime.utcnow()
    
    result = orders_collection.insert_one(order_doc)
    order_doc["id"] = str(result.inserted_id)
    order_id_short = str(result.inserted_id)[:8]
    del order_doc["_id"]
    
    # Get user info for notification
    user = users_collection.find_one({"_id": ObjectId(current_user["user_id"])})
    
    # Send WhatsApp notification to admin with ALL product details
    if user:
        # Build detailed product list with custom fields
        products_detail = []
        for item in order_doc['items']:
            product = products_collection.find_one({"_id": ObjectId(item["product_id"])})
            if product:
                product_line = f"• {product['name']} (x{item['quantity']}) - R$ {item['subtotal']:.2f}"
                products_detail.append(product_line)
                
                # Add ALL custom fields if present
                if item.get("fields_data"):
                    for field_name, field_value in item["fields_data"].items():
                        products_detail.append(f"  ↳ *{field_name}:* {field_value}")
        
        products_text = "\n".join(products_detail)
        
        admin_message = f"""🔔 *NOVO PEDIDO - MARKIMAGEM TV*

📦 Pedido: #{order_id_short}

👤 *Dados do Cliente:*
   • Nome: {user['name']}
   • Telefone: {user['phone']}
   • Email: {user.get('email', 'N/A')}
   • CPF: {user.get('cpf', 'N/A')}

💰 *Valor Total:* R$ {order_doc['final_total']:.2f}

📋 *Produtos e Dados:*
{products_text}

⏳ Status: Aguardando pagamento"""
        
        await send_whatsapp_notification(ADMIN_WHATSAPP_NUMBER, admin_message)
    
    return order_doc

@app.get("/api/orders")
async def get_orders(current_user: Dict = Depends(get_current_user)):
    orders = list(orders_collection.find({"user_id": current_user["user_id"]}).sort("created_at", -1))
    for order in orders:
        order["id"] = str(order["_id"])
        order_id = order["id"]
        del order["_id"]
        
        # Add payment_id if exists
        payment = payments_collection.find_one({"order_id": order_id})
        if payment:
            order["payment_id"] = payment.get("mercadopago_id") or payment.get("payment_id")
        
        # Enriquecer items com informações do produto
        for item in order.get("items", []):
            product = products_collection.find_one({"_id": ObjectId(item["product_id"])})
            if product:
                item["product_name"] = product["name"]
                item["product_image"] = product.get("image") or product.get("image_url")
    return orders

@app.get("/api/orders/{order_id}")
async def get_order(order_id: str, current_user: Dict = Depends(get_current_user)):
    order = orders_collection.find_one({"_id": ObjectId(order_id), "user_id": current_user["user_id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order["id"] = str(order["_id"])
    del order["_id"]
    
    # Enriquecer items com informações do produto (nome, imagem, links visíveis)
    for item in order.get("items", []):
        product = products_collection.find_one({"_id": ObjectId(item["product_id"])})
        if product:
            item["product_name"] = product["name"]
            item["product_image"] = product.get("image") or product.get("image_url")
            # Incluir apenas links visíveis para usuários (visibility == "all")
            product_links = product.get("links", [])
            item["product_links"] = [link for link in product_links if link.get("visibility") == "all"]
    
    return order

# Admin Orders
@app.get("/api/admin/orders")
async def get_admin_orders(
    status: Optional[str] = None,
    current_user: Dict = Depends(get_admin_user)
):
    query = {}
    if status:
        query["payment_status"] = status
    
    orders = list(orders_collection.find(query).sort("created_at", -1))
    for order in orders:
        order["id"] = str(order["_id"])
        # Get user info
        user = users_collection.find_one({"_id": ObjectId(order["user_id"])})
        if user:
            order["user_name"] = user["name"]
            order["user_phone"] = user["phone"]
            order["user_email"] = user.get("email")
            order["user_cpf"] = user.get("cpf")
        
        # Add product names to items
        for item in order.get("items", []):
            product = products_collection.find_one({"_id": ObjectId(item["product_id"])})
            if product:
                item["product_name"] = product["name"]
        
        del order["_id"]
    return orders

@app.get("/api/admin/orders/{order_id}")
async def get_admin_order(order_id: str, current_user: Dict = Depends(get_admin_user)):
    order = orders_collection.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order["id"] = str(order["_id"])
    # Get user info
    user = users_collection.find_one({"_id": ObjectId(order["user_id"])})
    if user:
        order["user_name"] = user["name"]
        order["user_phone"] = user["phone"]
        order["user_email"] = user.get("email")
        order["user_cpf"] = user.get("cpf")
    
    # Add product names to items
    for item in order.get("items", []):
        product = products_collection.find_one({"_id": ObjectId(item["product_id"])})
        if product:
            item["product_name"] = product["name"]
    
    del order["_id"]
    return order

@app.put("/api/admin/orders/{order_id}/deliver")
async def deliver_order(order_id: str, current_user: Dict = Depends(get_admin_user)):
    # Get order before updating
    order = orders_collection.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Update order status
    result = orders_collection.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {"delivery_status": "delivered", "delivered_at": datetime.utcnow(), "updated_at": datetime.utcnow()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Get user info for notification
    user = users_collection.find_one({"_id": ObjectId(order["user_id"])})
    
    if user and user.get('phone'):
        order_id_short = str(order["_id"])[:8]
        
        # Build product list message
        products_list = []
        for item in order["items"]:
            product = products_collection.find_one({"_id": ObjectId(item["product_id"])})
            if product:
                products_list.append(f"• {product['name']} (x{item['quantity']})")
                
                # Add custom fields if present
                if item.get("fields_data"):
                    for field_name, field_value in item["fields_data"].items():
                        products_list.append(f"  ↳ {field_name}: {field_value}")
        
        products_text = "\n".join(products_list)
        
        # Notify customer
        customer_message = f"""🎉 *Pedido Entregue - MARKIMAGEM TV*

Olá {user['name']}! 

Seu pedido foi entregue! ✅

📦 Pedido: #{order_id_short}
💵 Valor pago: R$ {order['final_total']:.2f}

📋 *Produtos e Dados:*
{products_text}

✨ Agradecemos pela compra!
Para dúvidas, entre em contato com o seu master!"""
        
        await send_whatsapp_notification(user['phone'], customer_message)
    
    return {"message": "Order marked as delivered"}

@app.post("/api/admin/orders/{order_id}/cancel")
async def cancel_order(order_id: str, current_user: Dict = Depends(get_admin_user)):
    """Cancelar pedido - pode ser cancelado em qualquer status"""
    # Get order before updating
    order = orders_collection.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Check if already cancelled
    if order.get("payment_status") == "cancelled":
        raise HTTPException(status_code=400, detail="Order is already cancelled")
    
    # Update order status to cancelled
    result = orders_collection.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {
            "payment_status": "cancelled",
            "delivery_status": "cancelled",
            "cancelled_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Get user info for notification
    user = users_collection.find_one({"_id": ObjectId(order["user_id"])})
    
    if user and user.get('phone'):
        order_id_short = str(order["_id"])[:8]
        
        # Notify customer about cancellation
        customer_message = f"""⚠️ *Pedido Cancelado - MARKIMAGEM TV*

Olá {user['name']}!

Seu pedido foi cancelado devido a informações inválidas nos dados fornecidos (MAC, OTP, etc).

📦 Pedido: #{order_id_short}
💵 Valor: R$ {order['final_total']:.2f}

💰 *O valor será estornado* de acordo com as políticas do meio de pagamento utilizado.

Se houver dúvidas, entre em contato conosco.

Obrigado pela compreensão! 🙏"""
        
        await send_whatsapp_notification(user['phone'], customer_message)
        
        # Also notify admin
        admin_message = f"""❌ *Pedido Cancelado*

📦 Pedido #{order_id_short} foi cancelado
👤 Cliente: {user['name']}
📞 Telefone: {user.get('phone', 'N/A')}
💵 Valor: R$ {order['final_total']:.2f}

✅ Cliente notificado sobre o cancelamento e estorno."""
        
        await send_whatsapp_notification(ADMIN_WHATSAPP_NUMBER, admin_message)
    
    return {"message": "Order cancelled successfully"}

# Payments Routes - PIX DIRETO (Nubank)
@app.post("/api/payments/create-pix")
async def create_pix_payment(payment_data: PaymentCreate, current_user: Dict = Depends(get_current_user)):
    """Cria pagamento PIX direto (sem gateway) e envia notificações"""
    
    # Get order
    order = orders_collection.find_one({"_id": ObjectId(payment_data.order_id), "user_id": current_user["user_id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order["payment_status"] != "pending":
        raise HTTPException(status_code=400, detail="Order already paid or cancelled")
    
    # Get user data
    user = users_collection.find_one({"_id": ObjectId(current_user["user_id"])})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        # Gerar ID único para o pagamento
        payment_id = str(uuid.uuid4())[:8].upper()
        txid = f"PED{payment_data.order_id[:8].upper()}"
        
        # Gerar payload PIX
        amount = float(order["final_total"])
        pix_payload = generate_pix_payload(amount=amount, txid=txid)
        
        # Salvar pagamento no banco
        payment_doc = {
            "order_id": payment_data.order_id,
            "payment_id": payment_id,
            "payment_method": "pix_direto",
            "status": "pending",
            "status_detail": "awaiting_payment",
            "pix_payload": pix_payload,
            "amount": amount,
            "txid": txid,
            "pix_key": PIX_KEY,
            "merchant_name": PIX_MERCHANT_NAME,
            "created_at": datetime.utcnow()
        }
        payments_collection.insert_one(payment_doc)
        
        # Atualizar pedido com informações do pagamento
        orders_collection.update_one(
            {"_id": ObjectId(payment_data.order_id)},
            {"$set": {
                "payment_id": payment_id,
                "pix_payload": pix_payload,
                "updated_at": datetime.utcnow()
            }}
        )
        
        # Preparar dados do pedido para notificações
        items_list = ""
        for item in order.get("items", []):
            items_list += f"• {item.get('name', 'Produto')} x{item.get('quantity', 1)} - R$ {item.get('price', 0):.2f}\n"
        
        delivery_info = order.get("delivery_info", {})
        address_text = ""
        if delivery_info:
            address_text = f"""
📍 *Endereço de Entrega:*
{delivery_info.get('street', '')} {delivery_info.get('number', '')}
{delivery_info.get('complement', '')}
{delivery_info.get('neighborhood', '')} - {delivery_info.get('city', '')}/{delivery_info.get('state', '')}
CEP: {delivery_info.get('zipCode', '')}"""
        
        # NOTIFICAÇÃO PARA O CLIENTE
        client_message = f"""🛒 *PEDIDO CRIADO COM SUCESSO!*

Olá {user.get('name', 'Cliente')}! 👋

Seu pedido foi registrado e está aguardando pagamento.

📦 *DETALHES DO PEDIDO:*
Nº do Pedido: *{payment_data.order_id[:8].upper()}*

🛍️ *Itens:*
{items_list}
💰 *Subtotal:* R$ {order.get('subtotal', 0):.2f}
🚚 *Frete:* R$ {order.get('delivery_fee', 0):.2f}
💵 *TOTAL:* R$ {amount:.2f}
{address_text}

━━━━━━━━━━━━━━━━━━━━━━
💳 *INSTRUÇÕES DE PAGAMENTO:*

1️⃣ Abra o app do seu banco
2️⃣ Escolha a opção PIX
3️⃣ Escaneie o QR Code ou copie o código abaixo
4️⃣ Confirme o pagamento de *R$ {amount:.2f}*

🔑 *Chave PIX (Copiar e Colar):*
```
{pix_payload}
```

⏳ *Após o pagamento, aguarde a confirmação.*
Você receberá uma mensagem quando o pagamento for confirmado!

━━━━━━━━━━━━━━━━━━━━━━
Obrigado por comprar conosco! 🙏
*MARKIMAGEM TV*"""

        # NOTIFICAÇÃO PARA O ADMIN
        admin_message = f"""🔔 *NOVO PEDIDO RECEBIDO!*

📱 *Cliente:* {user.get('name', 'N/A')}
📞 *Telefone:* {user.get('phone', 'N/A')}
📧 *Email:* {user.get('email', 'N/A')}
🆔 *CPF:* {user.get('cpf', 'N/A')}

📦 *PEDIDO #{payment_data.order_id[:8].upper()}*

🛍️ *Itens:*
{items_list}
💰 *Subtotal:* R$ {order.get('subtotal', 0):.2f}
🚚 *Frete:* R$ {order.get('delivery_fee', 0):.2f}
💵 *TOTAL:* R$ {amount:.2f}
{address_text}

━━━━━━━━━━━━━━━━━━━━━━
⏳ *Status:* AGUARDANDO PAGAMENTO PIX

🔔 Quando o pagamento for recebido na sua conta Nubank, confirme o pedido no painel admin.

⏰ Pedido criado em: {datetime.now().strftime('%d/%m/%Y %H:%M')}"""

        # Enviar notificações via WhatsApp
        try:
            # Notificar cliente
            if user.get("phone"):
                await send_whatsapp_notification(user["phone"], client_message)
            
            # Notificar admin
            await send_whatsapp_notification(ADMIN_WHATSAPP_NUMBER, admin_message)
        except Exception as e:
            print(f"Erro ao enviar notificações WhatsApp: {e}")
        
        return {
            "payment_id": payment_id,
            "status": "pending",
            "status_detail": "awaiting_payment",
            "pix_payload": pix_payload,
            "pix_key": PIX_KEY,
            "merchant_name": PIX_MERCHANT_NAME,
            "amount": amount,
            "message": "Realize o pagamento via PIX e aguarde a confirmação"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Erro ao criar pagamento PIX: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao processar pagamento: {str(e)}")

@app.get("/api/payments/{payment_id}/status")
async def check_payment_status(payment_id: str, current_user: Dict = Depends(get_current_user)):
    """Verifica status do pagamento PIX"""
    # Buscar pagamento pelo payment_id ou order_id
    payment = payments_collection.find_one({"payment_id": payment_id})
    if not payment:
        payment = payments_collection.find_one({"order_id": payment_id})
    
    if not payment:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado")
    
    return {
        "status": payment.get("status", "pending"),
        "status_detail": payment.get("status_detail", "awaiting_payment"),
        "payment_method": payment.get("payment_method", "pix_direto"),
        "amount": payment.get("amount", 0),
        "message": "Aguardando confirmação do pagamento" if payment.get("status") == "pending" else "Pagamento confirmado"
    }

@app.post("/api/admin/payments/{payment_id}/confirm")
async def confirm_payment_admin(payment_id: str, current_user: Dict = Depends(get_admin_user)):
    """Admin confirma recebimento do PIX manualmente"""
    
    # Buscar pagamento pelo payment_id ou order_id
    payment = payments_collection.find_one({"payment_id": payment_id})
    if not payment:
        payment = payments_collection.find_one({"order_id": payment_id})
    
    if not payment:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado")
    
    if payment.get("status") == "approved":
        raise HTTPException(status_code=400, detail="Pagamento já foi confirmado")
    
    # Atualizar status do pagamento
    payments_collection.update_one(
        {"_id": payment["_id"]},
        {"$set": {
            "status": "approved",
            "status_detail": "confirmed_by_admin",
            "confirmed_at": datetime.utcnow(),
            "confirmed_by": current_user["user_id"]
        }}
    )
    
    # Atualizar status do pedido
    orders_collection.update_one(
        {"_id": ObjectId(payment["order_id"])},
        {"$set": {
            "payment_status": "paid",
            "delivery_status": "processing",
            "updated_at": datetime.utcnow()
        }}
    )
    
    # Buscar dados do pedido e usuário para notificação
    order = orders_collection.find_one({"_id": ObjectId(payment["order_id"])})
    user = users_collection.find_one({"_id": ObjectId(order["user_id"])}) if order else None
    
    if order and user:
        # Enviar notificação de pagamento confirmado
        await send_payment_approved_notifications(order, user)
    
    return {
        "success": True,
        "message": "Pagamento confirmado com sucesso",
        "order_id": payment["order_id"]
    }

@app.post("/api/payments/{payment_id}/simulate-approval")
async def simulate_payment_approval(payment_id: str, current_user: Dict = Depends(get_current_user)):
    """Endpoint para simular aprovação de pagamento (apenas para testes)"""
    payment = payments_collection.find_one({"payment_id": payment_id})
    if not payment:
        payment = payments_collection.find_one({"order_id": payment_id})
    
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    # Update payment status
    payments_collection.update_one(
        {"_id": payment["_id"]},
        {"$set": {"status": "approved", "status_detail": "simulated"}}
    )
    
    # Update order status
    orders_collection.update_one(
        {"_id": ObjectId(payment["order_id"])},
        {"$set": {"payment_status": "paid", "delivery_status": "processing", "updated_at": datetime.utcnow()}}
    )
    
    # Send notifications using the helper function
    order = orders_collection.find_one({"_id": ObjectId(payment["order_id"])})
    user = users_collection.find_one({"_id": ObjectId(order["user_id"])}) if order else None
    
    if order and user:
        await send_payment_approved_notifications(order, user)
    
    return {"status": "approved", "message": "Payment simulated as approved"}

@app.post("/api/payments/webhook")
async def payment_webhook(request: Request):
    body = await request.body()
    data = await request.json()
    
    # Process webhook
    if data.get("type") == "payment":
        payment_id = data["data"]["id"]
        
        # Get payment status from MP
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://api.mercadopago.com/v1/payments/{payment_id}",
                headers={"Authorization": f"Bearer {MERCADOPAGO_ACCESS_TOKEN}"},
                timeout=30.0
            )
        
        if response.status_code == 200:
            mp_response = response.json()
            status = mp_response["status"]
            
            # Update payment and order
            payment = payments_collection.find_one({"mercadopago_id": str(payment_id)})
            if payment:
                old_status = payment.get("status", "pending")
                
                payments_collection.update_one(
                    {"mercadopago_id": str(payment_id)},
                    {"$set": {"status": status}}
                )
                
                # Only process if status changed to approved
                if status == "approved" and old_status != "approved":
                    orders_collection.update_one(
                        {"_id": ObjectId(payment["order_id"])},
                        {"$set": {"payment_status": "paid", "delivery_status": "processing", "updated_at": datetime.utcnow()}}
                    )
                    
                    # Get order and user info for notifications
                    order = orders_collection.find_one({"_id": ObjectId(payment["order_id"])})
                    user = users_collection.find_one({"_id": ObjectId(order["user_id"])}) if order else None
                    
                    if order and user:
                        # Send notifications using the helper function
                        await send_payment_approved_notifications(order, user)
    
    return {"status": "ok"}

# Dashboard Routes
@app.get("/api/admin/dashboard/stats")
async def get_dashboard_stats(period: str = "month", current_user: Dict = Depends(get_admin_user)):
    """
    Estatísticas do dashboard com filtro de período
    period: 'week', 'month', 'year'
    """
    now = datetime.utcnow()
    
    # Definir período atual e anterior baseado no filtro
    if period == "week":
        # Semana atual (últimos 7 dias)
        current_period_start = now - timedelta(days=7)
        prev_period_start = now - timedelta(days=14)
        prev_period_end = current_period_start
    elif period == "year":
        # Ano atual
        current_period_start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        prev_period_start = current_period_start.replace(year=now.year - 1)
        prev_period_end = current_period_start
    else:  # month (padrão)
        # Mês atual
        current_period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if now.month == 1:
            prev_period_start = current_period_start.replace(year=now.year - 1, month=12)
        else:
            prev_period_start = current_period_start.replace(month=now.month - 1)
        prev_period_end = current_period_start
    
    # Current period stats
    current_period_orders = list(orders_collection.find({
        "payment_status": {"$in": ["paid", "approved"]},
        "created_at": {"$gte": current_period_start}
    }))
    
    current_revenue = sum(order["final_total"] for order in current_period_orders)
    current_count = len(current_period_orders)
    
    # Previous period stats
    prev_period_orders = list(orders_collection.find({
        "payment_status": {"$in": ["paid", "approved"]},
        "created_at": {"$gte": prev_period_start, "$lt": prev_period_end}
    }))
    
    prev_revenue = sum(order["final_total"] for order in prev_period_orders)
    prev_count = len(prev_period_orders)
    
    # Calculate percentage changes
    revenue_change = 0
    if prev_revenue > 0:
        revenue_change = ((current_revenue - prev_revenue) / prev_revenue) * 100
    
    orders_change = 0
    if prev_count > 0:
        orders_change = ((current_count - prev_count) / prev_count) * 100
    
    # Status counts (sempre do período atual)
    pending_count = orders_collection.count_documents({
        "payment_status": "pending",
        "created_at": {"$gte": current_period_start}
    })
    processing_count = orders_collection.count_documents({
        "payment_status": {"$in": ["paid", "approved"]},
        "delivery_status": {"$ne": "delivered"},
        "created_at": {"$gte": current_period_start}
    })
    delivered_count = orders_collection.count_documents({
        "delivery_status": "delivered",
        "created_at": {"$gte": current_period_start}
    })
    cancelled_count = orders_collection.count_documents({
        "payment_status": "cancelled",
        "created_at": {"$gte": current_period_start}
    })
    
    # Average ticket
    avg_ticket = current_revenue / current_count if current_count > 0 else 0
    
    # Calcular média diária de vendas
    days_in_period = (now - current_period_start).days + 1  # +1 para incluir hoje
    if days_in_period == 0:
        days_in_period = 1
    
    daily_avg_revenue = current_revenue / days_in_period
    daily_avg_orders = current_count / days_in_period
    
    # Top selling day
    day_sales = {}
    for order in current_period_orders:
        day_key = order["created_at"].strftime("%Y-%m-%d")
        if day_key not in day_sales:
            day_sales[day_key] = {"revenue": 0, "count": 0}
        day_sales[day_key]["revenue"] += order["final_total"]
        day_sales[day_key]["count"] += 1
    
    best_day = None
    best_day_revenue = 0
    if day_sales:
        best_day = max(day_sales.items(), key=lambda x: x[1]["revenue"])
        best_day_revenue = best_day[1]["revenue"]
        best_day = best_day[0]
    
    # ===== COMPARAÇÃO COM MESMO DIA DO MÊS ANTERIOR =====
    # Hoje (início e fim do dia)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    
    # Mesmo dia do mês anterior
    if now.month == 1:
        same_day_last_month_start = today_start.replace(year=now.year - 1, month=12)
    else:
        # Cuidado com dias que não existem no mês anterior (ex: 31 de março vs 31 de fevereiro)
        try:
            same_day_last_month_start = today_start.replace(month=now.month - 1)
        except ValueError:
            # Se o dia não existe no mês anterior, usar o último dia do mês anterior
            if now.month == 1:
                last_month = 12
                year = now.year - 1
            else:
                last_month = now.month - 1
                year = now.year
            # Encontrar último dia do mês anterior
            last_day = calendar.monthrange(year, last_month)[1]
            same_day_last_month_start = today_start.replace(year=year, month=last_month, day=last_day)
    
    same_day_last_month_end = same_day_last_month_start + timedelta(days=1)
    
    # Vendas de hoje
    today_orders = list(orders_collection.find({
        "payment_status": {"$in": ["paid", "approved"]},
        "created_at": {"$gte": today_start, "$lt": today_end}
    }))
    today_revenue = sum(order["final_total"] for order in today_orders)
    today_count = len(today_orders)
    
    # Vendas do mesmo dia do mês anterior
    same_day_orders = list(orders_collection.find({
        "payment_status": {"$in": ["paid", "approved"]},
        "created_at": {"$gte": same_day_last_month_start, "$lt": same_day_last_month_end}
    }))
    same_day_revenue = sum(order["final_total"] for order in same_day_orders)
    same_day_count = len(same_day_orders)
    
    # Calcular variação percentual
    same_day_revenue_change = 0
    if same_day_revenue > 0:
        same_day_revenue_change = ((today_revenue - same_day_revenue) / same_day_revenue) * 100
    elif today_revenue > 0:
        same_day_revenue_change = 100  # Se não havia vendas antes e agora há
    
    same_day_orders_change = 0
    if same_day_count > 0:
        same_day_orders_change = ((today_count - same_day_count) / same_day_count) * 100
    elif today_count > 0:
        same_day_orders_change = 100
    
    return {
        "period": period,
        "current_period": {
            "revenue": round(current_revenue, 2),
            "orders_count": current_count,
            "avg_ticket": round(avg_ticket, 2),
            "daily_avg_revenue": round(daily_avg_revenue, 2),
            "daily_avg_orders": round(daily_avg_orders, 2),
            "days_in_period": days_in_period
        },
        "previous_period": {
            "revenue": round(prev_revenue, 2),
            "orders_count": prev_count
        },
        "changes": {
            "revenue_percent": round(revenue_change, 2),
            "orders_percent": round(orders_change, 2)
        },
        "status_counts": {
            "pending": pending_count,
            "processing": processing_count,
            "delivered": delivered_count,
            "cancelled": cancelled_count
        },
        "best_day": {
            "date": best_day,
            "revenue": round(best_day_revenue, 2) if best_day else 0
        },
        "same_day_comparison": {
            "today": {
                "date": today_start.strftime("%d/%m/%Y"),
                "revenue": round(today_revenue, 2),
                "orders_count": today_count
            },
            "same_day_last_month": {
                "date": same_day_last_month_start.strftime("%d/%m/%Y"),
                "revenue": round(same_day_revenue, 2),
                "orders_count": same_day_count
            },
            "changes": {
                "revenue_percent": round(same_day_revenue_change, 2),
                "orders_percent": round(same_day_orders_change, 2)
            }
        }
    }

@app.get("/api/admin/dashboard/revenue-over-time")
async def get_revenue_over_time(period: str = "month", current_user: Dict = Depends(get_admin_user)):
    """
    Receita ao longo do tempo com base no período
    period: 'week' (últimos 7 dias), 'month' (últimos 6 meses), 'year' (últimos 12 meses)
    """
    now = datetime.utcnow()
    result = []
    
    if period == "week":
        # Últimos 7 dias
        for i in range(7):
            day = now - timedelta(days=i)
            day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + timedelta(days=1)
            
            orders = list(orders_collection.find({
                "payment_status": {"$in": ["paid", "approved"]},
                "created_at": {"$gte": day_start, "$lt": day_end}
            }))
            
            revenue = sum(order["final_total"] for order in orders)
            
            result.insert(0, {
                "date": day_start.strftime("%Y-%m-%d"),
                "label": day_start.strftime("%d/%m"),
                "revenue": round(revenue, 2),
                "orders_count": len(orders)
            })
    
    elif period == "year":
        # Últimos 12 meses
        for i in range(12):
            month = now.month - i
            year = now.year
            
            while month <= 0:
                month += 12
                year -= 1
            
            month_start = datetime(year, month, 1)
            if month == 12:
                month_end = datetime(year + 1, 1, 1)
            else:
                month_end = datetime(year, month + 1, 1)
            
            orders = list(orders_collection.find({
                "payment_status": {"$in": ["paid", "approved"]},
                "created_at": {"$gte": month_start, "$lt": month_end}
            }))
            
            revenue = sum(order["final_total"] for order in orders)
            
            months_pt = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
            
            result.insert(0, {
                "date": f"{year}-{month:02d}",
                "label": f"{months_pt[month-1]}/{str(year)[-2:]}",
                "revenue": round(revenue, 2),
                "orders_count": len(orders)
            })
    
    else:  # month (padrão) - últimos 6 meses
        for i in range(6):
            month = now.month - i
            year = now.year
            
            while month <= 0:
                month += 12
                year -= 1
            
            month_start = datetime(year, month, 1)
            if month == 12:
                month_end = datetime(year + 1, 1, 1)
            else:
                month_end = datetime(year, month + 1, 1)
            
            orders = list(orders_collection.find({
                "payment_status": {"$in": ["paid", "approved"]},
                "created_at": {"$gte": month_start, "$lt": month_end}
            }))
            
            revenue = sum(order["final_total"] for order in orders)
            
            months_pt = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
            
            result.insert(0, {
                "date": f"{year}-{month:02d}",
                "label": f"{months_pt[month-1]}/{str(year)[-2:]}",
                "revenue": round(revenue, 2),
                "orders_count": len(orders)
            })
    
    return result

@app.get("/api/admin/dashboard/top-products")
async def get_top_products(limit: int = 10, current_user: Dict = Depends(get_admin_user)):
    now = datetime.utcnow()
    current_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Get all paid/approved orders from current month
    orders = list(orders_collection.find({
        "payment_status": {"$in": ["paid", "approved"]},
        "created_at": {"$gte": current_month_start}
    }))
    
    # Count products
    product_stats = {}
    for order in orders:
        for item in order["items"]:
            pid = item["product_id"]
            if pid not in product_stats:
                product_stats[pid] = {"quantity": 0, "revenue": 0}
            product_stats[pid]["quantity"] += item["quantity"]
            product_stats[pid]["revenue"] += item["subtotal"]
    
    # Get product details and sort
    result = []
    for pid, stats in product_stats.items():
        product = products_collection.find_one({"_id": ObjectId(pid)})
        if product:
            result.append({
                "product_id": pid,
                "product_name": product["name"],
                "quantity_sold": stats["quantity"],
                "revenue": round(stats["revenue"], 2)
            })
    
    result.sort(key=lambda x: x["revenue"], reverse=True)
    return result[:limit]

@app.get("/api/admin/dashboard/sales-by-category")
async def get_sales_by_category(current_user: Dict = Depends(get_admin_user)):
    now = datetime.utcnow()
    current_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Get all paid/approved orders from current month
    orders = list(orders_collection.find({
        "payment_status": {"$in": ["paid", "approved"]},
        "created_at": {"$gte": current_month_start}
    }))
    
    # Count by category
    category_stats = {}
    for order in orders:
        for item in order["items"]:
            product = products_collection.find_one({"_id": ObjectId(item["product_id"])})
            if product:
                cat_id = product["category_id"]
                if cat_id not in category_stats:
                    category_stats[cat_id] = {"revenue": 0, "orders_count": 0}
                category_stats[cat_id]["revenue"] += item["subtotal"]
                category_stats[cat_id]["orders_count"] += 1
    
    # Get category details
    result = []
    for cat_id, stats in category_stats.items():
        category = categories_collection.find_one({"_id": ObjectId(cat_id)})
        if category:
            result.append({
                "category_id": cat_id,
                "category_name": category["name"],
                "revenue": round(stats["revenue"], 2),
                "orders_count": stats["orders_count"]
            })
    
    result.sort(key=lambda x: x["revenue"], reverse=True)
    return result

# WhatsApp Service Configuration
# WAHA WhatsApp helper function

# Helper function to normalize Brazilian phone numbers
def normalize_phone_number(phone: str) -> str:
    """Normalize Brazilian phone number to include country code 55 and remove 9th digit"""
    # Remove any non-digit characters
    clean_phone = ''.join(filter(str.isdigit, phone))
    
    # If doesn't start with 55, add it (Brazilian country code)
    if not clean_phone.startswith('55'):
        clean_phone = '55' + clean_phone
    
    # Remove 9th digit if present (for WhatsApp API compatibility)
    # If has 13 digits (55 + DDD + 9 + 8 digits), remove the 9 after DDD
    # Example: 5561987654321 → 556187654321
    if len(clean_phone) == 13 and clean_phone[4] == '9':
        clean_phone = clean_phone[:4] + clean_phone[5:]
    
    return clean_phone

# Helper para buscar instância ativa ou criar nova
async def get_or_create_whatsapp_instance():
    """Busca instância conectada ou cria nova com nome incremental"""
    try:
        # Obter token válido
        token = await get_whatsapp_api_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        async with httpx.AsyncClient() as client:
            # Listar todas as instâncias do usuário
            response = await client.get(
                f"{WAHA_API_URL}/api/instances",
                headers=headers,
                timeout=10.0
            )
            
            if response.status_code == 401:
                # Token inválido, forçar renovação
                _whatsapp_token_cache["expires_at"] = None
                token = await get_whatsapp_api_token()
                headers = {"Authorization": f"Bearer {token}"}
                response = await client.get(
                    f"{WAHA_API_URL}/api/instances",
                    headers=headers,
                    timeout=10.0
                )
            
            if response.status_code == 200:
                instances = response.json()
                
                # Filtrar instâncias deste serviço (usando prefixo)
                my_instances = [i for i in instances if i.get("name", "").startswith(WHATSAPP_INSTANCE_PREFIX)]
                
                # Procurar instância conectada
                for inst in my_instances:
                    if inst.get("status") == "connected":
                        phone = inst.get("phone_number", "")
                        return {
                            "instance_name": inst.get("name"),
                            "status": "connected",
                            "phone_number": phone,
                            "instance_id": inst.get("id")
                        }
                
                # Procurar instância esperando QR
                for inst in my_instances:
                    if inst.get("status") == "waiting_qr":
                        return {
                            "instance_name": inst.get("name"),
                            "status": "waiting_qr",
                            "qr_code": inst.get("qr_code"),
                            "instance_id": inst.get("id")
                        }
                
                # Limpar instâncias desconectadas antes de criar nova
                for inst in my_instances:
                    if inst.get("status") == "disconnected":
                        try:
                            await client.delete(
                                f"{WAHA_API_URL}/api/instances/{inst.get('id')}",
                                headers=headers,
                                timeout=5.0
                            )
                            print(f"🧹 Instância desconectada removida: {inst.get('name')}")
                        except:
                            pass
                
                # Encontrar próximo número disponível
                existing_numbers = []
                for inst in my_instances:
                    name = inst.get("name", "")
                    if name.startswith(WHATSAPP_INSTANCE_PREFIX):
                        try:
                            num = int(name.replace(WHATSAPP_INSTANCE_PREFIX, ""))
                            existing_numbers.append(num)
                        except:
                            pass
                
                next_number = 1
                while next_number in existing_numbers:
                    next_number += 1
                
                new_instance_name = f"{WHATSAPP_INSTANCE_PREFIX}{next_number}"
                return {
                    "instance_name": new_instance_name,
                    "status": "new",
                    "needs_creation": True
                }
            
            return {"instance_name": f"{WHATSAPP_INSTANCE_PREFIX}1", "status": "new", "needs_creation": True}
            
    except Exception as e:
        print(f"Erro ao buscar instâncias: {e}")
        return {"instance_name": f"{WHATSAPP_INSTANCE_PREFIX}1", "status": "error", "error": str(e)}

# Helper function to send WhatsApp notifications
async def send_whatsapp_notification(number: str, message: str):
    """Helper function to send WhatsApp notification using new Multi-Instance API"""
    try:
        # Normalize phone number
        normalized_number = normalize_phone_number(number)
        
        # Buscar instância conectada
        instance_info = await get_or_create_whatsapp_instance()
        
        if instance_info.get("status") != "connected":
            print(f"⚠️ WhatsApp não conectado. Status: {instance_info.get('status')}")
            return False
        
        # Verificar se o número conectado é o autorizado
        connected_phone = instance_info.get("phone_number", "")
        if WHATSAPP_ALLOWED_NUMBER and connected_phone:
            clean_connected = connected_phone.replace("+", "").replace(" ", "").replace("-", "")
            clean_allowed = WHATSAPP_ALLOWED_NUMBER.replace("+", "").replace(" ", "").replace("-", "")
            if clean_allowed not in clean_connected and clean_connected not in clean_allowed:
                print(f"🚫 Envio BLOQUEADO: Número conectado ({connected_phone}) não é o autorizado ({WHATSAPP_ALLOWED_NUMBER})")
                return False
        
        instance_name = instance_info.get("instance_name", f"{WHATSAPP_INSTANCE_PREFIX}1")
        
        # Obter token válido
        token = await get_whatsapp_api_token()
        
        # Nova API Multi-Instance endpoint /api/quick/send
        url = f"{WAHA_API_URL}/api/quick/send"
        
        # Payload para nova API
        payload = {
            "to": normalized_number,
            "message": message,
            "instance_name": instance_name
        }
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                json=payload,
                headers=headers,
                timeout=10.0
            )
            
            # Se token expirou, renovar e tentar novamente
            if response.status_code == 401:
                _whatsapp_token_cache["expires_at"] = None
                token = await get_whatsapp_api_token()
                headers["Authorization"] = f"Bearer {token}"
                response = await client.post(
                    url,
                    json=payload,
                    headers=headers,
                    timeout=10.0
                )
            
            if response.status_code == 201 or response.status_code == 200:
                print(f"✅ WhatsApp enviado via {instance_name} para {normalized_number}")
                return True
            else:
                print(f"⚠️ Falha ao enviar WhatsApp para {normalized_number}: {response.status_code} - {response.text}")
                return False
    except Exception as e:
        print(f"❌ Erro ao enviar WhatsApp para {number}: {str(e)}")
        return False

# Helper function to send payment approved notifications
async def send_payment_approved_notifications(order: dict, user: dict):
    """Send WhatsApp notifications to admin and customer when payment is approved"""
    order_id_short = str(order["_id"])[:8]
    
    # Build custom fields info for admin notification
    custom_fields_text = ""
    for item in order.get("items", []):
        product = products_collection.find_one({"_id": ObjectId(item["product_id"])})
        if product and item.get("fields_data"):
            custom_fields_text += f"\n\n📦 *{product['name']}* (x{item['quantity']})\n"
            for field_name, field_value in item["fields_data"].items():
                custom_fields_text += f"  • {field_name}: {field_value}\n"
    
    # Notify admin with custom fields
    admin_message = f"""✅ *PAGAMENTO APROVADO - MARKIMAGEM TV*

📦 Pedido: #{order_id_short}
👤 Cliente: {user['name']}
📞 Telefone: {user.get('phone', 'N/A')}
💰 Valor: R$ {order['final_total']:.2f}

✅ Pagamento confirmado!
📤 Preparar entrega{custom_fields_text}"""
    
    await send_whatsapp_notification(ADMIN_WHATSAPP_NUMBER, admin_message)
    
    # Notify customer
    if user.get('phone'):
        customer_message = f"""✅ *Pagamento Aprovado - MARKIMAGEM TV*

Olá {user['name']}! 

Seu pagamento foi confirmado! 💰

📦 Pedido: #{order_id_short}
💵 Valor: R$ {order['final_total']:.2f}

🚀 Estamos preparando sua entrega.
Em breve você receberá os dados dos produtos.

Obrigado pela preferência! 🙏"""
        
        await send_whatsapp_notification(user['phone'], customer_message)

# WhatsApp Service Proxy Routes

@app.get("/api/whatsapp/status")
async def get_whatsapp_status():
    try:
        instance_info = await get_or_create_whatsapp_instance()
        
        if instance_info.get("status") == "connected":
            phone = instance_info.get("phone_number", "")
            # Formatar número para exibição
            display_phone = phone
            if phone and len(phone) >= 10:
                # Formato: +55 (61) 99517-9918
                clean = phone.replace("+", "").replace(" ", "")
                if len(clean) >= 12:
                    display_phone = f"+{clean[:2]} ({clean[2:4]}) {clean[4:9]}-{clean[9:]}"
            
            # Verificar se é o número autorizado
            is_authorized = True  # Por padrão autorizado
            if WHATSAPP_ALLOWED_NUMBER:
                # Normalizar números para comparação
                clean_phone = phone.replace("+", "").replace(" ", "").replace("-", "")
                clean_allowed = WHATSAPP_ALLOWED_NUMBER.replace("+", "").replace(" ", "").replace("-", "")
                is_authorized = clean_allowed in clean_phone or clean_phone in clean_allowed
                
                # Se NÃO for autorizado, desconectar automaticamente
                if not is_authorized and phone:
                    print(f"⚠️ BLOQUEADO: Número não autorizado tentou conectar: {phone}")
                    print(f"📱 Número autorizado: {WHATSAPP_ALLOWED_NUMBER}")
                    
                    # Desconectar instância não autorizada
                    try:
                        token = await get_whatsapp_api_token()
                        headers = {"Authorization": f"Bearer {token}"}
                        async with httpx.AsyncClient() as client:
                            # Buscar e deletar a instância
                            response = await client.get(
                                f"{WAHA_API_URL}/api/instances",
                                headers=headers,
                                timeout=10.0
                            )
                            if response.status_code == 200:
                                instances = response.json()
                                for inst in instances:
                                    if inst.get("name") == instance_info.get("instance_name"):
                                        await client.delete(
                                            f"{WAHA_API_URL}/api/instances/{inst.get('id')}",
                                            headers=headers,
                                            timeout=5.0
                                        )
                                        print(f"🔒 Instância com número não autorizado REMOVIDA: {phone}")
                                        break
                    except Exception as e:
                        print(f"Erro ao desconectar número não autorizado: {e}")
                    
                    return {
                        "connected": False,
                        "hasQR": False,
                        "status": "UNAUTHORIZED",
                        "message": f"Número {display_phone} não autorizado. Apenas o número {WHATSAPP_ALLOWED_NUMBER} pode conectar.",
                        "blocked_number": phone,
                        "allowed_number": WHATSAPP_ALLOWED_NUMBER,
                        "is_authorized": False
                    }
            
            return {
                "connected": True,
                "hasQR": False,
                "status": "CONNECTED",
                "instance_name": instance_info.get("instance_name"),
                "phone_number": phone,
                "phone_display": display_phone,
                "allowed_number": WHATSAPP_ALLOWED_NUMBER,
                "is_authorized": is_authorized
            }
        elif instance_info.get("status") == "waiting_qr":
            return {
                "connected": False,
                "hasQR": True,
                "status": "WAITING_QR",
                "instance_name": instance_info.get("instance_name"),
                "allowed_number": WHATSAPP_ALLOWED_NUMBER,
                "message": f"Escaneie o QR Code APENAS com o número {WHATSAPP_ALLOWED_NUMBER}"
            }
        else:
            return {
                "connected": False,
                "hasQR": False,
                "status": "DISCONNECTED",
                "instance_name": instance_info.get("instance_name"),
                "allowed_number": WHATSAPP_ALLOWED_NUMBER
            }
    except Exception as e:
        return {"connected": False, "error": str(e), "status": "ERROR"}

@app.get("/api/whatsapp/qr")
async def get_whatsapp_qr():
    try:
        # Obter token válido
        token = await get_whatsapp_api_token()
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        # Primeiro, buscar ou determinar nome da instância
        instance_info = await get_or_create_whatsapp_instance()
        instance_name = instance_info.get("instance_name", "markimagemtv1")
        
        # Se já está conectada, não precisa de QR
        if instance_info.get("status") == "connected":
            return {
                "error": "Já conectado",
                "message": f"WhatsApp já está conectado na instância {instance_name}",
                "connected": True
            }
        
        # Se já tem QR disponível
        if instance_info.get("status") == "waiting_qr" and instance_info.get("qr_code"):
            return {
                "qr": instance_info.get("qr_code"),
                "message": "QR Code disponível",
                "instance_name": instance_name
            }
        
        # Criar/conectar nova instância
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{WAHA_API_URL}/api/quick/connect",
                json={"instance_name": instance_name},
                headers=headers,
                timeout=15.0
            )
            
            # Se token expirou, renovar e tentar novamente
            if response.status_code == 401:
                _whatsapp_token_cache["expires_at"] = None
                token = await get_whatsapp_api_token()
                headers["Authorization"] = f"Bearer {token}"
                response = await client.post(
                    f"{WAHA_API_URL}/api/quick/connect",
                    json={"instance_name": instance_name},
                    headers=headers,
                    timeout=15.0
                )
            
            if response.status_code == 200:
                data = response.json()
                qr_code = data.get("qr_code")
                
                if qr_code:
                    return {
                        "qr": qr_code,
                        "message": f"QR Code disponível para {instance_name}",
                        "instance_name": instance_name
                    }
                else:
                    return {
                        "error": "QR Code não disponível",
                        "message": data.get("message", "Aguardando geração do QR"),
                        "instance_name": instance_name
                    }
            else:
                error_text = response.text
                print(f"Erro ao criar instância: {response.status_code} - {error_text}")
                return {
                    "error": "Erro ao criar instância",
                    "message": f"Código: {response.status_code}",
                    "instance_name": instance_name
                }
                
    except Exception as e:
        print(f"Erro ao obter QR: {e}")
        return {"error": str(e), "message": "Erro ao obter QR Code"}

@app.post("/api/whatsapp/cleanup")
async def whatsapp_cleanup(current_user: Dict = Depends(get_admin_user)):
    """Limpar todas as instâncias desconectadas"""
    try:
        token = await get_whatsapp_api_token()
        headers = {"Authorization": f"Bearer {token}"}
        removed = []
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{WAHA_API_URL}/api/instances",
                headers=headers,
                timeout=10.0
            )
            
            if response.status_code == 401:
                _whatsapp_token_cache["expires_at"] = None
                token = await get_whatsapp_api_token()
                headers = {"Authorization": f"Bearer {token}"}
                response = await client.get(
                    f"{WAHA_API_URL}/api/instances",
                    headers=headers,
                    timeout=10.0
                )
            
            if response.status_code == 200:
                instances = response.json()
                
                for inst in instances:
                    if inst.get("name", "").startswith("markimagemtv") and inst.get("status") == "disconnected":
                        try:
                            await client.delete(
                                f"{WAHA_API_URL}/api/instances/{inst.get('id')}",
                                headers=headers,
                                timeout=5.0
                            )
                            removed.append(inst.get("name"))
                            print(f"🧹 Removida: {inst.get('name')}")
                        except Exception as e:
                            print(f"Erro ao remover {inst.get('name')}: {e}")
        
        return {
            "success": True,
            "message": f"Removidas {len(removed)} instâncias desconectadas",
            "removed": removed
        }
        
    except Exception as e:
        return {"success": False, "error": str(e)}

class WhatsAppMessage(BaseModel):
    number: str
    message: str

@app.post("/api/whatsapp/send")
async def whatsapp_send(msg: WhatsAppMessage, current_user: Dict = Depends(get_admin_user)):
    """Send WhatsApp message using WAHA API (admin only)"""
    try:
        # Normalize phone number
        normalized_number = normalize_phone_number(msg.number)
        
        # WAHA API endpoint
        url = f"{WAHA_API_URL}/api/sendText"
        
        # WAHA API payload
        payload = {
            "session": WAHA_SESSION,
            "chatId": f"{normalized_number}@c.us",
            "text": msg.message
        }
        
        headers = {
            "X-Api-Key": WAHA_API_KEY,
            "Content-Type": "application/json"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                json=payload,
                headers=headers,
                timeout=10.0
            )
            
            if response.status_code in [200, 201]:
                return {"success": True, "message": "Mensagem enviada com sucesso"}
            else:
                return {"success": False, "error": f"Erro WAHA: {response.status_code} - {response.text}"}
    except Exception as e:
        print(f"WhatsApp send error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao enviar mensagem: {str(e)}")

@app.post("/api/whatsapp/start")
async def whatsapp_start(current_user: Dict = Depends(get_admin_user)):
    """Iniciar sessão WAHA (admin only)"""
    try:
        # Nova API Multi-Instance usa /api/quick/connect
        url = f"{WAHA_API_URL}/api/quick/connect"
        headers = {
            "Authorization": f"Bearer {WAHA_API_TOKEN}",
            "Content-Type": "application/json"
        }
        payload = {"instance_name": WAHA_SESSION}
        
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, headers=headers, timeout=30.0)
            print(f"WAHA start session response: {response.status_code} - {response.text}")
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "success": True, 
                    "message": data.get("message", "Sessão iniciada. Aguarde o QR Code."),
                    "qr_code": data.get("qr_code")
                }
            else:
                return {"success": False, "error": f"Erro: {response.status_code} - {response.text}"}
                    
    except Exception as e:
        print(f"WhatsApp start error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao iniciar sessão: {str(e)}")

@app.post("/api/whatsapp/logout")
async def whatsapp_logout(current_user: Dict = Depends(get_admin_user)):
    """Desconectar WhatsApp usando WAHA Multi-Instance API (admin only)"""
    try:
        # Obter token válido
        token = await get_whatsapp_api_token()
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        async with httpx.AsyncClient() as client:
            # Buscar instância conectada
            instance_info = await get_or_create_whatsapp_instance()
            instance_name = instance_info.get("instance_name")
            
            if instance_info.get("status") != "connected":
                return {
                    "success": False, 
                    "message": "Nenhuma instância conectada para desconectar"
                }
            
            # Buscar ID da instância pelo nome
            response = await client.get(
                f"{WAHA_API_URL}/api/instances",
                headers=headers,
                timeout=10.0
            )
            
            if response.status_code == 200:
                instances = response.json()
                instance_to_delete = None
                
                for inst in instances:
                    if inst.get("name") == instance_name:
                        instance_to_delete = inst
                        break
                
                if instance_to_delete:
                    # Deletar a instância (isso desconecta)
                    delete_response = await client.delete(
                        f"{WAHA_API_URL}/api/instances/{instance_to_delete.get('id')}",
                        headers=headers,
                        timeout=10.0
                    )
                    
                    if delete_response.status_code in [200, 204]:
                        return {
                            "success": True, 
                            "message": f"WhatsApp desconectado com sucesso. Número: {instance_info.get('phone_number', 'N/A')}",
                            "disconnected_number": instance_info.get("phone_number")
                        }
                    else:
                        return {
                            "success": False, 
                            "error": f"Erro ao desconectar: {delete_response.status_code}"
                        }
                else:
                    return {
                        "success": False,
                        "error": "Instância não encontrada"
                    }
            
            return {"success": False, "error": "Não foi possível listar instâncias"}
            
    except Exception as e:
        print(f"WhatsApp logout error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao desconectar: {str(e)}")

# ============================================
# HORÁRIO DE ATENDIMENTO
# ============================================

class BusinessHoursConfig(BaseModel):
    day_of_week: int = Field(..., ge=0, le=6, description="0=Domingo, 1=Segunda, ..., 6=Sábado")
    is_open: bool = Field(True, description="Loja aberta neste dia")
    open_time: str = Field(..., pattern="^([01]?[0-9]|2[0-3]):[0-5][0-9]$", description="Horário de abertura (HH:MM)")
    close_time: str = Field(..., pattern="^([01]?[0-9]|2[0-3]):[0-5][0-9]$", description="Horário de fechamento (HH:MM)")

class BusinessHoursSettings(BaseModel):
    enabled: bool = Field(False, description="Sistema de horário ativado")
    closed_message: str = Field("Estamos fechados no momento. Voltaremos em breve!", description="Mensagem quando fechado")
    timezone: str = Field("America/Sao_Paulo", description="Fuso horário")

def get_business_hours_config():
    """Obter configuração de horários de atendimento"""
    config = business_hours_collection.find_one({"type": "config"})
    if not config:
        # Criar configuração padrão
        default_config = {
            "type": "config",
            "enabled": False,
            "closed_message": "🕐 Estamos fechados no momento.\n\nHorário de atendimento:\nTodos os dias: 09:00 - 18:00\n\nVoltaremos em breve!",
            "timezone": "America/Sao_Paulo",
            "created_at": datetime.utcnow()
        }
        business_hours_collection.insert_one(default_config)
        return default_config
    return config

def get_business_hours_schedule():
    """Obter horários por dia da semana"""
    schedule = list(business_hours_collection.find({"type": "schedule"}).sort("day_of_week", 1))
    
    if not schedule:
        # Criar horários padrão (Todos os dias com mesmo horário: 9h-18h)
        days = [
            {"day_of_week": 0, "is_open": True, "open_time": "09:00", "close_time": "18:00"},  # Domingo
            {"day_of_week": 1, "is_open": True, "open_time": "09:00", "close_time": "18:00"},  # Segunda
            {"day_of_week": 2, "is_open": True, "open_time": "09:00", "close_time": "18:00"},  # Terça
            {"day_of_week": 3, "is_open": True, "open_time": "09:00", "close_time": "18:00"},  # Quarta
            {"day_of_week": 4, "is_open": True, "open_time": "09:00", "close_time": "18:00"},  # Quinta
            {"day_of_week": 5, "is_open": True, "open_time": "09:00", "close_time": "18:00"},  # Sexta
            {"day_of_week": 6, "is_open": True, "open_time": "09:00", "close_time": "18:00"},  # Sábado
        ]
        
        for day in days:
            day["type"] = "schedule"
            day["created_at"] = datetime.utcnow()
            business_hours_collection.insert_one(day)
        
        schedule = days
    
    return schedule

def is_business_open():
    """Verificar se a loja está aberta agora"""
    from datetime import datetime
    import pytz
    
    config = get_business_hours_config()
    
    # Se sistema desativado, sempre aberto
    if not config.get("enabled", False):
        return {"is_open": True, "message": None, "next_open": None, "system_enabled": False}
    
    # Obter horário atual no timezone configurado
    tz = pytz.timezone(config.get("timezone", "America/Sao_Paulo"))
    now = datetime.now(tz)
    
    # Converter weekday do Python (0=Segunda) para nossa estrutura (0=Domingo)
    current_day = (now.weekday() + 1) % 7
    current_time = now.strftime("%H:%M")
    
    days_pt = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]
    
    # Buscar configuração do dia atual
    schedule = business_hours_collection.find_one({"type": "schedule", "day_of_week": current_day})
    
    if not schedule or not schedule.get("is_open", False):
        # Fechado hoje, buscar próximo dia aberto
        next_open = find_next_open_day(current_day)
        return {
            "is_open": False,
            "message": config.get("closed_message", "Estamos fechados no momento."),
            "next_open": next_open,
            "current_time": current_time,
            "current_day": current_day,
            "current_day_name": days_pt[current_day],
            "system_enabled": True
        }
    
    # Verificar se está dentro do horário
    open_time = schedule.get("open_time", "09:00")
    close_time = schedule.get("close_time", "18:00")
    
    # Debug: log dos valores com mais detalhes
    print(f"🕐 Verificação de horário:")
    print(f"   Dia: {days_pt[current_day]} (day_of_week={current_day})")
    print(f"   Hora Atual: {current_time}")
    print(f"   Horário Configurado: {open_time} - {close_time}")
    print(f"   Comparação: {current_time} >= {open_time} ? {current_time >= open_time}")
    print(f"   Comparação: {current_time} < {close_time} ? {current_time < close_time}")
    
    # Verificação: hora atual >= abertura E hora atual < fechamento
    is_within_hours = (current_time >= open_time) and (current_time < close_time)
    
    if is_within_hours:
        print(f"✅ Loja ABERTA - Fecha às {close_time}")
        return {
            "is_open": True, 
            "message": None, 
            "closes_at": close_time,
            "current_day_name": days_pt[current_day],
            "current_time": current_time,
            "system_enabled": True
        }
    else:
        # Fora do horário
        if current_time < open_time:
            # Ainda não abriu hoje
            print(f"⏰ Loja ainda não abriu hoje - Abre às {open_time}")
            next_open = {
                "day": current_day,
                "day_name": days_pt[current_day],
                "time": open_time,
                "today": True
            }
        else:
            # Já fechou hoje, buscar próximo dia
            print(f"🔒 Loja fechou hoje às {close_time}")
            next_open = find_next_open_day(current_day)
        
        return {
            "is_open": False,
            "message": config.get("closed_message", "Estamos fechados no momento."),
            "next_open": next_open,
            "current_time": current_time,
            "current_day_name": days_pt[current_day],
            "system_enabled": True
        }

def find_next_open_day(current_day):
    """Encontrar próximo dia/horário de abertura"""
    days_pt = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]
    
    for i in range(1, 8):
        next_day = (current_day + i) % 7
        schedule = business_hours_collection.find_one({"type": "schedule", "day_of_week": next_day})
        
        if schedule and schedule.get("is_open", False):
            return {
                "day": next_day,
                "day_name": days_pt[next_day],
                "time": schedule.get("open_time", "09:00"),
                "today": False
            }
    
    return None

@app.get("/api/business-hours/status")
async def get_business_status():
    """Verificar se a loja está aberta (público)"""
    return is_business_open()

@app.get("/api/admin/business-hours/config")
async def get_business_hours_config_admin(current_user: Dict = Depends(get_admin_user)):
    """Obter configuração de horários (admin)"""
    config = get_business_hours_config()
    schedule = get_business_hours_schedule()
    
    config["_id"] = str(config.get("_id", ""))
    for day in schedule:
        day["_id"] = str(day.get("_id", ""))
    
    return {
        "config": config,
        "schedule": schedule
    }

@app.put("/api/admin/business-hours/config")
async def update_business_hours_config_admin(
    settings: BusinessHoursSettings,
    current_user: Dict = Depends(get_admin_user)
):
    """Atualizar configuração de horários (admin)"""
    print(f"📝 Atualizando configuração: enabled={settings.enabled}, timezone={settings.timezone}")
    
    result = business_hours_collection.update_one(
        {"type": "config"},
        {"$set": {
            "type": "config",
            "enabled": settings.enabled,
            "closed_message": settings.closed_message,
            "timezone": settings.timezone,
            "updated_at": datetime.utcnow()
        }},
        upsert=True
    )
    
    print(f"✅ Configuração atualizada: matched={result.matched_count}, modified={result.modified_count}, upserted={result.upserted_id}")
    
    return {"success": True, "message": "Configuração atualizada"}

@app.put("/api/admin/business-hours/schedule/{day_of_week}")
async def update_business_hours_schedule(
    day_of_week: int,
    hours: BusinessHoursConfig,
    current_user: Dict = Depends(get_admin_user)
):
    """Atualizar horário de um dia específico (admin)"""
    if day_of_week < 0 or day_of_week > 6:
        raise HTTPException(status_code=400, detail="Dia inválido (0-6)")
    
    days_pt = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]
    
    # Normalizar horários para formato HH:MM
    def normalize_time(time_str: str) -> str:
        """Garantir formato HH:MM"""
        parts = time_str.split(":")
        if len(parts) == 2:
            hour = parts[0].zfill(2)  # Adicionar zero à esquerda se necessário
            minute = parts[1].zfill(2)
            return f"{hour}:{minute}"
        return time_str
    
    open_time_normalized = normalize_time(hours.open_time)
    close_time_normalized = normalize_time(hours.close_time)
    
    print(f"📝 Atualizando horário: {days_pt[day_of_week]} - Aberto={hours.is_open}, {open_time_normalized}-{close_time_normalized}")
    
    result = business_hours_collection.update_one(
        {"type": "schedule", "day_of_week": day_of_week},
        {"$set": {
            "type": "schedule",
            "day_of_week": day_of_week,
            "is_open": hours.is_open,
            "open_time": open_time_normalized,
            "close_time": close_time_normalized,
            "updated_at": datetime.utcnow()
        }},
        upsert=True
    )
    
    print(f"✅ Horário {days_pt[day_of_week]} atualizado: matched={result.matched_count}, modified={result.modified_count}, upserted={result.upserted_id}")
    
    return {"success": True, "message": f"Horário do dia {day_of_week} atualizado"}

# ============================================
# WAHA PLUS - Gerenciamento de Múltiplas Sessões
# ============================================

class WhatsAppSessionCreate(BaseModel):
    session_name: str = Field(..., description="Nome único da sessão (ex: vendas, suporte)")
    description: Optional[str] = Field(None, description="Descrição da sessão")
    phone_number: Optional[str] = Field(None, description="Número associado (opcional)")
    is_default: bool = Field(False, description="Sessão padrão para notificações")

class WhatsAppSessionUpdate(BaseModel):
    description: Optional[str] = None
    phone_number: Optional[str] = None
    is_default: Optional[bool] = None

@app.get("/api/admin/whatsapp/sessions")
async def list_whatsapp_sessions(current_user: Dict = Depends(get_admin_user)):
    """Listar todas as sessões WhatsApp cadastradas"""
    try:
        sessions = list(whatsapp_sessions_collection.find({}))
        
        # Buscar status de cada sessão no WAHA
        for session in sessions:
            session["_id"] = str(session["_id"])
            session_name = session["session_name"]
            
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    response = await client.get(
                        f"{WAHA_API_URL}/api/sessions/{session_name}",
                        headers={"X-Api-Key": WAHA_API_KEY}
                    )
                    if response.status_code == 200:
                        waha_data = response.json()
                        session["waha_status"] = waha_data.get("status", "unknown")
                        session["waha_data"] = waha_data
                    else:
                        session["waha_status"] = "not_found"
            except Exception as e:
                session["waha_status"] = "error"
                session["waha_error"] = str(e)
        
        return sessions
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/admin/whatsapp/sessions")
async def create_whatsapp_session(
    session_data: WhatsAppSessionCreate,
    current_user: Dict = Depends(get_admin_user)
):
    """Criar nova sessão WhatsApp"""
    try:
        # Verificar se já existe
        existing = whatsapp_sessions_collection.find_one({"session_name": session_data.session_name})
        if existing:
            raise HTTPException(status_code=400, detail="Sessão com este nome já existe")
        
        # Se é padrão, remover flag de outras sessões
        if session_data.is_default:
            whatsapp_sessions_collection.update_many(
                {},
                {"$set": {"is_default": False}}
            )
        
        # Criar sessão no banco
        session_doc = {
            "session_name": session_data.session_name,
            "description": session_data.description,
            "phone_number": session_data.phone_number,
            "is_default": session_data.is_default,
            "status": "created",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        result = whatsapp_sessions_collection.insert_one(session_doc)
        session_doc["_id"] = str(result.inserted_id)
        
        # Criar sessão no WAHA
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{WAHA_API_URL}/api/sessions",
                    json={
                        "name": session_data.session_name,
                        "config": {
                            "webhooks": []
                        }
                    },
                    headers={"X-Api-Key": WAHA_API_KEY}
                )
                
                if response.status_code in [200, 201]:
                    whatsapp_sessions_collection.update_one(
                        {"_id": result.inserted_id},
                        {"$set": {"status": "ready", "waha_created": True}}
                    )
                    session_doc["status"] = "ready"
                else:
                    session_doc["waha_error"] = response.text
        except Exception as e:
            session_doc["waha_error"] = str(e)
        
        return session_doc
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/admin/whatsapp/sessions/{session_name}/start")
async def start_whatsapp_session(session_name: str, current_user: Dict = Depends(get_admin_user)):
    """Iniciar sessão WhatsApp (gera QR Code)"""
    try:
        session = whatsapp_sessions_collection.find_one({"session_name": session_name})
        if not session:
            raise HTTPException(status_code=404, detail="Sessão não encontrada")
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{WAHA_API_URL}/api/sessions/{session_name}/start",
                headers={"X-Api-Key": WAHA_API_KEY}
            )
            
            if response.status_code in [200, 201]:
                waha_data = response.json()
                
                # Atualizar status no banco
                whatsapp_sessions_collection.update_one(
                    {"session_name": session_name},
                    {"$set": {
                        "status": "starting",
                        "updated_at": datetime.utcnow()
                    }}
                )
                
                return {
                    "success": True,
                    "message": "Sessão iniciada. Use o endpoint /qr para obter o QR Code",
                    "waha_data": waha_data
                }
            else:
                raise HTTPException(status_code=response.status_code, detail=response.text)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/admin/whatsapp/sessions/{session_name}/stop")
async def stop_whatsapp_session(session_name: str, current_user: Dict = Depends(get_admin_user)):
    """Parar sessão WhatsApp"""
    try:
        session = whatsapp_sessions_collection.find_one({"session_name": session_name})
        if not session:
            raise HTTPException(status_code=404, detail="Sessão não encontrada")
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{WAHA_API_URL}/api/sessions/{session_name}/stop",
                headers={"X-Api-Key": WAHA_API_KEY}
            )
            
            if response.status_code in [200, 201]:
                whatsapp_sessions_collection.update_one(
                    {"session_name": session_name},
                    {"$set": {
                        "status": "stopped",
                        "updated_at": datetime.utcnow()
                    }}
                )
                
                return {"success": True, "message": "Sessão parada com sucesso"}
            else:
                raise HTTPException(status_code=response.status_code, detail=response.text)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/whatsapp/sessions/{session_name}/qr")
async def get_session_qr(session_name: str, current_user: Dict = Depends(get_admin_user)):
    """Obter QR Code da sessão"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{WAHA_API_URL}/api/sessions/{session_name}/auth/qr",
                headers={"X-Api-Key": WAHA_API_KEY}
            )
            
            if response.status_code == 200:
                qr_data = response.json()
                return qr_data
            else:
                raise HTTPException(status_code=response.status_code, detail="QR Code não disponível")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/whatsapp/sessions/{session_name}/status")
async def get_session_status(session_name: str, current_user: Dict = Depends(get_admin_user)):
    """Obter status detalhado da sessão no WAHA"""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                f"{WAHA_API_URL}/api/sessions/{session_name}",
                headers={"X-Api-Key": WAHA_API_KEY}
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                raise HTTPException(status_code=response.status_code, detail="Sessão não encontrada no WAHA")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/admin/whatsapp/sessions/{session_name}")
async def delete_whatsapp_session(session_name: str, current_user: Dict = Depends(get_admin_user)):
    """Deletar sessão WhatsApp"""
    try:
        session = whatsapp_sessions_collection.find_one({"session_name": session_name})
        if not session:
            raise HTTPException(status_code=404, detail="Sessão não encontrada")
        
        # Parar e deletar no WAHA
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                await client.delete(
                    f"{WAHA_API_URL}/api/sessions/{session_name}",
                    headers={"X-Api-Key": WAHA_API_KEY}
                )
        except:
            pass  # Continuar mesmo se falhar no WAHA
        
        # Deletar do banco
        whatsapp_sessions_collection.delete_one({"session_name": session_name})
        
        return {"success": True, "message": "Sessão deletada com sucesso"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/admin/whatsapp/sessions/{session_name}")
async def update_whatsapp_session(
    session_name: str,
    update_data: WhatsAppSessionUpdate,
    current_user: Dict = Depends(get_admin_user)
):
    """Atualizar configurações da sessão"""
    try:
        session = whatsapp_sessions_collection.find_one({"session_name": session_name})
        if not session:
            raise HTTPException(status_code=404, detail="Sessão não encontrada")
        
        update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
        update_dict["updated_at"] = datetime.utcnow()
        
        # Se mudou para padrão, remover flag de outras
        if update_data.is_default:
            whatsapp_sessions_collection.update_many(
                {"session_name": {"$ne": session_name}},
                {"$set": {"is_default": False}}
            )
        
        whatsapp_sessions_collection.update_one(
            {"session_name": session_name},
            {"$set": update_dict}
        )
        
        return {"success": True, "message": "Sessão atualizada"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# USER MANAGEMENT ROUTES - Admin Only
# ============================================

# CPF do admin master que pode gerenciar usuários
MASTER_ADMIN_CPF = os.getenv("MASTER_ADMIN_CPF", "99064820104")

class UserSubscriptionUpdate(BaseModel):
    subscription_status: str  # trial, active, expired, suspended
    subscription_expires_at: Optional[datetime] = None
    notes: Optional[str] = None

def get_master_admin_user(authorization: str = Header(None)):
    """Verifica se é o admin master com permissão para gerenciar usuários"""
    user = get_admin_user(authorization)
    # Buscar dados do admin para verificar CPF
    admin = admins_collection.find_one({"_id": ObjectId(user["user_id"])})
    if not admin or admin.get("cpf") != MASTER_ADMIN_CPF:
        raise HTTPException(status_code=403, detail="Acesso restrito ao administrador master")
    return user

@app.get("/api/admin/users")
async def get_all_users(
    status: Optional[str] = None,
    search: Optional[str] = None,
    current_user: Dict = Depends(get_master_admin_user)
):
    """Listar todos os usuários com filtros (apenas admin master)"""
    try:
        query = {}
        
        # Filtrar por status de assinatura
        if status and status != "all":
            query["subscription_status"] = status
        
        # Buscar por nome, email, telefone ou CPF
        if search:
            query["$or"] = [
                {"name": {"$regex": search, "$options": "i"}},
                {"email": {"$regex": search, "$options": "i"}},
                {"phone": {"$regex": search, "$options": "i"}},
                {"cpf": {"$regex": search, "$options": "i"}}
            ]
        
        users = list(users_collection.find(query).sort("created_at", -1))
        
        result = []
        for user in users:
            # Contar pedidos do usuário
            orders_count = orders_collection.count_documents({"user_id": str(user["_id"])})
            paid_orders = orders_collection.count_documents({
                "user_id": str(user["_id"]),
                "payment_status": {"$in": ["paid", "approved"]}
            })
            
            # Calcular total gasto
            user_orders = list(orders_collection.find({
                "user_id": str(user["_id"]),
                "payment_status": {"$in": ["paid", "approved"]}
            }))
            total_spent = sum(order.get("final_total", 0) for order in user_orders)
            
            # Determinar status se não existir
            subscription_status = user.get("subscription_status", "trial")
            subscription_expires = user.get("subscription_expires_at")
            
            # Verificar se expirou
            if subscription_expires and isinstance(subscription_expires, datetime):
                if subscription_expires < datetime.utcnow() and subscription_status != "expired":
                    subscription_status = "expired"
            
            result.append({
                "id": str(user["_id"]),
                "name": user.get("name", ""),
                "email": user.get("email", ""),
                "phone": user.get("phone", ""),
                "cpf": user.get("cpf", ""),
                "created_at": user.get("created_at", datetime.utcnow()).isoformat(),
                "subscription_status": subscription_status,
                "subscription_expires_at": subscription_expires.isoformat() if subscription_expires else None,
                "notes": user.get("notes", ""),
                "orders_count": orders_count,
                "paid_orders": paid_orders,
                "total_spent": round(total_spent, 2),
                "last_order": user_orders[-1]["created_at"].isoformat() if user_orders else None
            })
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f"Erro ao listar usuários: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/users/stats")
async def get_users_stats(current_user: Dict = Depends(get_master_admin_user)):
    """Estatísticas de usuários (apenas admin master)"""
    try:
        total_users = users_collection.count_documents({})
        
        # Contar por status
        trial_count = users_collection.count_documents({"subscription_status": "trial"})
        active_count = users_collection.count_documents({"subscription_status": "active"})
        expired_count = users_collection.count_documents({"subscription_status": "expired"})
        suspended_count = users_collection.count_documents({"subscription_status": "suspended"})
        
        # Usuários sem status definido (considerar como trial)
        undefined_count = users_collection.count_documents({
            "subscription_status": {"$exists": False}
        })
        trial_count += undefined_count
        
        # Usuários criados este mês
        now = datetime.utcnow()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        new_this_month = users_collection.count_documents({
            "created_at": {"$gte": month_start}
        })
        
        # Usuários que vão expirar em 7 dias
        week_from_now = now + timedelta(days=7)
        expiring_soon = users_collection.count_documents({
            "subscription_status": "active",
            "subscription_expires_at": {"$lte": week_from_now, "$gt": now}
        })
        
        return {
            "total": total_users,
            "by_status": {
                "trial": trial_count,
                "active": active_count,
                "expired": expired_count,
                "suspended": suspended_count
            },
            "new_this_month": new_this_month,
            "expiring_soon": expiring_soon
        }
    except Exception as e:
        print(f"Erro ao obter estatísticas de usuários: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/users/{user_id}")
async def get_user_details(user_id: str, current_user: Dict = Depends(get_master_admin_user)):
    """Detalhes de um usuário específico (apenas admin master)"""
    try:
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")
        
        # Buscar pedidos do usuário
        orders = list(orders_collection.find({"user_id": user_id}).sort("created_at", -1).limit(10))
        
        orders_data = []
        for order in orders:
            orders_data.append({
                "id": str(order["_id"]),
                "created_at": order.get("created_at", datetime.utcnow()).isoformat(),
                "final_total": order.get("final_total", 0),
                "payment_status": order.get("payment_status", "pending"),
                "delivery_status": order.get("delivery_status", "awaiting_payment")
            })
        
        return {
            "id": str(user["_id"]),
            "name": user.get("name", ""),
            "email": user.get("email", ""),
            "phone": user.get("phone", ""),
            "cpf": user.get("cpf", ""),
            "created_at": user.get("created_at", datetime.utcnow()).isoformat(),
            "subscription_status": user.get("subscription_status", "trial"),
            "subscription_expires_at": user.get("subscription_expires_at").isoformat() if user.get("subscription_expires_at") else None,
            "notes": user.get("notes", ""),
            "recent_orders": orders_data
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/admin/users/{user_id}/subscription")
async def update_user_subscription(
    user_id: str,
    update_data: UserSubscriptionUpdate,
    current_user: Dict = Depends(get_master_admin_user)
):
    """Atualizar status de assinatura do usuário (apenas admin master)"""
    try:
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")
        
        update_dict = {
            "subscription_status": update_data.subscription_status,
            "updated_at": datetime.utcnow()
        }
        
        if update_data.subscription_expires_at:
            update_dict["subscription_expires_at"] = update_data.subscription_expires_at
        
        if update_data.notes is not None:
            update_dict["notes"] = update_data.notes
        
        users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_dict}
        )
        
        # Notificar usuário via WhatsApp sobre mudança de status
        status_messages = {
            "active": f"✅ Sua assinatura foi ativada! Aproveite todos os recursos.",
            "expired": f"⚠️ Sua assinatura expirou. Entre em contato para renovar.",
            "suspended": f"🚫 Sua conta foi suspensa. Entre em contato para mais informações.",
            "trial": f"🎉 Você está no período de teste. Aproveite!"
        }
        
        if user.get("phone") and update_data.subscription_status in status_messages:
            message = f"""📱 *MARKIMAGEM TV - Atualização de Conta*

Olá {user.get('name', 'Cliente')}!

{status_messages[update_data.subscription_status]}

Em caso de dúvidas, entre em contato."""
            
            await send_whatsapp_notification(user["phone"], message)
        
        return {"success": True, "message": "Assinatura atualizada com sucesso"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/check-master")
async def check_master_admin(current_user: Dict = Depends(get_admin_user)):
    """Verificar se o admin atual é o master"""
    try:
        admin = admins_collection.find_one({"_id": ObjectId(current_user["user_id"])})
        is_master = admin and admin.get("cpf") == MASTER_ADMIN_CPF
        return {"is_master": is_master}
    except Exception as e:
        return {"is_master": False}

# ============================================
# SCHEDULED TASKS - Notificações Automáticas
# ============================================

def check_pending_deliveries():
    """
    Verifica pedidos pendentes de entrega e notifica o admin via WhatsApp.
    Roda automaticamente a cada 15 minutos.
    """
    try:
        print("🔍 Verificando pedidos pendentes de entrega...")
        
        # Buscar pedidos com pagamento aprovado mas ainda não entregues
        pending_orders = list(orders_collection.find({
            "payment_status": {"$in": ["paid", "approved"]},
            "delivery_status": {"$ne": "delivered"}
        }).sort("created_at", 1))
        
        # Se não houver pedidos pendentes, não enviar notificação
        if len(pending_orders) == 0:
            print("✅ Nenhum pedido pendente de entrega")
            return
        
        print(f"📦 Encontrados {len(pending_orders)} pedidos pendentes")
        
        # Montar mensagem detalhada para o admin
        message_lines = [
            f"🔔 *ALERTA - PEDIDOS PENDENTES*",
            f"━━━━━━━━━━━━━━━━━━━━",
            f"📦 Total: *{len(pending_orders)}* pedido(s)",
            f"⏰ Horário: {datetime.now().strftime('%d/%m/%Y %H:%M')}",
            f"━━━━━━━━━━━━━━━━━━━━",
            f""
        ]
        
        for order in pending_orders[:5]:  # Limitar a 5 pedidos com detalhes completos
            order_id_short = str(order["_id"])[:8]
            
            # Buscar informações do usuário
            user = users_collection.find_one({"_id": ObjectId(order["user_id"])})
            user_name = user.get("name", "N/A") if user else "N/A"
            user_phone = user.get("phone", "N/A") if user else "N/A"
            
            # Calcular quanto tempo está pendente
            created_at = order.get("created_at", datetime.utcnow())
            time_diff = datetime.utcnow() - created_at
            hours_pending = int(time_diff.total_seconds() / 3600)
            minutes_pending = int((time_diff.total_seconds() % 3600) / 60)
            
            # Formatar tempo pendente
            if hours_pending > 0:
                time_str = f"{hours_pending}h {minutes_pending}min"
            else:
                time_str = f"{minutes_pending}min"
            
            # Listar produtos do pedido
            items_list = []
            for item in order.get("items", [])[:3]:  # Máximo 3 itens
                product_name = item.get("name", "Produto")[:20]
                qty = item.get("quantity", 1)
                items_list.append(f"  - {product_name} (x{qty})")
            
            if len(order.get("items", [])) > 3:
                items_list.append(f"  ... +{len(order.get('items', [])) - 3} itens")
            
            message_lines.extend([
                f"📋 *PEDIDO #{order_id_short}*",
                f"👤 Cliente: {user_name}",
                f"📞 Telefone: {user_phone}",
                f"💰 Valor: R$ {order.get('final_total', 0):.2f}",
                f"⏱️ Aguardando: {time_str}",
                f"📝 Produtos:",
            ])
            message_lines.extend(items_list)
            message_lines.append("")  # Linha em branco entre pedidos
        
        if len(pending_orders) > 5:
            message_lines.extend([
                f"━━━━━━━━━━━━━━━━━━━━",
                f"📌 +{len(pending_orders) - 5} pedido(s) adicional(is)",
                f""
            ])
        
        message_lines.extend([
            "━━━━━━━━━━━━━━━━━━━━",
            "📱 Acesse o painel admin para",
            "processar as entregas.",
            "",
            "🔄 Próxima verificação em 15 min"
        ])
        
        admin_message = "\n".join(message_lines)
        
        # Enviar notificação usando a nova API Multi-Instance
        import httpx
        
        # Função síncrona para obter token válido
        def get_sync_token():
            global _whatsapp_token_cache
            
            # Se já temos um token e não expirou, usar ele
            if _whatsapp_token_cache["token"] and _whatsapp_token_cache["expires_at"]:
                if datetime.utcnow() < _whatsapp_token_cache["expires_at"]:
                    return _whatsapp_token_cache["token"]
            
            # Token expirado ou não existe, fazer login
            try:
                with httpx.Client() as login_client:
                    response = login_client.post(
                        f"{WAHA_API_URL}/api/auth/login",
                        json={
                            "email": WAHA_API_EMAIL,
                            "password": WAHA_API_PASSWORD
                        },
                        timeout=10.0
                    )
                    
                    if response.status_code == 200:
                        data = response.json()
                        new_token = data.get("access_token")
                        if new_token:
                            _whatsapp_token_cache["token"] = new_token
                            _whatsapp_token_cache["expires_at"] = datetime.utcnow() + timedelta(hours=23)
                            print(f"✅ Token WhatsApp API renovado (scheduler)")
                            return new_token
                    
                    print(f"⚠️ Falha ao renovar token WhatsApp (scheduler): {response.status_code}")
                    return _whatsapp_token_cache["token"] or WAHA_API_TOKEN
                    
            except Exception as e:
                print(f"❌ Erro ao renovar token WhatsApp (scheduler): {e}")
                return _whatsapp_token_cache["token"] or WAHA_API_TOKEN
        
        # Obter token válido
        token = get_sync_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        with httpx.Client() as client:
            # Listar instâncias
            instances_response = client.get(
                f"{WAHA_API_URL}/api/instances",
                headers=headers,
                timeout=10.0
            )
            
            # Se token expirou, renovar e tentar novamente
            if instances_response.status_code == 401:
                _whatsapp_token_cache["expires_at"] = None
                token = get_sync_token()
                headers = {"Authorization": f"Bearer {token}"}
                instances_response = client.get(
                    f"{WAHA_API_URL}/api/instances",
                    headers=headers,
                    timeout=10.0
                )
            
            if instances_response.status_code != 200:
                print(f"⚠️ Erro ao listar instâncias: {instances_response.status_code}")
                return
            
            instances = instances_response.json()
            
            # Procurar instância conectada
            connected_instance = None
            for inst in instances:
                if inst.get("name", "").startswith("markimagemtv") and inst.get("status") == "connected":
                    connected_instance = inst.get("name")
                    break
            
            if not connected_instance:
                print("⚠️ Nenhuma instância WhatsApp conectada para enviar notificação")
                return
            
            # Enviar mensagem
            normalized_number = normalize_phone_number("556195021362")
            send_url = f"{WAHA_API_URL}/api/quick/send"
            send_payload = {
                "to": normalized_number,
                "message": admin_message,
                "instance_name": connected_instance
            }
            send_headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
            
            response = client.post(send_url, json=send_payload, headers=send_headers, timeout=10.0)
            if response.status_code in [200, 201]:
                print(f"✅ Notificação detalhada enviada ao admin sobre {len(pending_orders)} pedidos pendentes")
            else:
                print(f"⚠️ Falha ao enviar notificação: {response.status_code} - {response.text}")
    
    except Exception as e:
        print(f"❌ Erro ao verificar pedidos pendentes: {str(e)}")

# Configurar o scheduler - Verificação a cada 15 minutos
scheduler = BackgroundScheduler()
scheduler.add_job(
    func=check_pending_deliveries,
    trigger="interval",
    minutes=15,
    id="check_pending_deliveries",
    name="Verificar pedidos pendentes de entrega",
    replace_existing=True
)

# Iniciar o scheduler
scheduler.start()
print("⏰ Scheduler iniciado - Verificações automáticas a cada 15 minutos")

# Registrar shutdown do scheduler
atexit.register(lambda: scheduler.shutdown())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)