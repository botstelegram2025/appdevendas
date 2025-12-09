import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Modal } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { BACKEND_URL } from '../config';
import { useCartStore } from '../stores/cartStore';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  type: string;
  required_fields: string[];
  discount_rules: Array<{ min_quantity: number; discount_percent: number }>;
}

export default function ProductDetail() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { addItem } = useCartStore();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [fieldsData, setFieldsData] = useState<{ [key: string]: string }>({});
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  useEffect(() => {
    if (params.productId) {
      loadProduct(params.productId as string);
    }
  }, [params.productId]);

  const loadProduct = async (productId: string) => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/products/${productId}`);
      setProduct(response.data);
      
      // Initialize fields data
      const initialFields: { [key: string]: string } = {};
      response.data.required_fields.forEach((field: string) => {
        initialFields[field] = '';
      });
      setFieldsData(initialFields);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível carregar o produto');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = () => {
    if (!product) return 0;
    const subtotal = product.price * quantity;
    
    // Apply discount if applicable
    if (product.discount_rules && product.discount_rules.length > 0) {
      const applicableRule = product.discount_rules
        .filter(rule => quantity >= rule.min_quantity)
        .sort((a, b) => b.discount_percent - a.discount_percent)[0];
      
      if (applicableRule) {
        const discount = subtotal * (applicableRule.discount_percent / 100);
        return subtotal - discount;
      }
    }
    
    return subtotal;
  };

  const getDiscountInfo = () => {
    if (!product || !product.discount_rules || product.discount_rules.length === 0) return null;
    
    const applicableRule = product.discount_rules
      .filter(rule => quantity >= rule.min_quantity)
      .sort((a, b) => b.discount_percent - a.discount_percent)[0];
    
    if (applicableRule) {
      const subtotal = product.price * quantity;
      const discount = subtotal * (applicableRule.discount_percent / 100);
      return {
        percent: applicableRule.discount_percent,
        value: discount
      };
    }
    
    return null;
  };

  const handleAddToCart = () => {
    if (!product) return;
    
    // Validate required fields
    if (product.type === 'activation') {
      for (const field of product.required_fields) {
        if (!fieldsData[field] || fieldsData[field].trim() === '') {
          Alert.alert('Erro', `O campo "${field}" é obrigatório`);
          return;
        }
      }
    }
    
    // Validate quantity
    if (quantity < 1) {
      Alert.alert('Erro', 'Quantidade deve ser no mínimo 1');
      return;
    }
    
    // Add to cart
    addItem({
      product_id: product.id,
      product_name: product.name,
      product_type: product.type,
      quantity,
      unit_price: product.price,
      fields_data: fieldsData,
      discount_rules: product.discount_rules,
      subtotal: calculateTotal()
    });
    
    // Show success alert with options
    Alert.alert(
      '✅ Produto Adicionado!',
      `${product.name} foi adicionado ao seu carrinho.`,
      [
        { 
          text: 'Continuar Comprando', 
          style: 'cancel',
          onPress: () => router.back() 
        },
        { 
          text: '🛒 Ver Carrinho', 
          onPress: () => router.push('/(tabs)/cart') 
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!product) {
    return null;
  }

  const discountInfo = getDiscountInfo();

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Detalhes do Produto</Text>
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.productHeader}>
            <Text style={styles.productName}>{product.name}</Text>
            <Text style={styles.productDescription}>{product.description}</Text>
            <Text style={styles.productPrice}>R$ {product.price.toFixed(2)}</Text>
          </View>

          {product.type === 'credits' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quantidade</Text>
              <View style={styles.quantityContainer}>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => setQuantity(Math.max(1, quantity - 1))}
                >
                  <Ionicons name="remove" size={24} color="#007AFF" />
                </TouchableOpacity>
                <TextInput
                  style={styles.quantityInput}
                  value={quantity.toString()}
                  onChangeText={(text) => {
                    const num = parseInt(text) || 1;
                    setQuantity(Math.max(1, num));
                  }}
                  keyboardType="numeric"
                />
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => setQuantity(quantity + 1)}
                >
                  <Ionicons name="add" size={24} color="#007AFF" />
                </TouchableOpacity>
              </View>
              
              {product.discount_rules && product.discount_rules.length > 0 && (
                <View style={styles.discountInfo}>
                  <Ionicons name="information-circle" size={20} color="#34C759" />
                  <Text style={styles.discountText}>
                    Descontos disponíveis:
                  </Text>
                </View>
              )}
              {product.discount_rules?.map((rule, index) => (
                <Text key={index} style={styles.discountRule}>
                  • A partir de {rule.min_quantity} créditos: {rule.discount_percent}% OFF
                </Text>
              ))}
            </View>
          )}

          {product.type === 'activation' && product.required_fields.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Informações Necessárias</Text>
              {product.required_fields.map((field) => (
                <View key={field} style={styles.inputContainer}>
                  <Text style={styles.label}>{field} *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={`Digite ${field}`}
                    value={fieldsData[field]}
                    onChangeText={(text) => setFieldsData({ ...fieldsData, [field]: text })}
                    autoCapitalize={field.toLowerCase().includes('email') ? 'none' : 'characters'}
                  />
                </View>
              ))}
            </View>
          )}

          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>
                R$ {(product.price * quantity).toFixed(2)}
              </Text>
            </View>
            
            {discountInfo && (
              <>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, styles.discountLabel]}>
                    Desconto ({discountInfo.percent}%)
                  </Text>
                  <Text style={[styles.summaryValue, styles.discountValue]}>
                    - R$ {discountInfo.value.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.savingsTag}>
                  <Ionicons name="pricetag" size={16} color="#34C759" />
                  <Text style={styles.savingsText}>
                    Você economiza R$ {discountInfo.value.toFixed(2)}!
                  </Text>
                </View>
              </>
            )}
            
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>R$ {calculateTotal().toFixed(2)}</Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleAddToCart}
          >
            <Ionicons name="cart" size={20} color="#fff" />
            <Text style={styles.addButtonText}>Adicionar ao Carrinho</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5'
  },
  keyboardView: {
    flex: 1
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0'
  },
  backButton: {
    marginRight: 16
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold'
  },
  content: {
    flex: 1
  },
  productHeader: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0'
  },
  productName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8
  },
  productDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20
  },
  productPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF'
  },
  section: {
    backgroundColor: '#fff',
    padding: 20,
    marginTop: 16
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 16
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 16
  },
  quantityButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center'
  },
  quantityInput: {
    width: 80,
    height: 44,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold'
  },
  discountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8
  },
  discountText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#34C759'
  },
  discountRule: {
    fontSize: 13,
    color: '#666',
    marginLeft: 28,
    marginBottom: 4
  },
  inputContainer: {
    marginBottom: 16
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#000'
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16
  },
  summary: {
    backgroundColor: '#fff',
    padding: 20,
    marginTop: 16
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666'
  },
  summaryValue: {
    fontSize: 14,
    color: '#000',
    fontWeight: '600'
  },
  discountLabel: {
    color: '#34C759'
  },
  discountValue: {
    color: '#34C759'
  },
  savingsTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#34C75920',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8
  },
  savingsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#34C759'
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: 12,
    marginBottom: 0
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000'
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF'
  },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0'
  },
  addButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  }
});
