import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { BACKEND_URL } from '../config';
import { useCartStore } from '../stores/cartStore';
import { useAuth } from '../contexts/AuthContext';

export default function Checkout() {
  const router = useRouter();
  const { user } = useAuth();
  const { items, getTotal, getDiscount, getFinalTotal, clearCart } = useCartStore();
  const [email, setEmail] = useState(user?.email || '');
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    if (!email) {
      Alert.alert('Erro', 'Digite seu e-mail para continuar');
      return;
    }

    setLoading(true);
    try {
      // Create order
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

      const orderResponse = await axios.post(`${BACKEND_URL}/api/orders`, orderData);
      const order = orderResponse.data;

      // Create PIX payment
      const paymentResponse = await axios.post(`${BACKEND_URL}/api/payments/create-pix`, {
        order_id: order.id,
        payer_email: email
      });

      // Navigate to payment screen with payment data
      router.push({
        pathname: '/payment-pix',
        params: {
          orderId: order.id,
          paymentId: paymentResponse.data.payment_id,
          qrCode: paymentResponse.data.qr_code,
          qrCodeBase64: paymentResponse.data.qr_code_base64,
          amount: getFinalTotal().toFixed(2)
        }
      });

      // Clear cart after successful order creation
      clearCart();
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
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.title}>Finalizar Compra</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dados para Pagamento</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>E-mail *</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="seu@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Text style={styles.hint}>Usado para confirmação do pagamento</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Resumo do Pedido</Text>
            {items.map((item, index) => (
              <View key={index} style={styles.itemRow}>
                <Text style={styles.itemName}>{item.product_name}</Text>
                <Text style={styles.itemPrice}>R$ {item.subtotal.toFixed(2)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.totalSection}>
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
          </View>

          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={24} color="#007AFF" />
            <Text style={styles.infoText}>
              Após confirmar, você receberá um código PIX para realizar o pagamento.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.confirmButton, loading && styles.buttonDisabled]}
            onPress={handleCheckout}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="card" size={20} color="#fff" />
                <Text style={styles.confirmButtonText}>Gerar Pagamento PIX</Text>
              </>
            )}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0'
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000'
  },
  content: {
    flex: 1
  },
  section: {
    backgroundColor: '#fff',
    padding: 20,
    marginTop: 16
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 16
  },
  inputContainer: {
    marginBottom: 8
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16
  },
  hint: {
    fontSize: 12,
    color: '#666',
    marginTop: 4
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  itemName: {
    fontSize: 14,
    color: '#666',
    flex: 1
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000'
  },
  totalSection: {
    backgroundColor: '#fff',
    padding: 20,
    marginTop: 16
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  totalLabel: {
    fontSize: 14,
    color: '#666'
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000'
  },
  discountLabel: {
    color: '#34C759'
  },
  discountValue: {
    color: '#34C759'
  },
  finalRow: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: 12,
    marginTop: 4
  },
  finalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000'
  },
  finalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF'
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#007AFF20',
    padding: 16,
    borderRadius: 12,
    margin: 16,
    gap: 12
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#007AFF',
    lineHeight: 20
  },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0'
  },
  confirmButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8
  },
  buttonDisabled: {
    opacity: 0.5
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  }
});