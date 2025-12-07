import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useCartStore } from '../../stores/cartStore';

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const cartItems = useCartStore((state) => state.items);

  const menuItems = [
    {
      title: 'Produtos',
      subtitle: 'Veja nosso catálogo',
      icon: 'cart',
      color: '#007AFF',
      onPress: () => router.push('/(tabs)/products')
    },
    {
      title: 'Carrinho',
      subtitle: `${cartItems.length} ${cartItems.length === 1 ? 'item' : 'itens'}`,
      icon: 'bag-handle',
      color: '#34C759',
      onPress: () => router.push('/(tabs)/cart')
    },
    {
      title: 'Meus Pedidos',
      subtitle: 'Acompanhe seus pedidos',
      icon: 'list',
      color: '#FF9500',
      onPress: () => router.push('/(tabs)/orders')
    },
    {
      title: 'Ajuda',
      subtitle: 'Precisa de suporte?',
      icon: 'help-circle',
      color: '#AF52DE',
      onPress: () => {}
    }
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Olá,</Text>
            <Text style={styles.userName}>{user?.name}</Text>
          </View>
          <Ionicons name="notifications-outline" size={24} color="#000" />
        </View>

        <View style={styles.content}>
          <Text style={styles.sectionTitle}>O que deseja fazer?</Text>
          
          <View style={styles.menuGrid}>
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.menuCard}
                onPress={item.onPress}
              >
                <View style={[styles.iconContainer, { backgroundColor: item.color + '20' }]}>
                  <Ionicons name={item.icon as any} size={32} color={item.color} />
                </View>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </TouchableOpacity>
            ))}
          </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff'
  },
  greeting: {
    fontSize: 16,
    color: '#666'
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000'
  },
  content: {
    padding: 20
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#000'
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16
  },
  menuCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '47%',
    alignItems: 'center'
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4
  },
  menuSubtitle: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center'
  }
});