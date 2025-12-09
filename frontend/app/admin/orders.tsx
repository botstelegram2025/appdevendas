import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Alert, ActivityIndicator, RefreshControl, Modal } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { BACKEND_URL } from '../../config';
import { useAuth } from '../../contexts/AuthContext';
import * as Clipboard from 'expo-clipboard';

interface Order {
  id: string;
  user_name: string;
  user_phone: string;
  user_email?: string;
  user_cpf?: string;
  items: Array<{
    product_id: string;
    product_name?: string;
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
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [filter, setFilter] = useState('all');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);

  useEffect(() => {
    loadOrders();
  }, [filter]);

  // Recarregar pedidos quando a tela recebe foco
  useFocusEffect(
    React.useCallback(() => {
      loadOrders();
    }, [filter])
  );

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
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadOrders();
  };

  const copyToClipboard = async (text: string, label: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('Copiado!', `${label} copiado para área de transferência`);
  };

  const copyAllOrderData = async (order: Order) => {
    let text = `PEDIDO #${order.id.substring(0, 8)}\n\n`;
    text += `CLIENTE:\n`;
    text += `Nome: ${order.user_name}\n`;
    text += `Telefone: ${order.user_phone}\n`;
    if (order.user_email) text += `Email: ${order.user_email}\n`;
    if (order.user_cpf) text += `CPF: ${order.user_cpf}\n`;
    text += `\nPRODUTOS:\n`;
    
    order.items.forEach((item, index) => {
      text += `\n${index + 1}. ${item.product_name || 'Produto'} (x${item.quantity})\n`;
      Object.entries(item.fields_data).forEach(([key, value]) => {
        text += `   ${key}: ${value}\n`;
      });
    });
    
    text += `\nVALOR TOTAL: R$ ${order.final_total.toFixed(2)}\n`;
    
    await Clipboard.setStringAsync(text);
    Alert.alert('Copiado!', 'Todos os dados do pedido copiados');
  };

  const updateDeliveryStatus = async (orderId: string, newStatus: string) => {
    setUpdatingStatus(true);
    try {
      if (newStatus === 'delivered') {
        await axios.put(
          `${BACKEND_URL}/api/admin/orders/${orderId}/deliver`,
          {},
          {
            headers: {
              'Authorization': `Bearer ${adminToken}`
            }
          }
        );
        Alert.alert('Sucesso', 'Pedido marcado como entregue! Cliente notificado via WhatsApp.');
      } else {
        // Outros status futuros
        await axios.put(
          `${BACKEND_URL}/api/admin/orders/${orderId}/status`,
          { delivery_status: newStatus },
          {
            headers: {
              'Authorization': `Bearer ${adminToken}`
            }
          }
        );
        Alert.alert('Sucesso', 'Status atualizado!');
      }
      
      loadOrders();
      setSelectedOrder(null);
    } catch (error: any) {
      console.error('Error updating status:', error);
      const errorMsg = error.response?.data?.detail || 'Não foi possível atualizar o status';
      Alert.alert('Erro', errorMsg);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleStatusChange = (order: Order) => {
    const options = [
      { text: 'Cancelar', style: 'cancel' as const },
    ];

    if (order.delivery_status !== 'delivered') {
      options.unshift({
        text: 'Marcar como Entregue',
        onPress: () => updateDeliveryStatus(order.id, 'delivered')
      } as any);
    }

    if (order.delivery_status === 'awaiting_payment' && order.payment_status === 'paid') {
      options.unshift({
        text: 'Iniciar Processamento',
        onPress: () => updateDeliveryStatus(order.id, 'processing')
      } as any);
    }

    Alert.alert('Alterar Status de Entrega', 'Escolha o novo status:', options);
  };

  const handleCancelOrder = (order: Order) => {
    setOrderToCancel(order);
    setShowCancelModal(true);
  };

  const confirmCancelOrder = async () => {
    if (!orderToCancel) return;
    
    setShowCancelModal(false);
    setUpdatingStatus(true);
    
    try {
      await axios.post(
        `${BACKEND_URL}/api/admin/orders/${orderToCancel.id}/cancel`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${adminToken}`
          }
        }
      );
      Alert.alert('Sucesso', 'Pedido cancelado! Cliente notificado via WhatsApp.');
      loadOrders();
      setSelectedOrder(null);
      setOrderToCancel(null);
    } catch (error: any) {
      console.error('Error cancelling order:', error);
      const errorMsg = error.response?.data?.detail || 'Não foi possível cancelar o pedido';
      Alert.alert('Erro', errorMsg);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      'paid': '#34C759',
      'pending': '#FF9500',
      'delivered': '#34C759',
      'processing': '#007AFF',
      'awaiting_payment': '#FF9500',
      'cancelled': '#FF3B30'
    };
    return colors[status] || '#999';
  };

  const getStatusText = (status: string) => {
    const texts: { [key: string]: string } = {
      'paid': 'Pago',
      'pending': 'Pendente',
      'delivered': 'Entregue',
      'processing': 'Processando',
      'awaiting_payment': 'Aguardando Pgto',
      'cancelled': 'Cancelado'
    };
    return texts[status] || status;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.title}>Gerenciar Pedidos</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
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
          <TouchableOpacity onPress={() => copyAllOrderData(selectedOrder)}>
            <Ionicons name="copy-outline" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {/* Cliente Info */}
          <View style={styles.detailCard}>
            <Text style={styles.sectionTitle}>📋 Informações do Cliente</Text>
            
            <TouchableOpacity 
              style={styles.copyableRow}
              onPress={() => copyToClipboard(selectedOrder.user_name, 'Nome')}
            >
              <View style={styles.rowContent}>
                <Text style={styles.detailLabel}>Nome:</Text>
                <Text style={styles.detailValue}>{selectedOrder.user_name}</Text>
              </View>
              <Ionicons name="copy-outline" size={18} color="#007AFF" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.copyableRow}
              onPress={() => copyToClipboard(selectedOrder.user_phone, 'Telefone')}
            >
              <View style={styles.rowContent}>
                <Text style={styles.detailLabel}>Telefone:</Text>
                <Text style={styles.detailValue}>{selectedOrder.user_phone}</Text>
              </View>
              <Ionicons name="copy-outline" size={18} color="#007AFF" />
            </TouchableOpacity>

            {selectedOrder.user_email && (
              <TouchableOpacity 
                style={styles.copyableRow}
                onPress={() => copyToClipboard(selectedOrder.user_email!, 'Email')}
              >
                <View style={styles.rowContent}>
                  <Text style={styles.detailLabel}>Email:</Text>
                  <Text style={styles.detailValue}>{selectedOrder.user_email}</Text>
                </View>
                <Ionicons name="copy-outline" size={18} color="#007AFF" />
              </TouchableOpacity>
            )}

            {selectedOrder.user_cpf && (
              <TouchableOpacity 
                style={styles.copyableRow}
                onPress={() => copyToClipboard(selectedOrder.user_cpf!, 'CPF')}
              >
                <View style={styles.rowContent}>
                  <Text style={styles.detailLabel}>CPF:</Text>
                  <Text style={styles.detailValue}>{selectedOrder.user_cpf}</Text>
                </View>
                <Ionicons name="copy-outline" size={18} color="#007AFF" />
              </TouchableOpacity>
            )}
          </View>

          {/* Produtos e Dados */}
          <View style={styles.detailCard}>
            <Text style={styles.sectionTitle}>📦 Produtos e Dados de Acesso</Text>
            {selectedOrder.items.map((item, index) => (
              <View key={index} style={styles.productCard}>
                <View style={styles.productHeader}>
                  <Text style={styles.productTitle}>
                    {item.product_name || `Produto ${index + 1}`}
                  </Text>
                  <Text style={styles.productPrice}>
                    {item.quantity}x R$ {item.unit_price.toFixed(2)}
                  </Text>
                </View>

                {Object.keys(item.fields_data).length > 0 && (
                  <View style={styles.fieldsContainer}>
                    <Text style={styles.fieldsTitle}>Dados de Acesso:</Text>
                    {Object.entries(item.fields_data).map(([key, value]) => (
                      <TouchableOpacity 
                        key={key}
                        style={styles.fieldRow}
                        onPress={() => copyToClipboard(value, key)}
                      >
                        <View style={styles.fieldContent}>
                          <Text style={styles.fieldKey}>{key}:</Text>
                          <Text style={styles.fieldValue}>{value}</Text>
                        </View>
                        <Ionicons name="copy-outline" size={16} color="#007AFF" />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>

          {/* Status e Ações */}
          <View style={styles.detailCard}>
            <Text style={styles.sectionTitle}>💰 Status e Valores</Text>
            
            <View style={styles.statusRow}>
              <Text style={styles.detailLabel}>Valor Total:</Text>
              <Text style={styles.totalValue}>R$ {selectedOrder.final_total.toFixed(2)}</Text>
            </View>

            <View style={styles.statusRow}>
              <Text style={styles.detailLabel}>Pagamento:</Text>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedOrder.payment_status) + '20' }]}>
                <Text style={[styles.statusText, { color: getStatusColor(selectedOrder.payment_status) }]}>
                  {getStatusText(selectedOrder.payment_status)}
                </Text>
              </View>
            </View>

            <View style={styles.statusRow}>
              <Text style={styles.detailLabel}>Entrega:</Text>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedOrder.delivery_status) + '20' }]}>
                <Text style={[styles.statusText, { color: getStatusColor(selectedOrder.delivery_status) }]}>
                  {getStatusText(selectedOrder.delivery_status)}
                </Text>
              </View>
            </View>

            <View style={styles.statusRow}>
              <Text style={styles.detailLabel}>Data:</Text>
              <Text style={styles.detailValue}>
                {new Date(selectedOrder.created_at).toLocaleString('pt-BR')}
              </Text>
            </View>
          </View>

          {/* Botões de Ação */}
          <View style={styles.actionsCard}>
            <TouchableOpacity
              style={[styles.actionButton, styles.statusButton]}
              onPress={() => handleStatusChange(selectedOrder)}
              disabled={updatingStatus}
            >
              {updatingStatus ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="swap-horizontal" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>Alterar Status de Entrega</Text>
                </>
              )}
            </TouchableOpacity>

            {selectedOrder.delivery_status !== 'delivered' && selectedOrder.payment_status === 'paid' && (
              <TouchableOpacity
                style={[styles.actionButton, styles.deliverButton]}
                onPress={() => updateDeliveryStatus(selectedOrder.id, 'delivered')}
                disabled={updatingStatus}
              >
                {updatingStatus ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.actionButtonText}>Confirmar Entrega</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Botão de cancelar pedido */}
            {selectedOrder.payment_status !== 'cancelled' && (
              <TouchableOpacity
                style={[styles.actionButton, styles.cancelActionButton]}
                onPress={() => handleCancelOrder(selectedOrder)}
                disabled={updatingStatus}
              >
                {updatingStatus ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="close-circle" size={20} color="#fff" />
                    <Text style={styles.actionButtonText}>Cancelar Pedido</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>

        {/* Modal de Confirmação de Cancelamento - Detalhes */}
        <Modal
          visible={showCancelModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowCancelModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Ionicons name="warning" size={48} color="#FF3B30" />
                <Text style={styles.modalTitle}>Cancelar Pedido</Text>
              </View>
              
              <Text style={styles.modalMessage}>
                Tem certeza que deseja cancelar este pedido?{'\n\n'}
                O cliente será notificado sobre caracteres inválidos e o estorno do valor.
              </Text>
              
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => {
                    setShowCancelModal(false);
                    setOrderToCancel(null);
                  }}
                >
                  <Text style={styles.modalButtonTextCancel}>Não</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonConfirm]}
                  onPress={confirmCancelOrder}
                >
                  <Text style={styles.modalButtonTextConfirm}>Sim, Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
        <View style={{ width: 24 }} />
      </View>

      {/* Filtros */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>Todos</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'pending' && styles.filterButtonActive]}
          onPress={() => setFilter('pending')}
        >
          <Text style={[styles.filterText, filter === 'pending' && styles.filterTextActive]}>Pendentes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'paid' && styles.filterButtonActive]}
          onPress={() => setFilter('paid')}
        >
          <Text style={[styles.filterText, filter === 'paid' && styles.filterTextActive]}>Pagos</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'delivered' && styles.filterButtonActive]}
          onPress={() => setFilter('delivered')}
        >
          <Text style={[styles.filterText, filter === 'delivered' && styles.filterTextActive]}>Entregues</Text>
        </TouchableOpacity>
      </ScrollView>

      <ScrollView
        style={styles.ordersList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {orders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={80} color="#CCC" />
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
                <Text style={styles.orderDate}>
                  {new Date(order.created_at).toLocaleDateString('pt-BR')}
                </Text>
              </View>

              <View style={styles.orderInfo}>
                <View style={styles.orderInfoRow}>
                  <Ionicons name="person-outline" size={16} color="#666" />
                  <Text style={styles.orderInfoText}>{order.user_name}</Text>
                </View>
                <View style={styles.orderInfoRow}>
                  <Ionicons name="cube-outline" size={16} color="#666" />
                  <Text style={styles.orderInfoText}>{order.items.length} item(s)</Text>
                </View>
              </View>

              <View style={styles.orderFooter}>
                <Text style={styles.orderTotal}>R$ {order.final_total.toFixed(2)}</Text>
                <View style={styles.orderBadges}>
                  <View style={[styles.miniStatusBadge, { backgroundColor: getStatusColor(order.payment_status) }]}>
                    <Text style={styles.miniStatusText}>{getStatusText(order.payment_status)}</Text>
                  </View>
                  <View style={[styles.miniStatusBadge, { backgroundColor: getStatusColor(order.delivery_status) }]}>
                    <Text style={styles.miniStatusText}>{getStatusText(order.delivery_status)}</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Modal de Confirmação de Cancelamento */}
      <Modal
        visible={showCancelModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCancelModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="warning" size={48} color="#FF3B30" />
              <Text style={styles.modalTitle}>Cancelar Pedido</Text>
            </View>
            
            <Text style={styles.modalMessage}>
              Tem certeza que deseja cancelar este pedido?{'\n\n'}
              O cliente será notificado sobre caracteres inválidos e o estorno do valor.
            </Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowCancelModal(false);
                  setOrderToCancel(null);
                }}
              >
                <Text style={styles.modalButtonTextCancel}>Não</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={confirmCancelOrder}
              >
                <Text style={styles.modalButtonTextConfirm}>Sim, Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  filterContainer: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    maxHeight: 60
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    marginRight: 8
  },
  filterButtonActive: {
    backgroundColor: '#007AFF'
  },
  filterText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600'
  },
  filterTextActive: {
    color: '#fff'
  },
  ordersList: {
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
    fontWeight: 'bold',
    color: '#000'
  },
  orderDate: {
    fontSize: 13,
    color: '#666'
  },
  orderInfo: {
    marginBottom: 12
  },
  orderInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8
  },
  orderInfoText: {
    fontSize: 14,
    color: '#666'
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8
  },
  orderTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF'
  },
  orderBadges: {
    flexDirection: 'row',
    gap: 6
  },
  miniStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10
  },
  miniStatusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600'
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16
  },
  content: {
    flex: 1
  },
  detailCard: {
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 0,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 16
  },
  copyableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    marginBottom: 8
  },
  rowContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center'
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
    marginRight: 8,
    minWidth: 80
  },
  detailValue: {
    fontSize: 14,
    color: '#000',
    flex: 1
  },
  productCard: {
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  productTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    flex: 1
  },
  productPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#007AFF'
  },
  fieldsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0'
  },
  fieldsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
    borderRadius: 6,
    marginBottom: 6
  },
  fieldContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center'
  },
  fieldKey: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
    marginRight: 8,
    minWidth: 100
  },
  fieldValue: {
    fontSize: 13,
    color: '#000',
    flex: 1,
    fontFamily: 'monospace'
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0'
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#34C759'
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600'
  },
  actionsCard: {
    margin: 16,
    gap: 12
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  statusButton: {
    backgroundColor: '#007AFF'
  },
  deliverButton: {
    backgroundColor: '#34C759'
  },
  cancelActionButton: {
    backgroundColor: '#FF3B30'
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 9999
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginTop: 12
  },
  modalMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalButtonCancel: {
    backgroundColor: '#F0F0F0'
  },
  modalButtonConfirm: {
    backgroundColor: '#FF3B30'
  },
  modalButtonTextCancel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666'
  },
  modalButtonTextConfirm: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff'
  }
});