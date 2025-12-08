import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { BACKEND_URL } from '../../config';
import { useAuth } from '../../contexts/AuthContext';

const { width } = Dimensions.get('window');

export default function ReportsScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');
  
  const [stats, setStats] = useState<any>(null);
  const [monthlyRevenue, setMonthlyRevenue] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [salesByCategory, setSalesByCategory] = useState<any[]>([]);

  useEffect(() => {
    loadReports();
  }, [period]);

  const loadReports = async () => {
    try {
      setLoading(true);
      
      // Carregar todas as estatísticas
      const [statsRes, revenueRes, productsRes, categoriesRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/admin/dashboard/stats`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${BACKEND_URL}/api/admin/dashboard/revenue`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${BACKEND_URL}/api/admin/dashboard/top-products`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${BACKEND_URL}/api/admin/dashboard/sales-by-category`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setStats(statsRes.data);
      setMonthlyRevenue(revenueRes.data);
      setTopProducts(productsRes.data);
      setSalesByCategory(categoriesRes.data);
    } catch (error) {
      console.error('Erro ao carregar relatórios:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getMonthName = (monthStr: string) => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const [year, month] = monthStr.split('-');
    return `${months[parseInt(month) - 1]}/${year.slice(2)}`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Carregando relatórios...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>Relatórios</Text>
        <TouchableOpacity onPress={loadReports}>
          <Ionicons name="refresh" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Período Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Período de Análise</Text>
          <View style={styles.periodSelector}>
            <TouchableOpacity 
              style={[styles.periodButton, period === 'week' && styles.periodButtonActive]}
              onPress={() => setPeriod('week')}
            >
              <Text style={[styles.periodText, period === 'week' && styles.periodTextActive]}>Semana</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.periodButton, period === 'month' && styles.periodButtonActive]}
              onPress={() => setPeriod('month')}
            >
              <Text style={[styles.periodText, period === 'month' && styles.periodTextActive]}>Mês</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.periodButton, period === 'year' && styles.periodButtonActive]}
              onPress={() => setPeriod('year')}
            >
              <Text style={[styles.periodText, period === 'year' && styles.periodTextActive]}>Ano</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Resumo Geral */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resumo Geral</Text>
          <View style={styles.summaryGrid}>
            <View style={[styles.summaryCard, { backgroundColor: '#007AFF10' }]}>
              <Ionicons name="cash-outline" size={32} color="#007AFF" />
              <Text style={styles.summaryValue}>{formatCurrency(stats?.total_revenue || 0)}</Text>
              <Text style={styles.summaryLabel}>Faturamento Total</Text>
            </View>
            
            <View style={[styles.summaryCard, { backgroundColor: '#34C75910' }]}>
              <Ionicons name="cart-outline" size={32} color="#34C759" />
              <Text style={styles.summaryValue}>{stats?.total_orders || 0}</Text>
              <Text style={styles.summaryLabel}>Total de Pedidos</Text>
            </View>
            
            <View style={[styles.summaryCard, { backgroundColor: '#FF950010' }]}>
              <Ionicons name="trending-up-outline" size={32} color="#FF9500" />
              <Text style={styles.summaryValue}>{formatCurrency(stats?.average_ticket || 0)}</Text>
              <Text style={styles.summaryLabel}>Ticket Médio</Text>
            </View>
            
            <View style={[styles.summaryCard, { backgroundColor: '#AF52DE10' }]}>
              <Ionicons name="checkmark-circle-outline" size={32} color="#AF52DE" />
              <Text style={styles.summaryValue}>{stats?.status_counts.delivered || 0}</Text>
              <Text style={styles.summaryLabel}>Pedidos Entregues</Text>
            </View>
          </View>
        </View>

        {/* Receita Mensal */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Receita Mensal (Últimos 6 Meses)</Text>
          {monthlyRevenue.length > 0 ? (
            <View style={styles.chartContainer}>
              {monthlyRevenue.slice(0, 6).map((item, index) => (
                <View key={index} style={styles.barContainer}>
                  <View style={styles.barWrapper}>
                    <View 
                      style={[
                        styles.bar, 
                        { 
                          height: Math.max(30, (item.total / Math.max(...monthlyRevenue.map(r => r.total))) * 150),
                          backgroundColor: '#007AFF'
                        }
                      ]} 
                    />
                  </View>
                  <Text style={styles.barValue}>{formatCurrency(item.total)}</Text>
                  <Text style={styles.barLabel}>{getMonthName(item.month)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="bar-chart-outline" size={48} color="#CCC" />
              <Text style={styles.emptyText}>Nenhum dado disponível</Text>
            </View>
          )}
        </View>

        {/* Top Produtos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Produtos Mais Vendidos</Text>
          {topProducts.length > 0 ? (
            <View style={styles.listContainer}>
              {topProducts.slice(0, 5).map((product, index) => (
                <View key={index} style={styles.productCard}>
                  <View style={styles.rankBadge}>
                    <Text style={styles.rankText}>{index + 1}º</Text>
                  </View>
                  <View style={styles.productInfo}>
                    <Text style={styles.productName}>{product.name}</Text>
                    <Text style={styles.productStats}>
                      {product.total_sold} vendas • {formatCurrency(product.total_revenue)}
                    </Text>
                  </View>
                  <View style={styles.productRevenue}>
                    <Text style={styles.revenueValue}>{formatCurrency(product.total_revenue)}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="cube-outline" size={48} color="#CCC" />
              <Text style={styles.emptyText}>Nenhum produto vendido</Text>
            </View>
          )}
        </View>

        {/* Vendas por Categoria */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vendas por Categoria</Text>
          {salesByCategory.length > 0 ? (
            <View style={styles.listContainer}>
              {salesByCategory.map((category, index) => (
                <View key={index} style={styles.categoryCard}>
                  <View style={styles.categoryIcon}>
                    <Ionicons name="grid" size={24} color="#007AFF" />
                  </View>
                  <View style={styles.categoryInfo}>
                    <Text style={styles.categoryName}>{category.category || 'Sem categoria'}</Text>
                    <Text style={styles.categoryStats}>
                      {category.total_sold} produtos vendidos
                    </Text>
                  </View>
                  <View style={styles.categoryRevenue}>
                    <Text style={styles.categoryValue}>{formatCurrency(category.total_revenue)}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="grid-outline" size={48} color="#CCC" />
              <Text style={styles.emptyText}>Nenhuma categoria com vendas</Text>
            </View>
          )}
        </View>

        {/* Status dos Pedidos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status dos Pedidos</Text>
          <View style={styles.statusGrid}>
            <View style={[styles.statusCard, { borderLeftColor: '#FF9500' }]}>
              <Text style={styles.statusValue}>{stats?.status_counts.pending || 0}</Text>
              <Text style={styles.statusLabel}>Pendentes</Text>
            </View>
            <View style={[styles.statusCard, { borderLeftColor: '#007AFF' }]}>
              <Text style={styles.statusValue}>{stats?.status_counts.paid || 0}</Text>
              <Text style={styles.statusLabel}>Pagos</Text>
            </View>
            <View style={[styles.statusCard, { borderLeftColor: '#34C759' }]}>
              <Text style={styles.statusValue}>{stats?.status_counts.delivered || 0}</Text>
              <Text style={styles.statusLabel}>Entregues</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 40 }} />
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
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666'
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
    fontSize: 20,
    fontWeight: 'bold'
  },
  content: {
    flex: 1
  },
  section: {
    padding: 20,
    backgroundColor: '#fff',
    marginBottom: 12
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#000'
  },
  periodSelector: {
    flexDirection: 'row',
    gap: 8
  },
  periodButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    alignItems: 'center'
  },
  periodButtonActive: {
    backgroundColor: '#007AFF'
  },
  periodText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666'
  },
  periodTextActive: {
    color: '#fff'
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  summaryCard: {
    width: (width - 52) / 2,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginTop: 8
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center'
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 220,
    paddingTop: 20
  },
  barContainer: {
    flex: 1,
    alignItems: 'center',
    gap: 8
  },
  barWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: 150
  },
  bar: {
    width: 30,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    minHeight: 30
  },
  barValue: {
    fontSize: 10,
    fontWeight: '600',
    color: '#000'
  },
  barLabel: {
    fontSize: 10,
    color: '#666'
  },
  listContainer: {
    gap: 12
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    gap: 12
  },
  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center'
  },
  rankText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff'
  },
  productInfo: {
    flex: 1
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4
  },
  productStats: {
    fontSize: 12,
    color: '#666'
  },
  productRevenue: {
    alignItems: 'flex-end'
  },
  revenueValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#34C759'
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    gap: 12
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#007AFF20',
    justifyContent: 'center',
    alignItems: 'center'
  },
  categoryInfo: {
    flex: 1
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4
  },
  categoryStats: {
    fontSize: 12,
    color: '#666'
  },
  categoryRevenue: {
    alignItems: 'flex-end'
  },
  categoryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF'
  },
  statusGrid: {
    flexDirection: 'row',
    gap: 12
  },
  statusCard: {
    flex: 1,
    padding: 16,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    borderLeftWidth: 4,
    alignItems: 'center'
  },
  statusValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4
  },
  statusLabel: {
    fontSize: 12,
    color: '#666'
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12
  },
  emptyText: {
    fontSize: 14,
    color: '#999'
  }
});
