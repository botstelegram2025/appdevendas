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

# Mercado Pago credentials
MERCADOPAGO_ACCESS_TOKEN = os.getenv("MERCADOPAGO_ACCESS_TOKEN")
MERCADOPAGO_PUBLIC_KEY = os.getenv("MERCADOPAGO_PUBLIC_KEY")
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key-change-this")

# WAHA WhatsApp API credentials
WAHA_API_URL = os.getenv("WAHA_API_URL", "https://wahavendas-production.up.railway.app")
WAHA_API_KEY = os.getenv("WAHA_API_KEY", "waha_vendas2025")
WAHA_SESSION = os.getenv("WAHA_SESSION", "default")
ADMIN_WHATSAPP_NUMBER = os.getenv("ADMIN_WHATSAPP", "556195021362")

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
    return products

@app.get("/api/products/{product_id}")
async def get_product(product_id: str):
    product = products_collection.find_one({"_id": ObjectId(product_id)})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    product["id"] = str(product["_id"])
    del product["_id"]
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
            order["payment_id"] = payment.get("mercadopago_id")
    return orders

@app.get("/api/orders/{order_id}")
async def get_order(order_id: str, current_user: Dict = Depends(get_current_user)):
    order = orders_collection.find_one({"_id": ObjectId(order_id), "user_id": current_user["user_id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order["id"] = str(order["_id"])
    del order["_id"]
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

# Payments Routes
@app.post("/api/payments/create-pix")
async def create_pix_payment(payment_data: PaymentCreate, current_user: Dict = Depends(get_current_user)):
    # Get order
    order = orders_collection.find_one({"_id": ObjectId(payment_data.order_id), "user_id": current_user["user_id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order["payment_status"] != "pending":
        raise HTTPException(status_code=400, detail="Order already paid or cancelled")
    
    # Get user for CPF
    user = users_collection.find_one({"_id": ObjectId(current_user["user_id"])})
    
    # Try to create payment in Mercado Pago
    # Clean CPF (remove formatting if any)
    cpf_clean = ''.join(filter(str.isdigit, user["cpf"]))
    
    mp_data = {
        "transaction_amount": float(order["final_total"]),
        "description": f"Pedido #{payment_data.order_id[:8]}",
        "payment_method_id": "pix",
        "payer": {
            "email": payment_data.payer_email or user.get("email", "cliente@example.com"),
            "identification": {
                "type": "CPF",
                "number": cpf_clean
            }
        }
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.mercadopago.com/v1/payments",
                json=mp_data,
                headers={
                    "Authorization": f"Bearer {MERCADOPAGO_ACCESS_TOKEN}",
                    "Content-Type": "application/json",
                    "X-Idempotency-Key": str(uuid.uuid4())
                },
                timeout=30.0
            )
        
        print(f"Mercado Pago Response Status: {response.status_code}")
        print(f"Mercado Pago Response Body: {response.text}")
        
        if response.status_code in [200, 201]:
            mp_response = response.json()
            
            # Get QR Code from point_of_interaction
            poi = mp_response.get("point_of_interaction", {})
            transaction_data = poi.get("transaction_data", {})
            qr_code = transaction_data.get("qr_code", "")
            qr_code_base64 = transaction_data.get("qr_code_base64", "")
            
            # Check if QR Code was generated
            if not qr_code:
                raise HTTPException(
                    status_code=400, 
                    detail=f"QR Code não gerado. Status: {mp_response.get('status')} - {mp_response.get('status_detail', 'unknown')}"
                )
            
            # Save payment (even if status is rejected, we save the QR code for reference)
            payment_doc = {
                "order_id": payment_data.order_id,
                "mercadopago_id": str(mp_response["id"]),
                "payment_method": "pix",
                "status": mp_response["status"],
                "status_detail": mp_response.get("status_detail", ""),
                "qr_code": qr_code,
                "qr_code_base64": qr_code_base64,
                "created_at": datetime.utcnow()
            }
            payments_collection.insert_one(payment_doc)
            
            return {
                "payment_id": str(mp_response["id"]),
                "status": mp_response["status"],
                "status_detail": mp_response.get("status_detail", ""),
                "qr_code": qr_code,
                "qr_code_base64": qr_code_base64
            }
        else:
            # Log detailed error
            print(f"Mercado Pago API Error: {response.status_code}")
            print(f"Error details: {response.text}")
            
            error_data = response.json() if response.text else {}
            error_code = error_data.get("code", "")
            
            if error_code == "PA_UNAUTHORIZED_RESULT_FROM_POLICIES":
                raise HTTPException(
                    status_code=403, 
                    detail="Credenciais do Mercado Pago sem permissão para PIX. Por favor, ative o PIX na sua conta do Mercado Pago em: https://www.mercadopago.com.br/settings/release-options"
                )
            
            raise HTTPException(status_code=400, detail=f"Mercado Pago error: {response.text}")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Mercado Pago exception: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Payment processing error: {str(e)}")

@app.get("/api/payments/{payment_id}/status")
async def check_payment_status(payment_id: str, current_user: Dict = Depends(get_current_user)):
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://api.mercadopago.com/v1/payments/{payment_id}",
            headers={"Authorization": f"Bearer {MERCADOPAGO_ACCESS_TOKEN}"},
            timeout=30.0
        )
    
    if response.status_code != 200:
        raise HTTPException(status_code=400, detail="Payment not found")
    
    mp_response = response.json()
    status = mp_response["status"]
    
    # Update payment and order status
    payment = payments_collection.find_one({"mercadopago_id": payment_id})
    if payment:
        old_status = payment.get("status", "pending")
        payments_collection.update_one(
            {"mercadopago_id": payment_id},
            {"$set": {"status": status}}
        )
        
        if status == "approved" and old_status != "approved":
            # Update order
            orders_collection.update_one(
                {"_id": ObjectId(payment["order_id"])},
                {"$set": {"payment_status": "paid", "delivery_status": "processing", "updated_at": datetime.utcnow()}}
            )
            
            # Get order and user info for notifications
            order = orders_collection.find_one({"_id": ObjectId(payment["order_id"])})
            user = users_collection.find_one({"_id": ObjectId(order["user_id"])}) if order else None
            
            if order and user:
                # Send notifications using the new helper function
                await send_payment_approved_notifications(order, user)
    
    return {"status": status}

@app.post("/api/payments/{payment_id}/simulate-approval")
async def simulate_payment_approval(payment_id: str, current_user: Dict = Depends(get_current_user)):
    """Endpoint para simular aprovação de pagamento (apenas para testes)"""
    payment = payments_collection.find_one({"mercadopago_id": payment_id})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    # Update payment status
    payments_collection.update_one(
        {"mercadopago_id": payment_id},
        {"$set": {"status": "approved"}}
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
    
    return {
        "period": period,
        "current_period": {
            "revenue": round(current_revenue, 2),
            "orders_count": current_count,
            "avg_ticket": round(avg_ticket, 2)
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

# Helper function to send WhatsApp notifications
async def send_whatsapp_notification(number: str, message: str):
    """Helper function to send WhatsApp notification using WAHA API"""
    try:
        # Normalize phone number
        normalized_number = normalize_phone_number(number)
        
        # WAHA API endpoint
        url = f"{WAHA_API_URL}/api/sendText"
        
        # WAHA API payload
        payload = {
            "session": WAHA_SESSION,
            "chatId": f"{normalized_number}@c.us",
            "text": message
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
            if response.status_code == 201 or response.status_code == 200:
                print(f"✅ WhatsApp enviado via WAHA para {normalized_number}")
                return True
            else:
                print(f"⚠️ Falha ao enviar WhatsApp via WAHA para {normalized_number}: {response.status_code} - {response.text}")
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
        url = f"{WAHA_API_URL}/api/sessions/{WAHA_SESSION}"
        headers = {"X-Api-Key": WAHA_API_KEY}
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers, timeout=5.0)
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "connected": data.get("status") == "WORKING",
                    "hasQR": data.get("status") == "SCAN_QR_CODE",
                    "status": data.get("status", "STOPPED")
                }
            else:
                return {"connected": False, "status": "STOPPED", "hasQR": False}
    except Exception as e:
        return {"connected": False, "error": str(e), "status": "ERROR"}

@app.get("/api/whatsapp/qr")
async def get_whatsapp_qr():
    try:
        url = f"{WAHA_API_URL}/api/{WAHA_SESSION}/auth/qr"
        headers = {"X-Api-Key": WAHA_API_KEY}
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers, timeout=5.0)
            
            if response.status_code == 200:
                content_type = response.headers.get("content-type", "")
                
                if "image" in content_type:
                    import base64
                    img_base64 = base64.b64encode(response.content).decode('utf-8')
                    return {"qr": f"data:image/png;base64,{img_base64}", "message": "QR Code disponível"}
                else:
                    data = response.json()
                    return {"qr": data.get("qr"), "message": "QR Code disponível"}
            else:
                return {"error": "QR Code não disponível", "message": "Sessão não iniciada ou já conectada"}
    except Exception as e:
        return {"error": str(e), "message": "Erro ao obter QR Code"}

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
        url = f"{WAHA_API_URL}/api/sessions/"
        headers = {"X-Api-Key": WAHA_API_KEY, "Content-Type": "application/json"}
        payload = {
            "name": WAHA_SESSION,
            "start": True
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, headers=headers, timeout=30.0)
            
            print(f"WAHA start session response: {response.status_code} - {response.text}")
            
            if response.status_code in [200, 201]:
                return {"success": True, "message": "Sessão iniciada. Aguarde o QR Code."}
            else:
                return {"success": False, "error": f"Erro: {response.status_code} - {response.text}"}
    except Exception as e:
        print(f"WhatsApp start error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao iniciar sessão: {str(e)}")

@app.post("/api/whatsapp/logout")
async def whatsapp_logout(current_user: Dict = Depends(get_admin_user)):
    """Desconectar WhatsApp usando WAHA API (admin only)"""
    try:
        url = f"{WAHA_API_URL}/api/{WAHA_SESSION}/logout"
        headers = {"X-Api-Key": WAHA_API_KEY}
        
        async with httpx.AsyncClient() as client:
            # Logout da sessão
            response = await client.post(url, headers=headers, timeout=10.0)
            
            if response.status_code in [200, 201]:
                return {
                    "success": True, 
                    "message": "WhatsApp desconectado. Recarregue para gerar novo QR Code."
                }
            else:
                return {"success": False, "error": f"Erro ao desconectar: {response.status_code} - {response.text}"}
    except Exception as e:
        print(f"WhatsApp logout error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao desconectar: {str(e)}")

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
# SCHEDULED TASKS - Notificações Automáticas
# ============================================

def check_pending_deliveries():
    """
    Verifica pedidos pendentes de entrega e notifica o admin via WhatsApp.
    Roda automaticamente a cada 30 minutos.
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
        
        # Montar mensagem para o admin
        message_lines = [
            f"🔔 *ALERTA AUTOMÁTICO - Produtos Pendentes*",
            f"",
            f"Você tem *{len(pending_orders)}* pedido(s) aguardando entrega:",
            f""
        ]
        
        for order in pending_orders[:10]:  # Limitar a 10 pedidos na notificação
            order_id_short = str(order["_id"])[:8]
            
            # Buscar informações do usuário
            user = users_collection.find_one({"_id": ObjectId(order["user_id"])})
            user_name = user.get("name", "N/A") if user else "N/A"
            
            # Calcular quanto tempo está pendente
            created_at = order.get("created_at", datetime.utcnow())
            hours_pending = int((datetime.utcnow() - created_at).total_seconds() / 3600)
            
            message_lines.append(
                f"• Pedido #{order_id_short} - {user_name} - R$ {order['final_total']:.2f} ({hours_pending}h)"
            )
        
        if len(pending_orders) > 10:
            message_lines.append(f"... e mais {len(pending_orders) - 10} pedidos")
        
        message_lines.extend([
            "",
            "📱 Acesse o painel admin para processar as entregas."
        ])
        
        admin_message = "\n".join(message_lines)
        
        # Enviar notificação para o admin (usando httpx de forma síncrona)
        import httpx
        
        normalized_number = normalize_phone_number(ADMIN_WHATSAPP_NUMBER)
        url = f"{WAHA_API_URL}/api/sendText"
        payload = {
            "session": WAHA_SESSION,
            "chatId": f"{normalized_number}@c.us",
            "text": admin_message
        }
        headers = {
            "X-Api-Key": WAHA_API_KEY,
            "Content-Type": "application/json"
        }
        
        with httpx.Client() as client:
            response = client.post(url, json=payload, headers=headers, timeout=10.0)
            if response.status_code in [200, 201]:
                print(f"✅ Notificação enviada ao admin sobre {len(pending_orders)} pedidos pendentes")
            else:
                print(f"⚠️ Falha ao enviar notificação: {response.status_code} - {response.text}")
    
    except Exception as e:
        print(f"❌ Erro ao verificar pedidos pendentes: {str(e)}")

# Configurar o scheduler
scheduler = BackgroundScheduler()
scheduler.add_job(
    func=check_pending_deliveries,
    trigger="interval",
    minutes=30,
    id="check_pending_deliveries",
    name="Verificar pedidos pendentes de entrega",
    replace_existing=True
)

# Iniciar o scheduler
scheduler.start()
print("⏰ Scheduler iniciado - Verificações automáticas a cada 30 minutos")

# Registrar shutdown do scheduler
atexit.register(lambda: scheduler.shutdown())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)