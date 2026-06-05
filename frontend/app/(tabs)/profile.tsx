import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function Profile() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      router.replace('/auth/welcome');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  const menuItems = [
    {
      icon: 'person-outline',
      label: 'Editar Perfil',
      onPress: () => router.push('/edit-profile'),
      gradient: ['#6366F1', '#8B5CF6']
    },
    {
      icon: 'lock-closed-outline',
      label: 'Alterar Senha',
      onPress: () => {},
      gradient: ['#F59E0B', '#FBBF24']
    },
    {
      icon: 'help-circle-outline',
      label: 'Ajuda e Suporte',
      onPress: () => {},
      gradient: ['#10B981', '#34D399']
    }
  ];

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#1E1E2E', '#2D2D44']} style={styles.header}>
        <Text style={styles.title}>Perfil</Text>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#2D2D44', '#1E1E2E']} style={styles.profileCard}>
          <LinearGradient
            colors={['#6366F1', '#8B5CF6']}
            style={styles.avatarContainer}
          >
            <Ionicons name="person" size={40} color="#fff" />
          </LinearGradient>
          <Text style={styles.userName}>{user?.name || 'Usuário'}</Text>
          <Text style={styles.userPhone}>{user?.phone}</Text>
          {user?.email && <Text style={styles.userEmail}>{user.email}</Text>}
        </LinearGradient>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Configurações</Text>
          
          {menuItems.map((item, index) => (
            <TouchableOpacity 
              key={index}
              style={styles.menuItem}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['#2D2D44', '#1E1E2E']}
                style={styles.menuItemGradient}
              >
                <LinearGradient
                  colors={item.gradient}
                  style={styles.menuIconContainer}
                >
                  <Ionicons name={item.icon as any} size={20} color="#fff" />
                </LinearGradient>
                <Text style={styles.menuItemText}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={20} color="#6B7280" />
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LinearGradient
            colors={['rgba(239, 68, 68, 0.15)', 'rgba(239, 68, 68, 0.05)']}
            style={styles.logoutButtonGradient}
          >
            <Ionicons name="log-out-outline" size={24} color="#EF4444" />
            <Text style={styles.logoutText}>Sair da Conta</Text>
          </LinearGradient>
        </TouchableOpacity>

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
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff'
  },
  content: {
    flex: 1,
    padding: 16
  },
  profileCard: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4
  },
  userPhone: {
    fontSize: 14,
    color: '#9CA3AF'
  },
  userEmail: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4
  },
  section: {
    marginBottom: 24
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: 12,
    paddingHorizontal: 4
  },
  menuItem: {
    marginBottom: 8,
    borderRadius: 14,
    overflow: 'hidden'
  },
  menuItemGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    color: '#E5E7EB',
    fontWeight: '500'
  },
  logoutButton: {
    borderRadius: 14,
    overflow: 'hidden'
  },
  logoutButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    gap: 10
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444'
  }
});
