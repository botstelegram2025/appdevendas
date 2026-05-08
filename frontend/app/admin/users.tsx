import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  RefreshControl,
  Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { BACKEND_URL } from '../../config';
import { useAuth } from '../../contexts/AuthContext';

interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  cpf: string;
  created_at: string;
  subscription_status: string;
  subscription_expires_at: string | null;
  notes: string;
  orders_count: number;
  paid_orders: number;
  total_spent: number;
  last_order: string | null;
}

interface UserStats {
  total: number;
  by_status: {
    trial: number;
    active: number;
    expired: number;
    suspended: number;
  };
  new_this_month: number;
  expiring_soon: number;
}

const STATUS_CONFIG = {
  trial: { label: 'Trial', color: '#FF9500', bgColor: '#FFF3E0', icon: 'time-outline' },
  active: { label: 'Ativo', color: '#34C759', bgColor: '#E8F5E9', icon: 'checkmark-circle-outline' },
  expired: { label: 'Expirado', color: '#FF3B30', bgColor: '#FFEBEE', icon: 'alert-circle-outline' },
  suspended: { label: 'Suspenso', color: '#8E8E93', bgColor: '#F5F5F5', icon: 'ban-outline' }
};

export default function UsersManagement() {
  const router = useRouter();
  const { adminToken } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editStatus, setEditStatus] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editExpires, setEditExpires] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToAction, setUserToAction] = useState<User | null>(null);

  const headers = {
    'Authorization': `Bearer ${adminToken}`
  };

  useEffect(() => {
    loadData();
  }, [filterStatus]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersRes, statsRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/admin/users`, {
          headers,
          params: { status: filterStatus !== 'all' ? filterStatus : undefined }
        }),
        axios.get(`${BACKEND_URL}/api/admin/users/stats`, { headers })
      ]);
      setUsers(usersRes.data);
      setStats(statsRes.data);
    } catch (error: any) {
      console.error('Erro ao carregar usuários:', error);
      if (error.response?.status === 403) {
        Alert.alert('Acesso Negado', 'Você não tem permissão para acessar esta área.');
        router.back();
      } else {
        Alert.alert('Erro', 'Não foi possível carregar os usuários');
      }
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [filterStatus]);

  const searchUsers = async () => {
    if (!searchQuery.trim()) {
      loadData();
      return;
    }
    
    try {
      setLoading(true);
      const response = await axios.get(`${BACKEND_URL}/api/admin/users`, {
        headers,
        params: { search: searchQuery }
      });
      setUsers(response.data);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível buscar usuários');
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setEditStatus(user.subscription_status);
    setEditNotes(user.notes || '');
    setEditExpires(user.subscription_expires_at ? user.subscription_expires_at.split('T')[0] : '');
    setShowEditModal(true);
  };

  const saveUserChanges = async () => {
    if (!selectedUser) return;
    
    setSaving(true);
    try {
      await axios.put(
        `${BACKEND_URL}/api/admin/users/${selectedUser.id}/subscription`,
        {
          subscription_status: editStatus,
          subscription_expires_at: editExpires ? new Date(editExpires).toISOString() : null,
          notes: editNotes
        },
        { headers }
      );
      
      Alert.alert('Sucesso', 'Usuário atualizado com sucesso!');
      setShowEditModal(false);
      loadData();
    } catch (error: any) {
      Alert.alert('Erro', error.response?.data?.detail || 'Erro ao atualizar usuário');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  };

  const formatCurrency = (value: number) => {
    return `R$ ${value.toFixed(2)}`;
  };

  const getStatusConfig = (status: string) => {
    return STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.trial;
  };

  const filteredUsers = users.filter(user => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.name.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      user.phone?.includes(query) ||
      user.cpf?.includes(query)
    );
  });

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Carregando usuários...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Gerenciar Usuários</Text>
          <Text style={styles.headerSubtitle}>{stats?.total || 0} usuários cadastrados</Text>
        </View>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Stats Cards */}
        {stats && (
          <View style={styles.statsContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity 
                style={[styles.statCard, filterStatus === 'all' && styles.statCardActive]}
                onPress={() => setFilterStatus('all')}
              >
                <Ionicons name="people" size={24} color="#007AFF" />
                <Text style={styles.statValue}>{stats.total}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.statCard, filterStatus === 'trial' && styles.statCardActive]}
                onPress={() => setFilterStatus('trial')}
              >
                <Ionicons name="time-outline" size={24} color="#FF9500" />
                <Text style={styles.statValue}>{stats.by_status.trial}</Text>
                <Text style={styles.statLabel}>Trial</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.statCard, filterStatus === 'active' && styles.statCardActive]}
                onPress={() => setFilterStatus('active')}
              >
                <Ionicons name="checkmark-circle-outline" size={24} color="#34C759" />
                <Text style={styles.statValue}>{stats.by_status.active}</Text>
                <Text style={styles.statLabel}>Ativos</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.statCard, filterStatus === 'expired' && styles.statCardActive]}
                onPress={() => setFilterStatus('expired')}
              >
                <Ionicons name="alert-circle-outline" size={24} color="#FF3B30" />
                <Text style={styles.statValue}>{stats.by_status.expired}</Text>
                <Text style={styles.statLabel}>Expirados</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.statCard, filterStatus === 'suspended' && styles.statCardActive]}
                onPress={() => setFilterStatus('suspended')}
              >
                <Ionicons name="ban-outline" size={24} color="#8E8E93" />
                <Text style={styles.statValue}>{stats.by_status.suspended}</Text>
                <Text style={styles.statLabel}>Suspensos</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        {/* Alert Cards */}
        {stats && (stats.expiring_soon > 0 || stats.new_this_month > 0) && (
          <View style={styles.alertsContainer}>
            {stats.expiring_soon > 0 && (
              <View style={styles.alertCard}>
                <Ionicons name="warning-outline" size={20} color="#FF9500" />
                <Text style={styles.alertText}>
                  {stats.expiring_soon} usuário(s) expirando em 7 dias
                </Text>
              </View>
            )}
            {stats.new_this_month > 0 && (
              <View style={[styles.alertCard, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="trending-up" size={20} color="#34C759" />
                <Text style={[styles.alertText, { color: '#34C759' }]}>
                  {stats.new_this_month} novo(s) este mês
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color="#999" />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por nome, email, telefone ou CPF..."
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={searchUsers}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => { setSearchQuery(''); loadData(); }}>
                <Ionicons name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Users List */}
        <View style={styles.usersListContainer}>
          {filteredUsers.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={64} color="#CCC" />
              <Text style={styles.emptyStateText}>Nenhum usuário encontrado</Text>
            </View>
          ) : (
            filteredUsers.map(user => {
              const statusConfig = getStatusConfig(user.subscription_status);
              return (
                <TouchableOpacity
                  key={user.id}
                  style={styles.userCard}
                  onPress={() => openEditModal(user)}
                >
                  <View style={styles.userCardHeader}>
                    <View style={styles.userAvatar}>
                      <Text style={styles.userAvatarText}>
                        {user.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>{user.name}</Text>
                      <Text style={styles.userContact}>{user.phone || user.email || '-'}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
                      <Ionicons 
                        name={statusConfig.icon as any} 
                        size={14} 
                        color={statusConfig.color} 
                      />
                      <Text style={[styles.statusText, { color: statusConfig.color }]}>
                        {statusConfig.label}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.userCardBody}>
                    <View style={styles.userStat}>
                      <Text style={styles.userStatLabel}>Pedidos</Text>
                      <Text style={styles.userStatValue}>{user.paid_orders}/{user.orders_count}</Text>
                    </View>
                    <View style={styles.userStat}>
                      <Text style={styles.userStatLabel}>Total Gasto</Text>
                      <Text style={styles.userStatValue}>{formatCurrency(user.total_spent)}</Text>
                    </View>
                    <View style={styles.userStat}>
                      <Text style={styles.userStatLabel}>Cadastro</Text>
                      <Text style={styles.userStatValue}>{formatDate(user.created_at)}</Text>
                    </View>
                  </View>
                  
                  {user.subscription_expires_at && (
                    <View style={styles.expiresInfo}>
                      <Ionicons name="calendar-outline" size={14} color="#666" />
                      <Text style={styles.expiresText}>
                        Expira em: {formatDate(user.subscription_expires_at)}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Edit Modal */}
      <Modal
        visible={showEditModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar Usuário</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {selectedUser && (
              <ScrollView style={styles.modalBody}>
                {/* User Info */}
                <View style={styles.modalUserInfo}>
                  <View style={styles.modalAvatar}>
                    <Text style={styles.modalAvatarText}>
                      {selectedUser.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.modalUserName}>{selectedUser.name}</Text>
                  <Text style={styles.modalUserContact}>{selectedUser.phone}</Text>
                  <Text style={styles.modalUserContact}>{selectedUser.email || '-'}</Text>
                  <Text style={styles.modalUserContact}>CPF: {selectedUser.cpf}</Text>
                </View>

                {/* Status Selection */}
                <Text style={styles.inputLabel}>Status da Assinatura</Text>
                <View style={styles.statusOptions}>
                  {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                    <TouchableOpacity
                      key={key}
                      style={[
                        styles.statusOption,
                        editStatus === key && { borderColor: config.color, backgroundColor: config.bgColor }
                      ]}
                      onPress={() => setEditStatus(key)}
                    >
                      <Ionicons name={config.icon as any} size={20} color={config.color} />
                      <Text style={[styles.statusOptionText, { color: config.color }]}>
                        {config.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Expiration Date */}
                <Text style={styles.inputLabel}>Data de Expiração</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="AAAA-MM-DD (ex: 2025-12-31)"
                  placeholderTextColor="#999"
                  value={editExpires}
                  onChangeText={setEditExpires}
                />

                {/* Notes */}
                <Text style={styles.inputLabel}>Observações</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  placeholder="Adicione observações sobre o usuário..."
                  placeholderTextColor="#999"
                  value={editNotes}
                  onChangeText={setEditNotes}
                  multiline
                  numberOfLines={3}
                />

                {/* Actions */}
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setShowEditModal(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancelar</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                    onPress={saveUserChanges}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="checkmark" size={20} color="#fff" />
                        <Text style={styles.saveButtonText}>Salvar</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0'
  },
  backButton: {
    padding: 8
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 8
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000'
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2
  },
  refreshButton: {
    padding: 8
  },
  content: {
    flex: 1
  },
  statsContainer: {
    padding: 16,
    paddingBottom: 8
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    alignItems: 'center',
    minWidth: 90,
    borderWidth: 2,
    borderColor: 'transparent'
  },
  statCardActive: {
    borderColor: '#007AFF'
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginTop: 8
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4
  },
  alertsContainer: {
    paddingHorizontal: 16,
    gap: 8
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    gap: 8
  },
  alertText: {
    fontSize: 13,
    color: '#FF9500',
    flex: 1
  },
  searchContainer: {
    padding: 16
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    gap: 12
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 14,
    color: '#000'
  },
  usersListContainer: {
    paddingHorizontal: 16,
    paddingBottom: 32
  },
  emptyState: {
    alignItems: 'center',
    padding: 40
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16
  },
  userCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12
  },
  userCardHeader: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center'
  },
  userAvatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff'
  },
  userInfo: {
    flex: 1,
    marginLeft: 12
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000'
  },
  userContact: {
    fontSize: 13,
    color: '#666',
    marginTop: 2
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600'
  },
  userCardBody: {
    flexDirection: 'row',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0'
  },
  userStat: {
    flex: 1,
    alignItems: 'center'
  },
  userStatLabel: {
    fontSize: 11,
    color: '#999'
  },
  userStatValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginTop: 4
  },
  expiresInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    gap: 6
  },
  expiresText: {
    fontSize: 12,
    color: '#666'
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0'
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000'
  },
  modalBody: {
    padding: 20
  },
  modalUserInfo: {
    alignItems: 'center',
    marginBottom: 24
  },
  modalAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12
  },
  modalAvatarText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff'
  },
  modalUserName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000'
  },
  modalUserContact: {
    fontSize: 14,
    color: '#666',
    marginTop: 4
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 16
  },
  statusOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    gap: 6
  },
  statusOptionText: {
    fontSize: 13,
    fontWeight: '600'
  },
  textInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 14,
    fontSize: 14,
    color: '#000'
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top'
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 32
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center'
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666'
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  saveButtonDisabled: {
    opacity: 0.7
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff'
  }
});
