import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, ActivityIndicator, Alert, Image, Modal, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { BACKEND_URL } from '../config';

interface DashboardStats {
  period: string;
  current_period: {
    revenue: number;
    orders_count: number;
    avg_ticket: number;
  };
  previous_period: {
    revenue: number;
    orders_count: number;
  };
  changes: {
    revenue_percent: number;
    orders_percent: number;
  };
  status_counts: {
    pending: number;
    processing: number;
    delivered: number;
    cancelled: number;
  };
  best_day: {
    date: string | null;
    revenue: number;
  };
}

interface WhatsAppStatus {
  connected: boolean;
  qrCode: string | null;
  loading: boolean;
}

export default function AdminDashboard() {
  const router = useRouter();
  const { logout, adminToken } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [whatsappStatus, setWhatsappStatus] = useState<WhatsAppStatus>({
    connected: true,
    qrCode: null,
    loading: true
  });
  const [showQrModal, setShowQrModal] = useState(false);
  const [hasShownAlert, setHasShownAlert] = useState(false);

  useEffect(() => {
    loadStats();
    checkWhatsAppStatus();
  }, []);

  // Verificar se WhatsApp está desconectado e mostrar alerta
  useEffect(() => {
    if (!whatsappStatus.loading && !whatsappStatus.connected && !hasShownAlert) {
      setHasShownAlert(true);
      // Mostrar o modal do QR Code automaticamente
      setShowQrModal(true);
    }
  }, [whatsappStatus.loading, whatsappStatus.connected, hasShownAlert]);

  const checkWhatsAppStatus = async () => {
    try {
      setWhatsappStatus(prev => ({ ...prev, loading: true }));
      
      const response = await axios.get(`${BACKEND_URL}/api/whatsapp/status`);
      const isConnected = response.data.connected;
      
      let qrCode = null;
      if (!isConnected) {
        try {
          const qrResponse = await axios.get(`${BACKEND_URL}/api/whatsapp/qr`);
          if (qrResponse.data.qr) {
            qrCode = qrResponse.data.qr;
          }
        } catch (qrError) {
          console.log('QR não disponível ainda');
        }
      }
      
      setWhatsappStatus({
        connected: isConnected,
        qrCode: qrCode,
        loading: false
      });
    } catch (error) {
      console.error('Erro ao verificar status WhatsApp:', error);
      setWhatsappStatus(prev => ({ ...prev, loading: false }));
    }
  };

  const startWhatsAppSession = async () => {
    try {
      setWhatsappStatus(prev => ({ ...prev, loading: true }));
      await axios.post(
        `${BACKEND_URL}/api/whatsapp/start`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${adminToken}`
          }
        }
      );
      // Aguardar e verificar novamente
      setTimeout(() => {
        checkWhatsAppStatus();
      }, 3000);
    } catch (error: any) {
      Alert.alert('Erro', error.response?.data?.detail || 'Erro ao iniciar sessão');
      setWhatsappStatus(prev => ({ ...prev, loading: false }));
    }
  };

  const loadStats = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/admin/dashboard/stats`);
      setStats(response.data);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível carregar estatísticas');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.replace('/auth/welcome');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Modal QR Code WhatsApp */}
      <Modal
        visible={showQrModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowQrModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.qrModalContent}>
            <View style={styles.qrModalHeader}>
              <View style={styles.qrAlertIcon}>
                <Ionicons name="alert-circle" size={32} color="#FF9500" />
              </View>
              <Text style={styles.qrModalTitle}>WhatsApp Desconectado!</Text>
              <Text style={styles.qrModalSubtitle}>
                As notificações automáticas não estão funcionando. Escaneie o QR Code abaixo para reconectar.
              </Text>
            </View>
            
            {whatsappStatus.loading ? (
              <View style={styles.qrLoadingContainer}>
                <ActivityIndicator size="large" color="#25D366" />
                <Text style={styles.qrLoadingText}>Gerando QR Code...</Text>
              </View>
            ) : whatsappStatus.qrCode ? (
              <View style={styles.qrCodeContainer}>
                <Image
                  source={{ uri: whatsappStatus.qrCode }}
                  style={styles.qrCodeImage}
                  resizeMode="contain"
                />
                <View style={styles.qrInstructions}>
                  <Text style={styles.qrInstructionsTitle}>Como reconectar:</Text>
                  <Text style={styles.qrInstructionsText}>
                    1. Abra o WhatsApp no celular{'\n'}
                    2. Vá em ⋮ → Aparelhos conectados{'\n'}
                    3. Toque em "Conectar um aparelho"{'\n'}
                    4. Escaneie este QR Code
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.qrNotAvailable}>
                <Ionicons name="qr-code-outline" size={64} color="#CCC" />
                <Text style={styles.qrNotAvailableText}>QR Code não disponível</Text>
                <TouchableOpacity 
                  style={styles.startSessionButton}
                  onPress={startWhatsAppSession}
                >
                  <Ionicons name="play-circle" size={20} color="#fff" />
                  <Text style={styles.startSessionButtonText}>Iniciar Sessão</Text>
                </TouchableOpacity>
              </View>
            )}
            
            <View style={styles.qrModalButtons}>
              <TouchableOpacity 
                style={styles.qrRefreshButton}
                onPress={checkWhatsAppStatus}
              >
                <Ionicons name="refresh" size={20} color="#007AFF" />
                <Text style={styles.qrRefreshButtonText}>Atualizar Status</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.qrCloseButton}
                onPress={() => setShowQrModal(false)}
              >
                <Text style={styles.qrCloseButtonText}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Painel Admin</Text>
          <Text style={styles.subtitle}>Gerenciamento de vendas</Text>
        </View>
        <TouchableOpacity onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* WhatsApp Alert Banner */}
        {!whatsappStatus.loading && !whatsappStatus.connected && (
          <TouchableOpacity 
            style={styles.whatsappAlertBanner}
            onPress={() => setShowQrModal(true)}
          >
            <View style={styles.whatsappAlertContent}>
              <Ionicons name="alert-circle" size={24} color="#FF9500" />
              <View style={styles.whatsappAlertText}>
                <Text style={styles.whatsappAlertTitle}>⚠️ WhatsApp Desconectado</Text>
                <Text style={styles.whatsappAlertSubtitle}>Toque aqui para reconectar e ver o QR Code</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#FF9500" />
          </TouchableOpacity>
        )}

        {/* Stats Cards */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="cash-outline" size={32} color="#34C759" />
            <Text style={styles.statValue}>R$ {stats?.current_period?.revenue?.toFixed(2) || '0.00'}</Text>
            <Text style={styles.statLabel}>Faturamento do Mês</Text>
            {stats && stats.changes && stats.changes.revenue_percent !== 0 && (
              <View style={[styles.changeTag, stats.changes.revenue_percent > 0 ? styles.positive : styles.negative]}>
                <Ionicons 
                  name={stats.changes.revenue_percent > 0 ? 'arrow-up' : 'arrow-down'} 
                  size={12} 
                  color="#fff" 
                />
                <Text style={styles.changeText}>
                  {Math.abs(stats.changes.revenue_percent).toFixed(1)}%
                </Text>
              </View>
            )}
          </View>

          <View style={styles.statCard}>
            <Ionicons name="receipt-outline" size={32} color="#007AFF" />
            <Text style={styles.statValue}>{stats?.current_period?.orders_count || 0}</Text>
            <Text style={styles.statLabel}>Pedidos do Mês</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="trending-up-outline" size={32} color="#FF9500" />
            <Text style={styles.statValue}>R$ {stats?.current_period?.avg_ticket?.toFixed(2) || '0.00'}</Text>
            <Text style={styles.statLabel}>Ticket Médio</Text>
          </View>
        </View>

        {/* Order Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status dos Pedidos</Text>
          <View style={styles.statusGrid}>
            <View style={styles.statusCard}>
              <Text style={styles.statusValue}>{stats?.status_counts?.pending || 0}</Text>
              <Text style={styles.statusLabel}>Pendentes</Text>
            </View>
            <View style={styles.statusCard}>
              <Text style={styles.statusValue}>{stats?.status_counts?.processing || 0}</Text>
              <Text style={styles.statusLabel}>Processando</Text>
            </View>
            <View style={styles.statusCard}>
              <Text style={styles.statusValue}>{stats?.status_counts?.delivered || 0}</Text>
              <Text style={styles.statusLabel}>Entregues</Text>
            </View>
            <View style={styles.statusCard}>
              <Text style={styles.statusValue}>{stats?.status_counts?.cancelled || 0}</Text>
              <Text style={styles.statusLabel}>Cancelados</Text>
            </View>
          </View>
        </View>

        {/* Management Menu */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gerenciar</Text>
          
          <TouchableOpacity style={styles.menuCard} onPress={() => router.push('/admin/categories')}>
            <View style={[styles.menuIcon, { backgroundColor: '#007AFF20' }]}>
              <Ionicons name="grid" size={24} color="#007AFF" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>Categorias</Text>
              <Text style={styles.menuSubtitle}>Gerenciar categorias de produtos</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#CCC" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuCard} onPress={() => router.push('/admin/products')}>
            <View style={[styles.menuIcon, { backgroundColor: '#34C75920' }]}>
              <Ionicons name="cube" size={24} color="#34C759" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>Produtos</Text>
              <Text style={styles.menuSubtitle}>Cadastrar e editar produtos</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#CCC" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuCard} onPress={() => router.push('/admin/orders')}>
            <View style={[styles.menuIcon, { backgroundColor: '#FF950020' }]}>
              <Ionicons name="receipt" size={24} color="#FF9500" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>Pedidos</Text>
              <Text style={styles.menuSubtitle}>Ver e gerenciar pedidos</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#CCC" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuCard} onPress={() => router.push('/admin/whatsapp-config')}>
            <View style={[styles.menuIcon, { backgroundColor: '#25D36620' }]}>
              <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>WhatsApp</Text>
              <Text style={styles.menuSubtitle}>Configurar notificações automáticas</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#CCC" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuCard} onPress={() => router.push('/admin/reports')}>
            <View style={[styles.menuIcon, { backgroundColor: '#AF52DE20' }]}>
              <Ionicons name="bar-chart" size={24} color="#AF52DE" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>Relatórios</Text>
              <Text style={styles.menuSubtitle}>Visualizar relatórios detalhados</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#CCC" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuCard} onPress={() => router.push('/admin/business-hours')}>
            <View style={[styles.menuIcon, { backgroundColor: '#FF3B3020' }]}>
              <Ionicons name="time" size={24} color="#FF3B30" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>Horário de Atendimento</Text>
              <Text style={styles.menuSubtitle}>Configurar horários de funcionamento</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#CCC" />
          </TouchableOpacity>
        </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
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
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4
  },
  content: {
    flex: 1
  },
  statsGrid: {
    padding: 16,
    gap: 12
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    position: 'relative'
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginTop: 12
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4
  },
  changeTag: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4
  },
  positive: {
    backgroundColor: '#34C759'
  },
  negative: {
    backgroundColor: '#FF3B30'
  },
  changeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600'
  },
  section: {
    marginTop: 16,
    paddingHorizontal: 16
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 12
  },
  statusGrid: {
    flexDirection: 'row',
    gap: 12
  },
  statusCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center'
  },
  statusValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF'
  },
  statusLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4
  },
  menuCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  menuIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center'
  },
  menuContent: {
    flex: 1
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4
  },
  menuSubtitle: {
    fontSize: 12,
    color: '#666'
  },
  // WhatsApp Alert Banner Styles
  whatsappAlertBanner: {
    backgroundColor: '#FFF3E0',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#FF9500'
  },
  whatsappAlertContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1
  },
  whatsappAlertText: {
    flex: 1
  },
  whatsappAlertTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF9500'
  },
  whatsappAlertSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2
  },
  // QR Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  qrModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%'
  },
  qrModalHeader: {
    alignItems: 'center',
    marginBottom: 20
  },
  qrAlertIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16
  },
  qrModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF9500',
    textAlign: 'center',
    marginBottom: 8
  },
  qrModalSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20
  },
  qrLoadingContainer: {
    alignItems: 'center',
    padding: 40
  },
  qrLoadingText: {
    fontSize: 14,
    color: '#666',
    marginTop: 16
  },
  qrCodeContainer: {
    alignItems: 'center'
  },
  qrCodeImage: {
    width: 250,
    height: 250,
    marginBottom: 16
  },
  qrInstructions: {
    backgroundColor: '#E8F5E9',
    padding: 16,
    borderRadius: 12,
    width: '100%'
  },
  qrInstructionsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#25D366',
    marginBottom: 8
  },
  qrInstructionsText: {
    fontSize: 13,
    color: '#25D366',
    lineHeight: 20
  },
  qrNotAvailable: {
    alignItems: 'center',
    padding: 20
  },
  qrNotAvailableText: {
    fontSize: 14,
    color: '#999',
    marginTop: 12,
    marginBottom: 20
  },
  startSessionButton: {
    backgroundColor: '#25D366',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  startSessionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff'
  },
  qrModalButtons: {
    marginTop: 20,
    gap: 12
  },
  qrRefreshButton: {
    backgroundColor: '#F0F7FF',
    padding: 14,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8
  },
  qrRefreshButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF'
  },
  qrCloseButton: {
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0'
  },
  qrCloseButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666'
  }
});
