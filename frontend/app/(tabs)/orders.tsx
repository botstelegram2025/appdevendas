import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import { BACKEND_URL } from '../../config';

interface Order {
  id: string;
  items: any[];
  final_total: number;
  payment_status: string;
  delivery_status: string;
  created_at: string;
  payment_id?: string;
}

export default function Orders() {
  const { token } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      loadOrders();
    }
  }, [token]);

  const loadOrders = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/orders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setOrders(response.data);
    } catch (error) {
      console.error('Erro ao carregar pedidos:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadOrders();
  };

  const updatePaymentStatus = async (orderId: string, paymentId?: string) => {
    if (!paymentId) {
      Alert.alert('Erro', 'Este pedido não tem pagamento associado');
      return;
    }

    setUpdatingOrder(orderId);
    try {
      const response = await axios.get(
        `${BACKEND_URL}/api/payments/${paymentId}/status`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.data.status === 'approved') {
        Alert.alert('Sucesso', 'Pagamento confirmado! 🎉');
      } else {
        Alert.alert(
          'Status do Pagamento',
          `Status atual: ${getPaymentStatusText(response.data.status)}`
        );
      }

      // Recarregar pedidos
      await loadOrders();
    } catch (error: any) {
      console.error('Erro ao atualizar status:', error);
      Alert.alert('Erro', 'Não foi possível atualizar o status do pagamento');
    } finally {
      setUpdatingOrder(null);
    }
  };

  const getPaymentStatusText = (status: string) => {
    const statusMap: { [key: string]: string } = {
      'pending': 'Aguardando Pagamento',
      'paid': 'Pago',
      'approved': 'Aprovado',
      'cancelled': 'Cancelado',
      'rejected': 'Rejeitado'
    };
    return statusMap[status] || status;
  };

  const getDeliveryStatusText = (status: string) => {
    const statusMap: { [key: string]: string } = {
      'awaiting_payment': 'Aguardando Pagamento',
      'processing': 'Em Processamento',
      'delivered': 'Entregue',
      'cancelled': 'Cancelado'
    };
    return statusMap[status] || status;
  };

  const getPaymentStatusColor = (status: string) => {
    const colorMap: { [key: string]: string } = {
      'pending': '#FF9500',
      'paid': '#34C759',
      'approved': '#34C759',
      'cancelled': '#FF3B30',
      'rejected': '#FF3B30'
    };
    return colorMap[status] || '#999';
  };

  const getDeliveryStatusColor = (status: string) => {
    const colorMap: { [key: string]: string } = {
      'awaiting_payment': '#FF9500',
      'processing': '#007AFF',
      'delivered': '#34C759',
      'cancelled': '#FF3B30'
    };
    return colorMap[status] || '#999';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Meus Pedidos</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Meus Pedidos</Text>
      </View>
      
      {orders.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <Ionicons name="receipt-outline" size={80} color="#CCC" />
          <Text style={styles.emptyText}>Nenhum pedido ainda</Text>
          <Text style={styles.emptySubtext}>Seus pedidos aparecerão aqui</Text>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {orders.map((order) => (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <Text style={styles.orderId}>Pedido #{order.id.substring(0, 8)}</Text>
                <Text style={styles.orderDate}>
                  {new Date(order.created_at).toLocaleDateString('pt-BR')}
                </Text>
              </View>

              <View style={styles.orderDetails}>
                <Text style={styles.orderLabel}>Itens: {order.items.length} produto(s)</Text>
                <Text style={styles.orderTotal}>R$ {order.final_total.toFixed(2)}</Text>
              </View>

              <View style={styles.statusContainer}>
                <View style={styles.statusRow}>
                  <Ionicons name="card-outline" size={16} color="#666" />
                  <Text style={styles.statusLabel}>Pagamento:</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getPaymentStatusColor(order.payment_status) + '20' }]}>
                    <Text style={[styles.statusText, { color: getPaymentStatusColor(order.payment_status) }]}>
                      {getPaymentStatusText(order.payment_status)}
                    </Text>
                  </View>
                </View>

                <View style={styles.statusRow}>
                  <Ionicons name="cube-outline" size={16} color="#666" />
                  <Text style={styles.statusLabel}>Entrega:</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getDeliveryStatusColor(order.delivery_status) + '20' }]}>
                    <Text style={[styles.statusText, { color: getDeliveryStatusColor(order.delivery_status) }]}>
                      {getDeliveryStatusText(order.delivery_status)}
                    </Text>
                  </View>
                </View>
              </View>

              {order.payment_status === 'pending' && order.payment_id && (
                <TouchableOpacity
                  style={styles.updateButton}
                  onPress={() => updatePaymentStatus(order.id, order.payment_id)}
                  disabled={updatingOrder === order.id}
                >
                  {updatingOrder === order.id ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="refresh" size={16} color="#fff" />
                      <Text style={styles.updateButtonText}>Atualizar Status do Pagamento</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5'
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0'
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    fontWeight: '600'
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8
  },
  scrollView: {
    flex: 1
  },
  orderCard: {
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 0,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0'
  },
  orderId: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000'
  },
  orderDate: {
    fontSize: 13,
    color: '#666'
  },
  orderDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  orderLabel: {
    fontSize: 14,
    color: '#666'
  },
  orderTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF'
  },
  statusContainer: {
    marginTop: 8
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    marginRight: 8,
    width: 80
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    flex: 1
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center'
  },
  updateButton: {
    marginTop: 12,
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8
  },
  updateButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600'
  }
});