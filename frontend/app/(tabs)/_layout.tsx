import React, { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Pressable } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';

export default function TabsLayout() {
  const { updateActivity } = useAuth();

  // Atualizar atividade quando o usuário interage com as tabs
  const handleTabPress = () => {
    updateActivity();
  };

  return (
    <View style={{ flex: 1 }} onTouchStart={updateActivity}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#007AFF',
          tabBarInactiveTintColor: '#999',
          tabBarStyle: {
            borderTopWidth: 1,
            borderTopColor: '#E0E0E0',
            paddingBottom: 8,
            paddingTop: 8,
            height: 60
          }
        }}
        screenListeners={{
          tabPress: handleTabPress
        }}
      >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          )
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: 'Produtos',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid" size={size} color={color} />
          )
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Carrinho',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cart" size={size} color={color} />
          )
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Pedidos',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list" size={size} color={color} />
          )
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          )
        }}
      />
      </Tabs>
    </View>
  );
}