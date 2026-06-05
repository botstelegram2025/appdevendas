import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { BACKEND_URL } from '../config';
import { useCartStore } from '../stores/cartStore';
import { useAuth } from '../contexts/AuthContext';

export default function Checkout() {
  const router = useRouter();
  const { user, token } = useAuth();
  const { items, getTotal, getDiscount, getFinalTotal, clearCart } = useCartStore();
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const orderData = {
        items: items.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          fields_data: item.fields_data,
          subtotal: item.subtotal
        })),
        total: getTotal(),
        discount: getDiscount(),
        final_total: getFinalTotal()
      };

      const orderResponse = await axios.post(`${BACKEND_URL}/api/orders`, orderData, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const order = orderResponse.data;

      const paymentResponse = await axios.post(`${BACKEND_URL}/api/payments/create-pix`, {
        order_id: order.id,
        payer_email: user?.email || 'cliente@markimagemtv.com'
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const paymentData = paymentResponse.data;
      const params = new URLSearchParams();
      params.append('orderId', order.id || '');
      params.append('paymentId', paymentData.payment_id || '');
      params.append('pixPayload', paymentData.pix_payload || '');
      params.append('pixKey', paymentData.pix_key || '');
      params.append('merchantName', paymentData.merchant_name || '');
      params.append('amount', paymentData.amount ? paymentData.amount.toFixed(2) : getFinalTotal().toFixed(2));
      
      // Adicionar info do primeiro produto para exibir na tela de pagamento
      if (items.length > 0) {
        params.append('productName', items[0].product_name || '');
        params.append('productImage', items[0].product_image || '');
        params.append('itemCount', items.length.toString());
      }
      
      const finalPaymentUrl = `/payment-pix?${params.toString()}`;
      clearCart();
      router.push(finalPaymentUrl);
    } catch (error: any) {
      console.error('Checkout error:', error);
      Alert.alert(
        'Erro no Pagamento', 
        error.response?.data?.detail || 'Não foi possível processar o pagamento. Tente novamente.'
      );
    } finally {
      setLoading(false);
    }
  };

  const total = getTotal();
  const discount = getDiscount();
  const finalTotal = getFinalTotal();

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <LinearGradient colors={['#1E1E2E', '#2D2D44']} style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Finalizar Compra</Text>
          <View style={{ width: 40 }} />
        </LinearGradient>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Info Section */}
          <LinearGradient colors={['#2D2D44', '#1E1E2E']} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="cart" size={24} color="#6366F1" />
              <Text style={styles.sectionTitle}>Resumo da Compra</Text>
            </View>
            <Text style={styles.infoText}>
              Confirme os itens e finalize o pagamento via PIX
            </Text>
          </LinearGradient>

          {/* Products Section */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionLabel}>Itens do Pedido</Text>
            {items.map((item, index) => (
              <LinearGradient 
                key={index} 
                colors={['#2D2D44', '#1E1E2E']} 
                style={styles.itemCard}
              >
                <View style={styles.itemRow}>
                  {item.product_image ? (
                    <Image
                      source={{ uri: item.product_image }}
                      style={styles.itemImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.itemImagePlaceholder}>
                      <Ionicons name="cube" size={28} color="#6366F1" />
                    </View>
                  )}
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.product_name}</Text>
                    <Text style={styles.itemQty}>Qtd: {item.quantity}</Text>
                  </View>
                  <Text style={styles.itemPrice}>R$ {item.subtotal.toFixed(2)}</Text>
                </View>
              </LinearGradient>
            ))}
          </View>

          {/* Total Section */}
          <LinearGradient colors={['#2D2D44', '#1E1E2E']} style={styles.totalSection}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>R$ {total.toFixed(2)}</Text>
            </View>
            {discount > 0 && (
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, styles.discountLabel]}>Desconto</Text>
                <Text style={[styles.totalValue, styles.discountValue]}>- R$ {discount.toFixed(2)}</Text>
              </View>
            )}
            <View style={[styles.totalRow, styles.finalRow]}>
              <Text style={styles.finalLabel}>Total a Pagar</Text>
              <Text style={styles.finalValue}>R$ {finalTotal.toFixed(2)}</Text>
            </View>
          </LinearGradient>

          {/* Info Box */}
          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={24} color="#6366F1" />
            <Text style={styles.infoBoxText}>
              Após confirmar, você receberá um código PIX para realizar o pagamento.
            </Text>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.confirmButton, loading && styles.buttonDisabled]}
            onPress={handleCheckout}
            disabled={loading}
          >
            <LinearGradient
              colors={loading ? ['#4B5563', '#374151'] : ['#6366F1', '#8B5CF6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.confirmButtonGradient}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="card" size={20} color="#fff" />
                  <Text style={styles.confirmButtonText}>Gerar Pagamento PIX</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827'
  },
  keyboardView: {
    flex: 1
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 10
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff'
  },
  content: {
    flex: 1,
    padding: 16
  },
  section: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff'
  },
  infoText: {
    fontSize: 14,
    color: '#9CA3AF',
    lineHeight: 20
  },
  sectionContainer: {
    marginBottom: 16
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12
  },
  itemCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  itemImage: {
    width: 50,
    height: 50,
    borderRadius: 10
  },
  itemImagePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 10,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#E5E7EB'
  },
  itemQty: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 2
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#A5B4FC'
  },
  totalSection: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  totalLabel: {
    fontSize: 14,
    color: '#9CA3AF'
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E5E7EB'
  },
  discountLabel: {
    color: '#10B981'
  },
  discountValue: {
    color: '#10B981'
  },
  finalRow: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 12,
    marginTop: 4,
    marginBottom: 0
  },
  finalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff'
  },
  finalValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#A5B4FC'
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    padding: 16,
    borderRadius: 12,
    gap: 12
  },
  infoBoxText: {
    flex: 1,
    fontSize: 14,
    color: '#A5B4FC',
    lineHeight: 20
  },
  footer: {
    padding: 16,
    paddingBottom: 24,
    backgroundColor: '#111827'
  },
  confirmButton: {
    borderRadius: 14,
    overflow: 'hidden'
  },
  confirmButtonGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    gap: 10
  },
  buttonDisabled: {
    opacity: 0.7
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600'
  }
});
