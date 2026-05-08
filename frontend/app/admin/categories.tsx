import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Alert, ActivityIndicator, Modal, Platform, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { BACKEND_URL } from '../../config';

interface Category {
  id: string;
  name: string;
  icon: string;
  order: number;
  active: boolean;
}

export default function CategoriesManagement() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState({ name: '', icon: '📦', order: 0 });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/categories`);
      setCategories(response.data);
    } catch (error) {
      if (Platform.OS === 'web') {
        window.alert('Não foi possível carregar as categorias');
      } else {
        Alert.alert('Erro', 'Não foi possível carregar as categorias');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name) {
      if (Platform.OS === 'web') {
        window.alert('Digite o nome da categoria');
      } else {
        Alert.alert('Erro', 'Digite o nome da categoria');
      }
      return;
    }

    try {
      if (editingCategory) {
        await axios.put(`${BACKEND_URL}/api/categories/${editingCategory.id}`, {
          ...formData,
          active: true
        });
        if (Platform.OS === 'web') {
          window.alert('Categoria atualizada!');
        } else {
          Alert.alert('Sucesso', 'Categoria atualizada!');
        }
      } else {
        await axios.post(`${BACKEND_URL}/api/categories`, {
          ...formData,
          active: true
        });
        if (Platform.OS === 'web') {
          window.alert('Categoria criada!');
        } else {
          Alert.alert('Sucesso', 'Categoria criada!');
        }
      }
      setModalVisible(false);
      setEditingCategory(null);
      setFormData({ name: '', icon: '📦', order: 0 });
      loadCategories();
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || 'Erro ao salvar categoria';
      if (Platform.OS === 'web') {
        window.alert(errorMsg);
      } else {
        Alert.alert('Erro', errorMsg);
      }
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({ name: category.name, icon: category.icon, order: category.order });
    setModalVisible(true);
  };

  const handleDelete = (category: Category) => {
    setCategoryToDelete(category);
    setDeleteModalVisible(true);
  };

  const confirmDelete = async () => {
    if (!categoryToDelete) return;
    
    setDeleting(true);
    try {
      await axios.delete(`${BACKEND_URL}/api/categories/${categoryToDelete.id}`);
      setDeleteModalVisible(false);
      setCategoryToDelete(null);
      if (Platform.OS === 'web') {
        window.alert('Categoria excluída com sucesso!');
      } else {
        Alert.alert('Sucesso', 'Categoria excluída!');
      }
      loadCategories();
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || 'Erro ao excluir categoria';
      if (Platform.OS === 'web') {
        window.alert(errorMsg);
      } else {
        Alert.alert('Erro', errorMsg);
      }
    } finally {
      setDeleting(false);
    }
  };

  const commonIcons = ['📱', '💳', '🔥', '⭐', '🎮', '📺', '🎵', '📦', '🛒', '💰'];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>Gerenciar Categorias</Text>
        <TouchableOpacity onPress={() => {
          setEditingCategory(null);
          setFormData({ name: '', icon: '📦', order: categories.length });
          setModalVisible(true);
        }}>
          <Ionicons name="add-circle" size={28} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <ScrollView style={styles.content}>
          {categories.map((category) => (
            <View key={category.id} style={styles.categoryCard}>
              <View style={styles.categoryInfo}>
                <Text style={styles.categoryIcon}>{category.icon}</Text>
                <View style={styles.categoryDetails}>
                  <Text style={styles.categoryName}>{category.name}</Text>
                  <Text style={styles.categoryOrder}>Ordem: {category.order}</Text>
                </View>
              </View>
              <View style={styles.actions}>
                <Pressable 
                  onPress={() => handleEdit(category)} 
                  style={styles.actionButton}
                  accessibilityLabel={`Editar ${category.name}`}
                >
                  <Ionicons name="pencil" size={20} color="#007AFF" />
                </Pressable>
                <Pressable 
                  onPress={() => handleDelete(category)} 
                  style={styles.actionButton}
                  accessibilityLabel={`Excluir ${category.name}`}
                >
                  <Ionicons name="trash" size={20} color="#FF3B30" />
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Modal de Edição/Criação */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Nome *</Text>
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder="Nome da categoria"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Ícone</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.iconsContainer}>
                  {commonIcons.map((icon) => (
                    <TouchableOpacity
                      key={icon}
                      style={[
                        styles.iconOption,
                        formData.icon === icon && styles.iconOptionSelected
                      ]}
                      onPress={() => setFormData({ ...formData, icon })}
                    >
                      <Text style={styles.iconOptionText}>{icon}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Ordem</Text>
              <TextInput
                style={styles.input}
                value={formData.order.toString()}
                onChangeText={(text) => setFormData({ ...formData, order: parseInt(text) || 0 })}
                keyboardType="numeric"
                placeholder="0"
              />
            </View>

            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>Salvar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de Confirmação de Exclusão */}
      <Modal
        visible={deleteModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModalContent}>
            <View style={styles.deleteModalIcon}>
              <Ionicons name="warning" size={40} color="#FF3B30" />
            </View>
            <Text style={styles.deleteModalTitle}>Excluir Categoria</Text>
            <Text style={styles.deleteModalMessage}>
              Deseja realmente excluir "{categoryToDelete?.icon} {categoryToDelete?.name}"?
            </Text>
            <Text style={styles.deleteModalWarning}>
              Esta ação não pode ser desfeita.
            </Text>
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity 
                style={styles.deleteModalCancelButton}
                onPress={() => {
                  setDeleteModalVisible(false);
                  setCategoryToDelete(null);
                }}
                disabled={deleting}
              >
                <Text style={styles.deleteModalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.deleteModalConfirmButton, deleting && styles.deleteModalButtonDisabled]}
                onPress={confirmDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.deleteModalConfirmText}>Excluir</Text>
                )}
              </TouchableOpacity>
            </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0'
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  content: {
    flex: 1,
    padding: 16
  },
  categoryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  categoryIcon: {
    fontSize: 32,
    marginRight: 12
  },
  categoryDetails: {
    flex: 1
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4
  },
  categoryOrder: {
    fontSize: 12,
    color: '#666'
  },
  actions: {
    flexDirection: 'row',
    gap: 12
  },
  actionButton: {
    padding: 8
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000'
  },
  formGroup: {
    marginBottom: 20
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16
  },
  iconsContainer: {
    flexDirection: 'row',
    gap: 8
  },
  iconOption: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent'
  },
  iconOptionSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#007AFF20'
  },
  iconOptionText: {
    fontSize: 24
  },
  saveButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center'
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  // Estilos do Modal de Exclusão
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  deleteModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center'
  },
  deleteModalIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FF3B3015',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16
  },
  deleteModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8
  },
  deleteModalMessage: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 8
  },
  deleteModalWarning: {
    fontSize: 14,
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 24
  },
  deleteModalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%'
  },
  deleteModalCancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    alignItems: 'center'
  },
  deleteModalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666'
  },
  deleteModalConfirmButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#FF3B30',
    alignItems: 'center'
  },
  deleteModalConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff'
  },
  deleteModalButtonDisabled: {
    opacity: 0.6
  }
});
