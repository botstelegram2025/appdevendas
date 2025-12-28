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
      
      // Carregar todas as estatísticas com o período selecionado
      const [statsRes, revenueRes, productsRes, categoriesRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/admin/dashboard/stats?period=${period}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${BACKEND_URL}/api/admin/dashboard/revenue-over-time?period=${period}`, {
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
          <Text style={styles.sectionTitle}>Resumo do Período</Text>
          <View style={styles.summaryGrid}>
            <View style={[styles.summaryCard, { backgroundColor: '#007AFF10' }]}>
              <Ionicons name="cash-outline" size={32} color="#007AFF" />
              <Text style={styles.summaryValue}>{formatCurrency(stats?.current_period?.revenue || 0)}</Text>
              <Text style={styles.summaryLabel}>Faturamento</Text>
              {stats?.changes?.revenue_percent !== 0 && (
                <View style={styles.changeContainer}>
                  <Ionicons 
                    name={stats?.changes?.revenue_percent > 0 ? "trending-up" : "trending-down"} 
                    size={14} 
                    color={stats?.changes?.revenue_percent > 0 ? "#34C759" : "#FF3B30"} 
                  />
                  <Text style={[
                    styles.changeText,
                    { color: stats?.changes?.revenue_percent > 0 ? "#34C759" : "#FF3B30" }
                  ]}>
                    {Math.abs(stats?.changes?.revenue_percent || 0).toFixed(1)}%
                  </Text>
                </View>
              )}
            </View>
            
            <View style={[styles.summaryCard, { backgroundColor: '#34C75910' }]}>
              <Ionicons name="cart-outline" size={32} color="#34C759" />
              <Text style={styles.summaryValue}>{stats?.current_period?.orders_count || 0}</Text>
              <Text style={styles.summaryLabel}>Pedidos</Text>
              {stats?.changes?.orders_percent !== 0 && (
                <View style={styles.changeContainer}>
                  <Ionicons 
                    name={stats?.changes?.orders_percent > 0 ? "trending-up" : "trending-down"} 
                    size={14} 
                    color={stats?.changes?.orders_percent > 0 ? "#34C759" : "#FF3B30"} 
                  />
                  <Text style={[
                    styles.changeText,
                    { color: stats?.changes?.orders_percent > 0 ? "#34C759" : "#FF3B30" }
                  ]}>
                    {Math.abs(stats?.changes?.orders_percent || 0).toFixed(1)}%
                  </Text>
                </View>
              )}
            </View>
            
            <View style={[styles.summaryCard, { backgroundColor: '#FF950010' }]}>
              <Ionicons name="trending-up-outline" size={32} color="#FF9500" />
              <Text style={styles.summaryValue}>{formatCurrency(stats?.current_period?.avg_ticket || 0)}</Text>
              <Text style={styles.summaryLabel}>Ticket Médio</Text>
            </View>
            
            <View style={[styles.summaryCard, { backgroundColor: '#AF52DE10' }]}>
              <Ionicons name="checkmark-circle-outline" size={32} color="#AF52DE" />
              <Text style={styles.summaryValue}>{stats?.status_counts?.delivered || 0}</Text>
              <Text style={styles.summaryLabel}>Entregues</Text>
            </View>
          </View>
        </View>
        
        {/* Status dos Pedidos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status dos Pedidos</Text>
          <View style={styles.statusGrid}>
            <View style={styles.statusCard}>
              <View style={[styles.statusIcon, { backgroundColor: '#FF950010' }]}>
                <Ionicons name="time-outline" size={24} color="#FF9500" />
              </View>
              <Text style={styles.statusValue}>{stats?.status_counts?.pending || 0}</Text>
              <Text style={styles.statusLabel}>Pendentes</Text>
            </View>
            
            <View style={styles.statusCard}>
              <View style={[styles.statusIcon, { backgroundColor: '#007AFF10' }]}>
                <Ionicons name="hourglass-outline" size={24} color="#007AFF" />
              </View>
              <Text style={styles.statusValue}>{stats?.status_counts?.processing || 0}</Text>
              <Text style={styles.statusLabel}>Processando</Text>
            </View>
            
            <View style={styles.statusCard}>
              <View style={[styles.statusIcon, { backgroundColor: '#34C75910' }]}>
                <Ionicons name="checkmark-circle-outline" size={24} color="#34C759" />
              </View>
              <Text style={styles.statusValue}>{stats?.status_counts?.delivered || 0}</Text>
              <Text style={styles.statusLabel}>Entregues</Text>
            </View>
            
            <View style={styles.statusCard}>
              <View style={[styles.statusIcon, { backgroundColor: '#FF3B3010' }]}>
                <Ionicons name="close-circle-outline" size={24} color="#FF3B30" />
              </View>
              <Text style={styles.statusValue}>{stats?.status_counts?.cancelled || 0}</Text>
              <Text style={styles.statusLabel}>Cancelados</Text>
            </View>
          </View>
        </View>

        {/* Média Diária */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Média Diária de Vendas</Text>
          <View style={styles.dailyAvgCard}>
            <View style={styles.dailyAvgHeader}>
              <Ionicons name="calendar" size={32} color="#007AFF" />
              <Text style={styles.dailyAvgPeriod}>
                {stats?.current_period?.days_in_period || 0} dias no período
              </Text>
            </View>
            
            <View style={styles.dailyAvgGrid}>
              <View style={styles.dailyAvgItem}>
                <Text style={styles.dailyAvgLabel}>Faturamento/Dia</Text>
                <Text style={styles.dailyAvgValue}>
                  {formatCurrency(stats?.current_period?.daily_avg_revenue || 0)}
                </Text>
              </View>
              
              <View style={styles.dailyAvgDivider} />
              
              <View style={styles.dailyAvgItem}>
                <Text style={styles.dailyAvgLabel}>Pedidos/Dia</Text>
                <Text style={styles.dailyAvgValue}>
                  {(stats?.current_period?.daily_avg_orders || 0).toFixed(1)}
                </Text>
              </View>
            </View>
            
            <View style={styles.dailyAvgInfo}>
              <Ionicons name="information-circle" size={16} color="#666" />
              <Text style={styles.dailyAvgInfoText}>
                Média calculada com base nos últimos{' '}
                {period === 'week' ? '7 dias' : period === 'year' ? '12 meses' : '30 dias'}
              </Text>
            </View>
          </View>
        </View>

        {/* Melhor Dia de Vendas */}
        {stats?.best_day?.date && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Melhor Dia de Vendas</Text>
            <View style={styles.bestDayCard}>
              <Ionicons name="trophy" size={48} color="#FFD700" />
              <View style={styles.bestDayInfo}>
                <Text style={styles.bestDayDate}>
                  {new Date(stats.best_day.date).toLocaleDateString('pt-BR')}
                </Text>
                <Text style={styles.bestDayRevenue}>{formatCurrency(stats.best_day.revenue)}</Text>
                <Text style={styles.bestDayLabel}>em vendas</Text>
              </View>
            </View>
          </View>
        )}

        {/* Receita ao Longo do Tempo */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {period === 'week' ? 'Receita Diária (Últimos 7 Dias)' : 
             period === 'year' ? 'Receita Mensal (Últimos 12 Meses)' : 
             'Receita Mensal (Últimos 6 Meses)'}
          </Text>
          {monthlyRevenue.length > 0 ? (
            <View style={styles.chartContainer}>
              {monthlyRevenue.map((item, index) => {
                const maxRevenue = Math.max(...monthlyRevenue.map(r => r.revenue || 0));
                const itemRevenue = item.revenue || 0;
                return (
                  <View key={index} style={styles.barContainer}>
                    <View style={styles.barWrapper}>
                      <View 
                        style={[
                          styles.bar, 
                          { 
                            height: maxRevenue > 0 ? Math.max(30, (itemRevenue / maxRevenue) * 150) : 30,
                            backgroundColor: '#007AFF'
                          }
                        ]} 
                      />
                    </View>
                    <Text style={styles.barValue}>{formatCurrency(itemRevenue)}</Text>
                    <Text style={styles.barLabel}>{item.label}</Text>
                    <Text style={styles.barOrders}>{item.orders_count} ped.</Text>
                  </View>
                );
              })}
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
                    <Text style={styles.productName}>{product.product_name}</Text>
                    <Text style={styles.productStats}>
                      {product.quantity_sold} vendas • {formatCurrency(product.revenue)}
                    </Text>
                  </View>
                  <View style={styles.productRevenue}>
                    <Text style={styles.revenueValue}>{formatCurrency(product.revenue)}</Text>
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
                    <Text style={styles.categoryName}>{category.category_name || 'Sem categoria'}</Text>
                    <Text style={styles.categoryStats}>
                      {category.orders_count || 0} pedidos
                    </Text>
                  </View>
                  <View style={styles.categoryRevenue}>
                    <Text style={styles.categoryValue}>{formatCurrency(category.revenue || 0)}</Text>
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
  barOrders: {
    fontSize: 9,
    color: '#999',
    marginTop: 2
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8
  },
  changeText: {
    fontSize: 12,
    fontWeight: '600'
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  statusCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8
  },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center'
  },
  statusValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000'
  },
  statusLabel: {
    fontSize: 12,
    color: '#666'
  },
  bestDayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9E6',
    borderRadius: 16,
    padding: 20,
    gap: 16,
    borderWidth: 2,
    borderColor: '#FFD700'
  },
  bestDayInfo: {
    flex: 1,
    gap: 4
  },
  bestDayDate: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000'
  },
  bestDayRevenue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFD700'
  },
  bestDayLabel: {
    fontSize: 14,
    color: '#666'
  },
  dailyAvgCard: {
    backgroundColor: '#F0F7FF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#007AFF30'
  },
  dailyAvgHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16
  },
  dailyAvgPeriod: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF'
  },
  dailyAvgGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 16
  },
  dailyAvgItem: {
    flex: 1,
    alignItems: 'center'
  },
  dailyAvgDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#007AFF30'
  },
  dailyAvgLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8
  },
  dailyAvgValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF'
  },
  dailyAvgInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8
  },
  dailyAvgInfoText: {
    fontSize: 12,
    color: '#666',
    flex: 1
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
