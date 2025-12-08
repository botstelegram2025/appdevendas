#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Digital Sales Application
Tests all authentication, CRUD operations, orders, payments, and dashboard endpoints
"""

import requests
import json
import time
from datetime import datetime
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/frontend/.env')

# Get backend URL from frontend environment
BACKEND_URL = os.getenv('EXPO_PUBLIC_BACKEND_URL', 'https://productflow-21.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"

class DigitalSalesAPITester:
    def __init__(self):
        self.session = requests.Session()
        self.user_token = None
        self.admin_token = None
        self.test_user_id = None
        self.test_category_id = None
        self.test_product_id = None
        self.test_order_id = None
        self.results = {
            'passed': 0,
            'failed': 0,
            'errors': []
        }
    
    def log_result(self, test_name, success, message="", response=None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if message:
            print(f"   {message}")
        if response and not success:
            print(f"   Response: {response.status_code} - {response.text[:200]}")
        
        if success:
            self.results['passed'] += 1
        else:
            self.results['failed'] += 1
            self.results['errors'].append(f"{test_name}: {message}")
        print()
    
    def test_health_check(self):
        """Test basic health endpoint"""
        try:
            response = self.session.get(f"{API_BASE}/health", timeout=10)
            success = response.status_code == 200
            data = response.json() if success else None
            message = f"Status: {response.status_code}, Response: {data}" if success else f"Failed with status {response.status_code}"
            self.log_result("Health Check", success, message, response)
            return success
        except Exception as e:
            self.log_result("Health Check", False, f"Exception: {str(e)}")
            return False
    
    def test_user_registration(self):
        """Test user registration"""
        try:
            user_data = {
                "name": "João Silva",
                "phone": "11987654321",
                "cpf": "11122233344",
                "email": "joao.silva@email.com",
                "password": "senha123"
            }
            
            response = self.session.post(f"{API_BASE}/auth/register", json=user_data, timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                self.user_token = data.get('token')
                self.test_user_id = data.get('user', {}).get('id')
                message = f"User registered successfully. Token: {self.user_token[:20]}..."
            else:
                message = f"Registration failed with status {response.status_code}"
            
            self.log_result("User Registration", success, message, response)
            return success
        except Exception as e:
            self.log_result("User Registration", False, f"Exception: {str(e)}")
            return False
    
    def test_user_login(self):
        """Test user login"""
        try:
            login_data = {
                "identifier": "11122233344",  # CPF
                "password": "senha123"
            }
            
            response = self.session.post(f"{API_BASE}/auth/login", json=login_data, timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                token = data.get('token')
                message = f"Login successful. Token: {token[:20]}..."
            else:
                message = f"Login failed with status {response.status_code}"
            
            self.log_result("User Login", success, message, response)
            return success
        except Exception as e:
            self.log_result("User Login", False, f"Exception: {str(e)}")
            return False
    
    def test_get_user_profile(self):
        """Test getting user profile with token"""
        try:
            if not self.user_token:
                self.log_result("Get User Profile", False, "No user token available")
                return False
            
            headers = {"Authorization": f"Bearer {self.user_token}"}
            response = self.session.get(f"{API_BASE}/auth/me", headers=headers, timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                message = f"Profile retrieved: {data.get('name')} - {data.get('phone')}"
            else:
                message = f"Profile retrieval failed with status {response.status_code}"
            
            self.log_result("Get User Profile", success, message, response)
            return success
        except Exception as e:
            self.log_result("Get User Profile", False, f"Exception: {str(e)}")
            return False
    
    def test_admin_login(self):
        """Test admin login with provided credentials"""
        try:
            admin_data = {
                "cpf": "12345678900",
                "password": "123456"
            }
            
            response = self.session.post(f"{API_BASE}/admin/login", json=admin_data, timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                self.admin_token = data.get('token')
                message = f"Admin login successful. Token: {self.admin_token[:20]}..."
            else:
                message = f"Admin login failed with status {response.status_code}"
            
            self.log_result("Admin Login", success, message, response)
            return success
        except Exception as e:
            self.log_result("Admin Login", False, f"Exception: {str(e)}")
            return False
    
    def test_create_admin_if_needed(self):
        """Create admin user if login fails"""
        try:
            # Try to create admin first
            admin_data = {
                "name": "Administrador",
                "cpf": "12345678900", 
                "password": "123456"
            }
            
            response = self.session.post(f"{API_BASE}/admin/create", params=admin_data, timeout=10)
            success = response.status_code == 200
            
            message = "Admin created successfully" if success else f"Admin creation failed or already exists: {response.status_code}"
            self.log_result("Create Admin User", success, message, response)
            return success
        except Exception as e:
            self.log_result("Create Admin User", False, f"Exception: {str(e)}")
            return False
    
    def test_categories_public(self):
        """Test public categories endpoint"""
        try:
            response = self.session.get(f"{API_BASE}/categories", timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                message = f"Retrieved {len(data)} categories"
            else:
                message = f"Categories retrieval failed with status {response.status_code}"
            
            self.log_result("Get Categories (Public)", success, message, response)
            return success
        except Exception as e:
            self.log_result("Get Categories (Public)", False, f"Exception: {str(e)}")
            return False
    
    def test_create_category(self):
        """Test creating category (admin only)"""
        try:
            if not self.admin_token:
                self.log_result("Create Category", False, "No admin token available")
                return False
            
            category_data = {
                "name": "Ativações IPTV",
                "icon": "📺",
                "order": 1,
                "active": True
            }
            
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = self.session.post(f"{API_BASE}/categories", json=category_data, headers=headers, timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                self.test_category_id = data.get('id')
                message = f"Category created successfully. ID: {self.test_category_id}"
            else:
                message = f"Category creation failed with status {response.status_code}"
            
            self.log_result("Create Category", success, message, response)
            return success
        except Exception as e:
            self.log_result("Create Category", False, f"Exception: {str(e)}")
            return False
    
    def test_update_category(self):
        """Test updating category (admin only)"""
        try:
            if not self.admin_token or not self.test_category_id:
                self.log_result("Update Category", False, "No admin token or category ID available")
                return False
            
            update_data = {
                "name": "Ativações IPTV Premium",
                "icon": "📺",
                "order": 1,
                "active": True
            }
            
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = self.session.put(f"{API_BASE}/categories/{self.test_category_id}", json=update_data, headers=headers, timeout=10)
            success = response.status_code == 200
            
            message = "Category updated successfully" if success else f"Category update failed with status {response.status_code}"
            self.log_result("Update Category", success, message, response)
            return success
        except Exception as e:
            self.log_result("Update Category", False, f"Exception: {str(e)}")
            return False
    
    def test_products_public(self):
        """Test public products endpoint"""
        try:
            response = self.session.get(f"{API_BASE}/products", timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                message = f"Retrieved {len(data)} products"
            else:
                message = f"Products retrieval failed with status {response.status_code}"
            
            self.log_result("Get Products (Public)", success, message, response)
            return success
        except Exception as e:
            self.log_result("Get Products (Public)", False, f"Exception: {str(e)}")
            return False
    
    def test_create_product(self):
        """Test creating product (admin only)"""
        try:
            if not self.admin_token or not self.test_category_id:
                self.log_result("Create Product", False, "No admin token or category ID available")
                return False
            
            product_data = {
                "name": "Ativação IPTV Premium 12 meses",
                "description": "Ativação completa com todos os canais premium por 12 meses",
                "price": 89.90,
                "category_id": self.test_category_id,
                "type": "activation",
                "required_fields": ["MAC", "OTP"],
                "discount_rules": [{"min_quantity": 5, "discount_percent": 10}],
                "active": True
            }
            
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = self.session.post(f"{API_BASE}/products", json=product_data, headers=headers, timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                self.test_product_id = data.get('id')
                message = f"Product created successfully. ID: {self.test_product_id}"
            else:
                message = f"Product creation failed with status {response.status_code}"
            
            self.log_result("Create Product", success, message, response)
            return success
        except Exception as e:
            self.log_result("Create Product", False, f"Exception: {str(e)}")
            return False
    
    def test_get_product_details(self):
        """Test getting product details"""
        try:
            if not self.test_product_id:
                self.log_result("Get Product Details", False, "No product ID available")
                return False
            
            response = self.session.get(f"{API_BASE}/products/{self.test_product_id}", timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                message = f"Product details retrieved: {data.get('name')} - R$ {data.get('price')}"
            else:
                message = f"Product details retrieval failed with status {response.status_code}"
            
            self.log_result("Get Product Details", success, message, response)
            return success
        except Exception as e:
            self.log_result("Get Product Details", False, f"Exception: {str(e)}")
            return False
    
    def test_filter_products_by_category(self):
        """Test filtering products by category"""
        try:
            if not self.test_category_id:
                self.log_result("Filter Products by Category", False, "No category ID available")
                return False
            
            response = self.session.get(f"{API_BASE}/products?category_id={self.test_category_id}", timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                message = f"Retrieved {len(data)} products for category"
            else:
                message = f"Product filtering failed with status {response.status_code}"
            
            self.log_result("Filter Products by Category", success, message, response)
            return success
        except Exception as e:
            self.log_result("Filter Products by Category", False, f"Exception: {str(e)}")
            return False
    
    def test_create_order(self):
        """Test creating an order (user)"""
        try:
            if not self.user_token or not self.test_product_id:
                self.log_result("Create Order", False, "No user token or product ID available")
                return False
            
            order_data = {
                "items": [{
                    "product_id": self.test_product_id,
                    "quantity": 2,
                    "unit_price": 89.90,
                    "fields_data": {"MAC": "AA:BB:CC:DD:EE:FF", "OTP": "123456"},
                    "subtotal": 179.80
                }],
                "total": 179.80,
                "discount": 0,
                "final_total": 179.80
            }
            
            headers = {"Authorization": f"Bearer {self.user_token}"}
            response = self.session.post(f"{API_BASE}/orders", json=order_data, headers=headers, timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                self.test_order_id = data.get('id')
                message = f"Order created successfully. ID: {self.test_order_id}, Total: R$ {data.get('final_total')}"
            else:
                message = f"Order creation failed with status {response.status_code}"
            
            self.log_result("Create Order", success, message, response)
            return success
        except Exception as e:
            self.log_result("Create Order", False, f"Exception: {str(e)}")
            return False
    
    def test_get_user_orders(self):
        """Test getting user orders"""
        try:
            if not self.user_token:
                self.log_result("Get User Orders", False, "No user token available")
                return False
            
            headers = {"Authorization": f"Bearer {self.user_token}"}
            response = self.session.get(f"{API_BASE}/orders", headers=headers, timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                message = f"Retrieved {len(data)} orders for user"
            else:
                message = f"User orders retrieval failed with status {response.status_code}"
            
            self.log_result("Get User Orders", success, message, response)
            return success
        except Exception as e:
            self.log_result("Get User Orders", False, f"Exception: {str(e)}")
            return False
    
    def test_get_order_details(self):
        """Test getting order details"""
        try:
            if not self.user_token or not self.test_order_id:
                self.log_result("Get Order Details", False, "No user token or order ID available")
                return False
            
            headers = {"Authorization": f"Bearer {self.user_token}"}
            response = self.session.get(f"{API_BASE}/orders/{self.test_order_id}", headers=headers, timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                message = f"Order details retrieved: Status {data.get('payment_status')}, Total: R$ {data.get('final_total')}"
            else:
                message = f"Order details retrieval failed with status {response.status_code}"
            
            self.log_result("Get Order Details", success, message, response)
            return success
        except Exception as e:
            self.log_result("Get Order Details", False, f"Exception: {str(e)}")
            return False
    
    def test_admin_get_all_orders(self):
        """Test admin getting all orders"""
        try:
            if not self.admin_token:
                self.log_result("Admin Get All Orders", False, "No admin token available")
                return False
            
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = self.session.get(f"{API_BASE}/admin/orders", headers=headers, timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                message = f"Admin retrieved {len(data)} orders"
            else:
                message = f"Admin orders retrieval failed with status {response.status_code}"
            
            self.log_result("Admin Get All Orders", success, message, response)
            return success
        except Exception as e:
            self.log_result("Admin Get All Orders", False, f"Exception: {str(e)}")
            return False
    
    def test_admin_filter_orders_by_status(self):
        """Test admin filtering orders by status"""
        try:
            if not self.admin_token:
                self.log_result("Admin Filter Orders by Status", False, "No admin token available")
                return False
            
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = self.session.get(f"{API_BASE}/admin/orders?status=pending", headers=headers, timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                message = f"Admin retrieved {len(data)} pending orders"
            else:
                message = f"Admin order filtering failed with status {response.status_code}"
            
            self.log_result("Admin Filter Orders by Status", success, message, response)
            return success
        except Exception as e:
            self.log_result("Admin Filter Orders by Status", False, f"Exception: {str(e)}")
            return False
    
    def test_admin_get_order_details(self):
        """Test admin getting order details"""
        try:
            if not self.admin_token or not self.test_order_id:
                self.log_result("Admin Get Order Details", False, "No admin token or order ID available")
                return False
            
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = self.session.get(f"{API_BASE}/admin/orders/{self.test_order_id}", headers=headers, timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                message = f"Admin order details: User {data.get('user_name')}, Total: R$ {data.get('final_total')}"
            else:
                message = f"Admin order details retrieval failed with status {response.status_code}"
            
            self.log_result("Admin Get Order Details", success, message, response)
            return success
        except Exception as e:
            self.log_result("Admin Get Order Details", False, f"Exception: {str(e)}")
            return False
    
    def test_admin_deliver_order(self):
        """Test admin marking order as delivered"""
        try:
            if not self.admin_token or not self.test_order_id:
                self.log_result("Admin Deliver Order", False, "No admin token or order ID available")
                return False
            
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = self.session.put(f"{API_BASE}/admin/orders/{self.test_order_id}/deliver", headers=headers, timeout=10)
            success = response.status_code == 200
            
            message = "Order marked as delivered" if success else f"Order delivery marking failed with status {response.status_code}"
            self.log_result("Admin Deliver Order", success, message, response)
            return success
        except Exception as e:
            self.log_result("Admin Deliver Order", False, f"Exception: {str(e)}")
            return False
    
    def test_dashboard_stats(self):
        """Test admin dashboard stats"""
        try:
            if not self.admin_token:
                self.log_result("Dashboard Stats", False, "No admin token available")
                return False
            
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = self.session.get(f"{API_BASE}/admin/dashboard/stats", headers=headers, timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                current_month = data.get('current_month', {})
                message = f"Dashboard stats: Revenue R$ {current_month.get('revenue', 0)}, Orders: {current_month.get('orders_count', 0)}"
            else:
                message = f"Dashboard stats retrieval failed with status {response.status_code}"
            
            self.log_result("Dashboard Stats", success, message, response)
            return success
        except Exception as e:
            self.log_result("Dashboard Stats", False, f"Exception: {str(e)}")
            return False
    
    def test_monthly_revenue(self):
        """Test monthly revenue endpoint"""
        try:
            if not self.admin_token:
                self.log_result("Monthly Revenue", False, "No admin token available")
                return False
            
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = self.session.get(f"{API_BASE}/admin/dashboard/monthly-revenue?months=6", headers=headers, timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                message = f"Monthly revenue data retrieved for {len(data)} months"
            else:
                message = f"Monthly revenue retrieval failed with status {response.status_code}"
            
            self.log_result("Monthly Revenue", success, message, response)
            return success
        except Exception as e:
            self.log_result("Monthly Revenue", False, f"Exception: {str(e)}")
            return False
    
    def test_top_products(self):
        """Test top products endpoint"""
        try:
            if not self.admin_token:
                self.log_result("Top Products", False, "No admin token available")
                return False
            
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = self.session.get(f"{API_BASE}/admin/dashboard/top-products", headers=headers, timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                message = f"Top products data retrieved: {len(data)} products"
            else:
                message = f"Top products retrieval failed with status {response.status_code}"
            
            self.log_result("Top Products", success, message, response)
            return success
        except Exception as e:
            self.log_result("Top Products", False, f"Exception: {str(e)}")
            return False
    
    def test_sales_by_category(self):
        """Test sales by category endpoint"""
        try:
            if not self.admin_token:
                self.log_result("Sales by Category", False, "No admin token available")
                return False
            
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = self.session.get(f"{API_BASE}/admin/dashboard/sales-by-category", headers=headers, timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                message = f"Sales by category data retrieved: {len(data)} categories"
            else:
                message = f"Sales by category retrieval failed with status {response.status_code}"
            
            self.log_result("Sales by Category", success, message, response)
            return success
        except Exception as e:
            self.log_result("Sales by Category", False, f"Exception: {str(e)}")
            return False
    
    def test_route_protection(self):
        """Test that admin routes are protected from regular users"""
        try:
            if not self.user_token:
                self.log_result("Route Protection Test", False, "No user token available")
                return False
            
            # Try to access admin endpoint with user token
            headers = {"Authorization": f"Bearer {self.user_token}"}
            response = self.session.get(f"{API_BASE}/admin/orders", headers=headers, timeout=10)
            
            # Should fail with 403
            success = response.status_code == 403
            message = "Route protection working correctly" if success else f"Route protection failed - got status {response.status_code}"
            
            self.log_result("Route Protection Test", success, message, response)
            return success
        except Exception as e:
            self.log_result("Route Protection Test", False, f"Exception: {str(e)}")
            return False
    
    def test_payment_creation_mock(self):
        """Test payment creation (will likely fail due to Mercado Pago integration)"""
        try:
            if not self.user_token or not self.test_order_id:
                self.log_result("Payment Creation (Mock)", False, "No user token or order ID available")
                return False
            
            payment_data = {
                "order_id": self.test_order_id,
                "payer_email": "joao.silva@email.com"
            }
            
            headers = {"Authorization": f"Bearer {self.user_token}"}
            response = self.session.post(f"{API_BASE}/payments/create-pix", json=payment_data, headers=headers, timeout=10)
            
            # This will likely fail due to Mercado Pago integration
            success = response.status_code == 200
            if success:
                data = response.json()
                message = f"Payment created successfully. Status: {data.get('status')}"
            else:
                message = f"Payment creation failed (expected due to Mercado Pago integration): {response.status_code}"
            
            self.log_result("Payment Creation (Mock)", success, message, response)
            return success
        except Exception as e:
            self.log_result("Payment Creation (Mock)", False, f"Exception: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("=" * 80)
        print("DIGITAL SALES API COMPREHENSIVE TESTING")
        print("=" * 80)
        print(f"Backend URL: {API_BASE}")
        print(f"Test started at: {datetime.now()}")
        print("=" * 80)
        
        # Basic connectivity
        self.test_health_check()
        
        # Authentication flow
        self.test_user_registration()
        self.test_user_login()
        self.test_get_user_profile()
        
        # Admin setup and authentication
        self.test_create_admin_if_needed()
        self.test_admin_login()
        
        # Categories management
        self.test_categories_public()
        self.test_create_category()
        self.test_update_category()
        
        # Products management
        self.test_products_public()
        self.test_create_product()
        self.test_get_product_details()
        self.test_filter_products_by_category()
        
        # Orders flow
        self.test_create_order()
        self.test_get_user_orders()
        self.test_get_order_details()
        
        # Admin orders management
        self.test_admin_get_all_orders()
        self.test_admin_filter_orders_by_status()
        self.test_admin_get_order_details()
        self.test_admin_deliver_order()
        
        # Dashboard endpoints
        self.test_dashboard_stats()
        self.test_monthly_revenue()
        self.test_top_products()
        self.test_sales_by_category()
        
        # Security tests
        self.test_route_protection()
        
        # Payment integration (expected to fail)
        self.test_payment_creation_mock()
        
        # Final results
        print("=" * 80)
        print("TEST RESULTS SUMMARY")
        print("=" * 80)
        print(f"✅ Passed: {self.results['passed']}")
        print(f"❌ Failed: {self.results['failed']}")
        print(f"Total Tests: {self.results['passed'] + self.results['failed']}")
        
        if self.results['errors']:
            print("\n🔍 FAILED TESTS:")
            for error in self.results['errors']:
                print(f"   • {error}")
        
        print("=" * 80)
        return self.results

if __name__ == "__main__":
    tester = DigitalSalesAPITester()
    results = tester.run_all_tests()