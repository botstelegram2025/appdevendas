import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Image, Linking } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { BACKEND_URL } from '../../config';

interface ProductLink {
  title: string;
  url: string;
  visibility: string;
}

interface OrderItem {
  product_id: string;
  product_name?: string;
  product_image?: string;
  product_links?: ProductLink[];
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

  const openLink = (url: string) => {
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Alert.alert('Erro', 'Não foi possível abrir o link');
      }
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
      case 'approved':
      case 'delivered':
        return '#10B981';
      case 'pending':
      case 'awaiting_payment':
        return '#F59E0B';
      case 'cancelled':
      case 'rejected':
        return '#EF4444';
      case 'processing':
        return '#6366F1';
      default:
        return '#6B7280';
    }
  };

  const getStatusText = (paymentStatus: string, deliveryStatus: string) => {
    if (deliveryStatus === 'delivered') return 'Entregue';
    if (deliveryStatus === 'processing') return 'Em Processamento';
    if (paymentStatus === 'pending') return 'Aguardando Pagamento';
    if (paymentStatus === 'paid' || paymentStatus === 'approved') return 'Pago';
    if (paymentStatus === 'cancelled') return 'Cancelado';
    return 'Aguardando';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Carregando...</Text>
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
      <LinearGradient colors={['#1E1E2E', '#2D2D44']} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalhes do Pedido</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Order Info Card */}
        <LinearGradient colors={['#2D2D44', '#1E1E2E']} style={styles.card}>
          <View style={styles.orderHeader}>
            <View>
              <Text style={styles.orderId}>Pedido #{order.id.substring(0, 8)}</Text>
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
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>{status}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Products Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Produtos</Text>
          {order.items.map((item, index) => (
            <LinearGradient 
              key={index} 
              colors={['#2D2D44', '#1E1E2E']} 
              style={styles.itemCard}
            >
              <View style={styles.itemHeaderRow}>
                {item.product_image ? (
                  <Image
                    source={{ uri: item.product_image }}
                    style={styles.productImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.productImagePlaceholder}>
                    <Ionicons name="cube" size={32} color="#6366F1" />
                  </View>
                )}
                <View style={styles.itemHeaderInfo}>
                  <Text style={styles.itemName}>{item.product_name || 'Produto'}</Text>
                  <Text style={styles.itemQuantity}>Quantidade: {item.quantity}</Text>
                  <Text style={styles.itemUnitPrice}>R$ {item.unit_price.toFixed(2)} /un</Text>
                </View>
                <Text style={styles.itemPrice}>R$ {item.subtotal.toFixed(2)}</Text>
              </View>
              
              {Object.keys(item.fields_data || {}).length > 0 && (
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

              {/* Links do Produto */}
              {item.product_links && item.product_links.length > 0 && (
                <View style={styles.linksContainer}>
                  <View style={styles.linksHeader}>
                    <Ionicons name="link" size={18} color="#6366F1" />
                    <Text style={styles.linksTitle}>Links do Produto</Text>
                  </View>
                  {item.product_links.map((link, linkIndex) => (
                    <TouchableOpacity 
                      key={linkIndex} 
                      style={styles.linkButton}
                      onPress={() => openLink(link.url)}
                    >
                      <LinearGradient
                        colors={['#6366F1', '#8B5CF6']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.linkGradient}
                      >
                        <Ionicons name="open-outline" size={18} color="#fff" />
                        <Text style={styles.linkText}>{link.title}</Text>
                        <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.7)" />
                      </LinearGradient>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </LinearGradient>
          ))}
        </View>

        {/* Payment Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resumo do Pagamento</Text>
          <LinearGradient colors={['#2D2D44', '#1E1E2E']} style={styles.summaryCard}>
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
          </LinearGradient>
        </View>

        {order.payment_id && (
          <View style={styles.paymentInfo}>
            <Ionicons name="card-outline" size={20} color="#9CA3AF" />
            <Text style={styles.paymentInfoText}>ID do Pagamento: {order.payment_id}</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827'
  },
  loadingText: {
    color: '#9CA3AF',
    marginTop: 12,
    fontSize: 14
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff'
  },
  content: {
    flex: 1,
    padding: 16
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  orderId: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff'
  },
  orderDate: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600'
  },
  section: {
    marginBottom: 16
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12
  },
  itemCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  itemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  productImage: {
    width: 70,
    height: 70,
    borderRadius: 12
  },
  productImagePlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  itemHeaderInfo: {
    flex: 1,
    marginLeft: 12
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4
  },
  itemQuantity: {
    fontSize: 13,
    color: '#9CA3AF'
  },
  itemUnitPrice: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 2
  },
  itemPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#A5B4FC'
  },
  fieldsContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 12
  },
  fieldsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E5E7EB',
    marginBottom: 8
  },
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 4
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#9CA3AF',
    marginRight: 8
  },
  fieldValue: {
    fontSize: 13,
    color: '#fff',
    flex: 1
  },
  linksContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)'
  },
  linksHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12
  },
  linksTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#A5B4FC'
  },
  linkButton: {
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden'
  },
  linkGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 10
  },
  linkText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#fff'
  },
  summaryCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  summaryLabel: {
    fontSize: 14,
    color: '#9CA3AF'
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#E5E7EB'
  },
  discountLabel: {
    color: '#10B981'
  },
  discountValue: {
    color: '#10B981'
  },
  totalRow: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    marginBottom: 0
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff'
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#A5B4FC'
  },
  paymentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    padding: 14,
    borderRadius: 12,
    gap: 10
  },
  paymentInfoText: {
    fontSize: 13,
    color: '#9CA3AF',
    flex: 1
  }
});
