import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { BACKEND_URL } from '../config';

interface DashboardStats {
  current_month: {
    revenue: number;
    orders_count: number;
    avg_ticket: number;
  };
  revenue_change_percent: number;
  status_counts: {
    pending: number;
    paid: number;
    delivered: number;
  };
}

export default function AdminDashboard() {
  const router = useRouter();
  const { logout } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

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

  const handleLogout = () => {
    Alert.alert(
      'Sair',
      'Tem certeza que deseja sair do painel admin?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/auth/welcome');
          }
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

  return (
    <SafeAreaView style={styles.container}>
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
        {/* Stats Cards */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="cash-outline" size={32} color="#34C759" />
            <Text style={styles.statValue}>R$ {stats?.current_month.revenue.toFixed(2)}</Text>
            <Text style={styles.statLabel}>Faturamento do Mês</Text>
            {stats && stats.revenue_change_percent !== 0 && (
              <View style={[styles.changeTag, stats.revenue_change_percent > 0 ? styles.positive : styles.negative]}>
                <Ionicons 
                  name={stats.revenue_change_percent > 0 ? 'arrow-up' : 'arrow-down'} 
                  size={12} 
                  color="#fff" 
                />
                <Text style={styles.changeText}>
                  {Math.abs(stats.revenue_change_percent).toFixed(1)}%
                </Text>
              </View>
            )}
          </View>

          <View style={styles.statCard}>
            <Ionicons name="receipt-outline" size={32} color="#007AFF" />
            <Text style={styles.statValue}>{stats?.current_month.orders_count}</Text>
            <Text style={styles.statLabel}>Pedidos do Mês</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="trending-up-outline" size={32} color="#FF9500" />
            <Text style={styles.statValue}>R$ {stats?.current_month.avg_ticket.toFixed(2)}</Text>
            <Text style={styles.statLabel}>Ticket Médio</Text>
          </View>
        </View>

        {/* Order Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status dos Pedidos</Text>
          <View style={styles.statusGrid}>
            <View style={styles.statusCard}>
              <Text style={styles.statusValue}>{stats?.status_counts.pending}</Text>
              <Text style={styles.statusLabel}>Pendentes</Text>
            </View>
            <View style={styles.statusCard}>
              <Text style={styles.statusValue}>{stats?.status_counts.paid}</Text>
              <Text style={styles.statusLabel}>Pagos</Text>
            </View>
            <View style={styles.statusCard}>
              <Text style={styles.statusValue}>{stats?.status_counts.delivered}</Text>
              <Text style={styles.statusLabel}>Entregues</Text>
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
  }
});
