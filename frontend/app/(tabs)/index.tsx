import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Dimensions, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCartStore } from '../../stores/cartStore';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const cartItems = useCartStore((state) => state.items);

  const menuItems = [
    {
      title: 'Produtos',
      subtitle: 'Veja nosso catálogo',
      icon: 'storefront',
      gradient: ['#6366F1', '#8B5CF6'],
      onPress: () => router.push('/(tabs)/products')
    },
    {
      title: 'Carrinho',
      subtitle: `${cartItems.length} ${cartItems.length === 1 ? 'item' : 'itens'}`,
      icon: 'bag-handle',
      gradient: ['#10B981', '#34D399'],
      onPress: () => router.push('/(tabs)/cart')
    },
    {
      title: 'Meus Pedidos',
      subtitle: 'Acompanhe seus pedidos',
      icon: 'receipt',
      gradient: ['#F59E0B', '#FBBF24'],
      onPress: () => router.push('/(tabs)/orders')
    },
    {
      title: 'Perfil',
      subtitle: 'Sua conta',
      icon: 'person',
      gradient: ['#EC4899', '#F472B6'],
      onPress: () => router.push('/(tabs)/profile')
    }
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient
          colors={['#1E1E2E', '#2D2D44']}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.greeting}>Olá,</Text>
              <Text style={styles.userName}>{user?.name || 'Visitante'}</Text>
            </View>
            <TouchableOpacity 
              style={styles.profileButton}
              onPress={() => router.push('/(tabs)/profile')}
            >
              <Ionicons name="person-circle" size={48} color="#6366F1" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Welcome Banner */}
        <View style={styles.bannerContainer}>
          <LinearGradient
            colors={['#6366F1', '#8B5CF6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.banner}
          >
            <View style={styles.bannerContent}>
              <Ionicons name="flash" size={32} color="#fff" />
              <View style={styles.bannerText}>
                <Text style={styles.bannerTitle}>MARKIMAGEM TV</Text>
                <Text style={styles.bannerSubtitle}>Ativações instantâneas</Text>
              </View>
            </View>
            <View style={styles.bannerBadge}>
              <Text style={styles.bannerBadgeText}>ATIVAÇÃO RÁPIDA</Text>
            </View>
          </LinearGradient>
        </View>

        {/* Menu Section */}
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>O que deseja fazer?</Text>
          
          <View style={styles.menuGrid}>
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.menuCard}
                onPress={item.onPress}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#2D2D44', '#1E1E2E']}
                  style={styles.cardGradient}
                >
                  <LinearGradient
                    colors={item.gradient}
                    style={styles.iconContainer}
                  >
                    <Ionicons name={item.icon as any} size={28} color="#fff" />
                  </LinearGradient>
                  <Text style={styles.menuTitle}>{item.title}</Text>
                  <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                  {item.title === 'Carrinho' && cartItems.length > 0 && (
                    <View style={styles.cartBadge}>
                      <Text style={styles.cartBadgeText}>{cartItems.length}</Text>
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>Acesso Rápido</Text>
          <TouchableOpacity 
            style={styles.quickActionButton}
            onPress={() => router.push('/(tabs)/products')}
          >
            <LinearGradient
              colors={['#2D2D44', '#3D3D54']}
              style={styles.quickActionGradient}
            >
              <View style={styles.quickActionContent}>
                <View style={styles.quickActionIconBg}>
                  <Ionicons name="arrow-forward-circle" size={24} color="#6366F1" />
                </View>
                <View style={styles.quickActionTextContainer}>
                  <Text style={styles.quickActionTitle}>Ver Catálogo Completo</Text>
                  <Text style={styles.quickActionSubtitle}>Explore todos os produtos disponíveis</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#6B7280" />
            </LinearGradient>
          </TouchableOpacity>
        </View>

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
  header: {
    padding: 20,
    paddingTop: 10
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  greeting: {
    fontSize: 16,
    color: '#9CA3AF'
  },
  userName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff'
  },
  profileButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  bannerContainer: {
    paddingHorizontal: 16,
    marginTop: -10
  },
  banner: {
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  bannerText: {
    gap: 2
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff'
  },
  bannerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)'
  },
  bannerBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20
  },
  bannerBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff'
  },
  content: {
    padding: 16
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16
  },
  menuCard: {
    width: CARD_WIDTH,
    borderRadius: 16,
    overflow: 'hidden'
  },
  cardGradient: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    minHeight: 140
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4
  },
  menuSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center'
  },
  cartBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#EF4444',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  cartBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold'
  },
  quickActions: {
    padding: 16,
    paddingTop: 8
  },
  quickActionButton: {
    borderRadius: 16,
    overflow: 'hidden'
  },
  quickActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  quickActionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  quickActionIconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  quickActionTextContainer: {
    flex: 1
  },
  quickActionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff'
  },
  quickActionSubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 2
  }
});
