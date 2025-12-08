import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Alert, ActivityIndicator, Clipboard } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { BACKEND_URL } from '../../config';
import { useAuth } from '../../contexts/AuthContext';

interface Order {
  id: string;
  user_name: string;
  user_phone: string;
  user_email?: string;
  items: Array<{
    product_id: string;
    quantity: number;
    unit_price: number;
    fields_data: { [key: string]: string };
    subtotal: number;
  }>;
  total: number;
  final_total: number;
  payment_status: string;
  delivery_status: string;
  created_at: string;
}

export default function OrdersManagement() {
  const router = useRouter();
  const { adminToken } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadOrders();
  }, [filter]);

  const loadOrders = async () => {
    try {
      const url = filter === 'all' 
        ? `${BACKEND_URL}/api/admin/orders`
        : `${BACKEND_URL}/api/admin/orders?status=${filter}`;
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });
      setOrders(response.data);
    } catch (error) {
      console.error('Error loading orders:', error);
      Alert.alert('Erro', 'Não foi possível carregar os pedidos');
    } finally {
      setLoading(false);
    }
  };

  const handleDeliver = async (orderId: string) => {
    Alert.alert(
      'Confirmar Entrega',
      'Deseja marcar este pedido como entregue? O cliente receberá uma notificação WhatsApp.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              await axios.put(
                `${BACKEND_URL}/api/admin/orders/${orderId}/deliver`,
                {},
                {
                  headers: {
                    'Authorization': `Bearer ${adminToken}`
                  }
                }
              );
              Alert.alert('Sucesso', 'Pedido marcado como entregue! Notificação enviada ao cliente.');
              loadOrders();
              setSelectedOrder(null);
            } catch (error: any) {
              console.error('Error delivering order:', error);
              const errorMsg = error.response?.data?.detail || 'Não foi possível atualizar o pedido';
              Alert.alert('Erro', errorMsg);
            }
          }
        }
      ]
    );
  };

  const copyOrderData = (order: Order) => {
    let text = `📋 PEDIDO #${order.id.substring(0, 8)}\n\n`;
    text += `👤 Cliente: ${order.user_name}\n`;
    text += `📞 Telefone: ${order.user_phone}\n\n`;
    
    order.items.forEach((item, index) => {
      text += `🛍️ Item ${index + 1}:\n`;
      Object.entries(item.fields_data).forEach(([key, value]) => {
        text += `${key}: ${value}\n`;
      });
      text += `\n`;
    });

    Clipboard.setString(text);
    Alert.alert('Copiado!', 'Dados do pedido copiados para área de transferência');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return '#34C759';
      case 'pending': return '#FF9500';
      case 'delivered': return '#007AFF';
      default: return '#999';
    }
  };

  const getStatusText = (payment: string, delivery: string) => {
    if (delivery === 'delivered') return 'Entregue';
    if (payment === 'paid') return 'Pago - Processar';
    return 'Aguardando Pagamento';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (selectedOrder) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setSelectedOrder(null)}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.title}>Detalhes do Pedido</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>Informações do Cliente</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Nome:</Text>
              <Text style={styles.detailValue}>{selectedOrder.user_name}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Telefone:</Text>
              <Text style={styles.detailValue}>{selectedOrder.user_phone}</Text>
            </View>
            {selectedOrder.user_email && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>E-mail:</Text>
                <Text style={styles.detailValue}>{selectedOrder.user_email}</Text>
              </View>
            )}
          </View>

          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>Itens do Pedido</Text>
            {selectedOrder.items.map((item, index) => (
              <View key={index} style={styles.itemCard}>
                <Text style={styles.itemTitle}>Item {index + 1}</Text>
                <View style={styles.itemDetails}>
                  <Text style={styles.itemPrice}>
                    R$ {item.unit_price.toFixed(2)} x {item.quantity}
                  </Text>
                  {Object.entries(item.fields_data).map(([key, value]) => (
                    <View key={key} style={styles.fieldRow}>
                      <Text style={styles.fieldKey}>{key}:</Text>
                      <Text style={styles.fieldValue}>{value}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>

          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Total:</Text>
              <Text style={styles.totalValue}>R$ {selectedOrder.final_total.toFixed(2)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Status Pagamento:</Text>
              <Text style={[styles.statusBadge, { color: getStatusColor(selectedOrder.payment_status) }]}>
                {selectedOrder.payment_status.toUpperCase()}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Status Entrega:</Text>
              <Text style={[styles.statusBadge, { color: getStatusColor(selectedOrder.delivery_status) }]}>
                {selectedOrder.delivery_status.toUpperCase()}
              </Text>
            </View>
          </View>

          <TouchableOpacity 
            style={styles.copyButton}
            onPress={() => copyOrderData(selectedOrder)}
          >
            <Ionicons name="copy" size={20} color="#fff" />
            <Text style={styles.copyButtonText}>Copiar Dados do Pedido</Text>
          </TouchableOpacity>

          {selectedOrder.payment_status === 'paid' && selectedOrder.delivery_status !== 'delivered' && (
            <TouchableOpacity 
              style={styles.deliverButton}
              onPress={() => handleDeliver(selectedOrder.id)}
            >
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.deliverButtonText}>Confirmar Entrega</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>Gerenciar Pedidos</Text>
        <TouchableOpacity onPress={loadOrders}>
          <Ionicons name="refresh" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        <View style={styles.filterContainer}>
          {['all', 'pending', 'paid'].map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, filter === f && styles.filterChipActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {f === 'all' ? 'Todos' : f === 'pending' ? 'Pendentes' : 'Pagos'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <ScrollView style={styles.content}>
        {orders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={64} color="#CCC" />
            <Text style={styles.emptyText}>Nenhum pedido encontrado</Text>
          </View>
        ) : (
          orders.map((order) => (
            <TouchableOpacity
              key={order.id}
              style={styles.orderCard}
              onPress={() => setSelectedOrder(order)}
            >
              <View style={styles.orderHeader}>
                <Text style={styles.orderId}>#{order.id.substring(0, 8)}</Text>
                <Text style={[
                  styles.orderStatus,
                  { color: getStatusColor(order.payment_status) }
                ]}>
                  {getStatusText(order.payment_status, order.delivery_status)}
                </Text>
              </View>
              <Text style={styles.orderClient}>{order.user_name}</Text>
              <View style={styles.orderFooter}>
                <Text style={styles.orderTotal}>R$ {order.final_total.toFixed(2)}</Text>
                <Text style={styles.orderDate}>
                  {new Date(order.created_at).toLocaleDateString('pt-BR')}
                </Text>
              </View>
            </TouchableOpacity>
          ))
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  filterScroll: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0'
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F0F0F0'
  },
  filterChipActive: {
    backgroundColor: '#007AFF'
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666'
  },
  filterTextActive: {
    color: '#fff'
  },
  content: {
    flex: 1,
    padding: 16
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  orderId: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666'
  },
  orderStatus: {
    fontSize: 12,
    fontWeight: '600'
  },
  orderClient: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  orderTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF'
  },
  orderDate: {
    fontSize: 12,
    color: '#999'
  },
  detailCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 12
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  detailLabel: {
    fontSize: 14,
    color: '#666'
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000'
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF'
  },
  statusBadge: {
    fontSize: 12,
    fontWeight: 'bold'
  },
  itemCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 8
  },
  itemDetails: {
    gap: 4
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 8
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 8
  },
  fieldKey: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666'
  },
  fieldValue: {
    fontSize: 12,
    color: '#000'
  },
  copyButton: {
    backgroundColor: '#34C759',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12
  },
  copyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  deliverButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8
  },
  deliverButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  }
});
