import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { BACKEND_URL } from '../../config';

interface OrderItem {
  product_id: string;
  product_name?: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  fields_data: { [key: string]: string };
}

interface Order {
  id: string;
  items: OrderItem[];
  total: number;
  discount: number;
  final_total: number;
  payment_status: string;
  delivery_status: string;
  created_at: string;
  user_name?: string;
  user_phone?: string;
  payment_id?: string;
}

export default function OrderDetails() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { token } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      loadOrder(params.id as string);
    }
  }, [params.id]);

  const loadOrder = async (orderId: string) => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrder(response.data);
    } catch (error: any) {
      Alert.alert('Erro', 'Não foi possível carregar os detalhes do pedido');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
      case 'delivered':
        return '#34C759';
      case 'pending':
        return '#FF9500';
      case 'cancelled':
        return '#FF3B30';
      case 'processing':
        return '#007AFF';
      default:
        return '#666';
    }
  };

  const getStatusText = (paymentStatus: string, deliveryStatus: string) => {
    if (deliveryStatus === 'delivered') return 'Entregue';
    if (deliveryStatus === 'processing') return 'Em Processamento';
    if (paymentStatus === 'pending') return 'Aguardando Pagamento';
    if (paymentStatus === 'paid') return 'Pago';
    return 'Aguardando';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!order) {
    return null;
  }

  const status = getStatusText(order.payment_status, order.delivery_status);
  const statusColor = getStatusColor(order.delivery_status || order.payment_status);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalhes do Pedido</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.card}>
          <View style={styles.orderHeader}>
            <Text style={styles.orderId}>Pedido #{order.id.substring(0, 8)}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>{status}</Text>
            </View>
          </View>
          <Text style={styles.orderDate}>
            {new Date(order.created_at).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Produtos</Text>
          {order.items.map((item, index) => (
            <View key={index} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemName}>{item.product_name || 'Produto'}</Text>
                <Text style={styles.itemPrice}>R$ {item.subtotal.toFixed(2)}</Text>
              </View>
              <Text style={styles.itemQuantity}>Quantidade: {item.quantity}</Text>
              <Text style={styles.itemUnitPrice}>Preço unitário: R$ {item.unit_price.toFixed(2)}</Text>
              
              {Object.keys(item.fields_data).length > 0 && (
                <View style={styles.fieldsContainer}>
                  <Text style={styles.fieldsTitle}>Informações fornecidas:</Text>
                  {Object.entries(item.fields_data).map(([key, value]) => (
                    <View key={key} style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>{key}:</Text>
                      <Text style={styles.fieldValue}>{value}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resumo do Pagamento</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>R$ {order.total.toFixed(2)}</Text>
            </View>
            
            {order.discount > 0 && (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, styles.discountLabel]}>Desconto</Text>
                <Text style={[styles.summaryValue, styles.discountValue]}>- R$ {order.discount.toFixed(2)}</Text>
              </View>
            )}
            
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total Pago</Text>
              <Text style={styles.totalValue}>R$ {order.final_total.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {order.payment_id && (
          <View style={styles.paymentInfo}>
            <Ionicons name="card-outline" size={20} color="#666" />
            <Text style={styles.paymentInfoText}>ID do Pagamento: {order.payment_id}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5'
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
    fontSize: 20,
    fontWeight: 'bold'
  },
  content: {
    flex: 1
  },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 16
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  orderId: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000'
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600'
  },
  orderDate: {
    fontSize: 14,
    color: '#666'
  },
  section: {
    marginBottom: 16
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    paddingHorizontal: 16,
    marginBottom: 12
  },
  itemCard: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 8
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    flex: 1
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF'
  },
  itemQuantity: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4
  },
  itemUnitPrice: {
    fontSize: 14,
    color: '#666'
  },
  fieldsContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8
  },
  fieldsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8
  },
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 4
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginRight: 8
  },
  fieldValue: {
    fontSize: 14,
    color: '#000',
    flex: 1
  },
  summaryCard: {
    backgroundColor: '#fff',
    padding: 16
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
    fontWeight: '500',
    color: '#000'
  },
  discountLabel: {
    color: '#34C759'
  },
  discountValue: {
    color: '#34C759'
  },
  totalRow: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    marginBottom: 0
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000'
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF'
  },
  paymentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    gap: 8
  },
  paymentInfoText: {
    fontSize: 14,
    color: '#666',
    flex: 1
  }
});
