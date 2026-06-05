import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter, useFocusEffect } from 'expo-router';
import axios from 'axios';
import { BACKEND_URL } from '../../config';

const { width } = Dimensions.get('window');

interface OrderItem {
  product_id: string;
  product_name?: string;
  product_image?: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface Order {
  id: string;
  items: OrderItem[];
  final_total: number;
  payment_status: string;
  delivery_status: string;
  created_at: string;
  payment_id?: string;
}

export default function Orders() {
  const router = useRouter();
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

  useFocusEffect(
    React.useCallback(() => {
      if (token) {
        loadOrders();
      }
    }, [token])
  );

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
        Alert.alert('Sucesso', 'Pagamento confirmado!');
      } else {
        Alert.alert(
          'Status do Pagamento',
          `Status atual: ${getPaymentStatusText(response.data.status)}`
        );
      }

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
      'pending': 'Aguardando',
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
      'processing': 'Processando',
      'delivered': 'Entregue',
      'cancelled': 'Cancelado'
    };
    return statusMap[status] || status;
  };

  const getPaymentStatusColor = (status: string) => {
    const colorMap: { [key: string]: string } = {
      'pending': '#F59E0B',
      'paid': '#10B981',
      'approved': '#10B981',
      'cancelled': '#EF4444',
      'rejected': '#EF4444'
    };
    return colorMap[status] || '#6B7280';
  };

  const getDeliveryStatusColor = (status: string) => {
    const colorMap: { [key: string]: string } = {
      'awaiting_payment': '#F59E0B',
      'processing': '#6366F1',
      'delivered': '#10B981',
      'cancelled': '#EF4444'
    };
    return colorMap[status] || '#6B7280';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={['#1E1E2E', '#2D2D44']} style={styles.header}>
          <Text style={styles.title}>Meus Pedidos</Text>
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Carregando pedidos...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#1E1E2E', '#2D2D44']} style={styles.header}>
        <Text style={styles.title}>Meus Pedidos</Text>
        <Text style={styles.subtitle}>{orders.length} pedido(s)</Text>
      </LinearGradient>
      
      {orders.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />
          }
        >
          <View style={styles.emptyIconContainer}>
            <Ionicons name="receipt-outline" size={80} color="#4B5563" />
          </View>
          <Text style={styles.emptyText}>Nenhum pedido ainda</Text>
          <Text style={styles.emptySubtext}>Seus pedidos aparecerão aqui</Text>
          <TouchableOpacity 
            style={styles.shopButton}
            onPress={() => router.push('/(tabs)/products')}
          >
            <Text style={styles.shopButtonText}>Ver Produtos</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />
          }
          showsVerticalScrollIndicator={false}
        >
          {orders.map((order) => (
            <TouchableOpacity 
              key={order.id} 
              activeOpacity={0.8}
              onPress={() => router.push(`/order-details/${order.id}`)}
            >
              <LinearGradient
                colors={['#2D2D44', '#1E1E2E']}
                style={styles.orderCard}
              >
                <View style={styles.orderHeader}>
                  <View>
                    <Text style={styles.orderId}>Pedido #{order.id.substring(0, 8)}</Text>
                    <Text style={styles.orderDate}>
                      {new Date(order.created_at).toLocaleDateString('pt-BR')}
                    </Text>
                  </View>
                  <Text style={styles.orderTotal}>R$ {order.final_total.toFixed(2)}</Text>
                </View>

                {/* Preview dos produtos com imagens */}
                <View style={styles.productsPreview}>
                  {order.items.slice(0, 2).map((item, index) => (
                    <View key={index} style={styles.productPreviewItem}>
                      {item.product_image ? (
                        <Image
                          source={{ uri: item.product_image }}
                          style={styles.productThumb}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.productThumbPlaceholder}>
                          <Ionicons name="cube" size={20} color="#6366F1" />
                        </View>
                      )}
                      <View style={styles.productPreviewInfo}>
                        <Text style={styles.productPreviewName} numberOfLines={1}>
                          {item.product_name || 'Produto'}
                        </Text>
                        <Text style={styles.productPreviewQty}>x{item.quantity}</Text>
                      </View>
                    </View>
                  ))}
                  {order.items.length > 2 && (
                    <Text style={styles.moreItems}>+{order.items.length - 2} mais</Text>
                  )}
                </View>

                <View style={styles.statusContainer}>
                  <View style={styles.statusRow}>
                    <Ionicons name="card-outline" size={16} color="#9CA3AF" />
                    <Text style={styles.statusLabel}>Pagamento:</Text>
                    <View style={[styles.statusBadge, { backgroundColor: getPaymentStatusColor(order.payment_status) + '20' }]}>
                      <Text style={[styles.statusText, { color: getPaymentStatusColor(order.payment_status) }]}>
                        {getPaymentStatusText(order.payment_status)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.statusRow}>
                    <Ionicons name="cube-outline" size={16} color="#9CA3AF" />
                    <Text style={styles.statusLabel}>Entrega:</Text>
                    <View style={[styles.statusBadge, { backgroundColor: getDeliveryStatusColor(order.delivery_status) + '20' }]}>
                      <Text style={[styles.statusText, { color: getDeliveryStatusColor(order.delivery_status) }]}>
                        {getDeliveryStatusText(order.delivery_status)}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={styles.detailsButton}
                    onPress={() => router.push(`/order-details/${order.id}`)}
                  >
                    <Ionicons name="eye-outline" size={16} color="#6366F1" />
                    <Text style={styles.detailsButtonText}>Ver Detalhes</Text>
                  </TouchableOpacity>

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
                          <Text style={styles.updateButtonText}>Atualizar</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </LinearGradient>
            </TouchableOpacity>
          ))}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827'
  },
  header: {
    padding: 20,
    paddingTop: 10
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff'
  },
  subtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    color: '#9CA3AF',
    marginTop: 12,
    fontSize: 14
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24
  },
  emptyText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '600'
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8
  },
  shopButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 24
  },
  shopButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  scrollView: {
    flex: 1,
    padding: 16
  },
  orderCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)'
  },
  orderId: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff'
  },
  orderDate: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 4
  },
  orderTotal: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#A5B4FC'
  },
  productsPreview: {
    marginBottom: 16,
    gap: 8
  },
  productPreviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  productThumb: {
    width: 40,
    height: 40,
    borderRadius: 8
  },
  productThumbPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  productPreviewInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  productPreviewName: {
    fontSize: 14,
    color: '#E5E7EB',
    flex: 1
  },
  productPreviewQty: {
    fontSize: 13,
    color: '#9CA3AF'
  },
  moreItems: {
    fontSize: 13,
    color: '#6366F1',
    marginTop: 4
  },
  statusContainer: {
    gap: 8,
    marginBottom: 16
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  statusLabel: {
    fontSize: 14,
    color: '#9CA3AF',
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
  buttonRow: {
    flexDirection: 'row',
    gap: 8
  },
  detailsButton: {
    flex: 1,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: '#6366F1'
  },
  detailsButtonText: {
    color: '#6366F1',
    fontSize: 14,
    fontWeight: '600'
  },
  updateButton: {
    flex: 1,
    backgroundColor: '#6366F1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 10,
    gap: 8
  },
  updateButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600'
  }
});
