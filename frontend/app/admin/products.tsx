import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Alert, ActivityIndicator, Modal, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { BACKEND_URL } from '../../config';

interface Category {
  id: string;
  name: string;
  icon: string;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category_id: string;
  type: string;
  required_fields: string[];
  discount_rules: Array<{ min_quantity: number; discount_percent: number }>;
  active: boolean;
}

const AVAILABLE_FIELDS = ['MAC', 'CHAVE OTP', 'E-mail', 'Senha do app', 'Device ID', 'Usuário', 'Login'];

export default function ProductsManagement() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category_id: '',
    type: 'activation',
    required_fields: [] as string[],
    discount_rules: [] as Array<{ min_quantity: number; discount_percent: number }>,
    active: true
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [productsRes, categoriesRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/products`),
        axios.get(`${BACKEND_URL}/api/categories`)
      ]);
      setProducts(productsRes.data);
      setCategories(categoriesRes.data);
      if (categoriesRes.data.length > 0 && !formData.category_id) {
        setFormData(prev => ({ ...prev, category_id: categoriesRes.data[0].id }));
      }
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível carregar os dados');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.price || !formData.category_id) {
      Alert.alert('Erro', 'Preencha todos os campos obrigatórios');
      return;
    }

    try {
      const payload = {
        ...formData,
        price: parseFloat(formData.price),
        active: true
      };

      if (editingProduct) {
        await axios.put(`${BACKEND_URL}/api/products/${editingProduct.id}`, payload);
        Alert.alert('Sucesso', 'Produto atualizado!');
      } else {
        await axios.post(`${BACKEND_URL}/api/products`, payload);
        Alert.alert('Sucesso', 'Produto criado!');
      }
      setModalVisible(false);
      resetForm();
      loadData();
    } catch (error: any) {
      Alert.alert('Erro', error.response?.data?.detail || 'Erro ao salvar produto');
    }
  };

  const resetForm = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      description: '',
      price: '',
      category_id: categories[0]?.id || '',
      type: 'activation',
      required_fields: [],
      discount_rules: [],
      active: true
    });
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description,
      price: product.price.toString(),
      category_id: product.category_id,
      type: product.type,
      required_fields: product.required_fields || [],
      discount_rules: product.discount_rules || [],
      active: product.active
    });
    setModalVisible(true);
  };

  const handleDelete = (product: Product) => {
    Alert.alert(
      'Excluir Produto',
      `Deseja excluir "${product.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(`${BACKEND_URL}/api/products/${product.id}`);
              Alert.alert('Sucesso', 'Produto excluído!');
              loadData();
            } catch (error: any) {
              Alert.alert('Erro', error.response?.data?.detail || 'Erro ao excluir produto');
            }
          }
        }
      ]
    );
  };

  const toggleField = (field: string) => {
    setFormData(prev => ({
      ...prev,
      required_fields: prev.required_fields.includes(field)
        ? prev.required_fields.filter(f => f !== field)
        : [...prev.required_fields, field]
    }));
  };

  const getCategoryName = (categoryId: string) => {
    return categories.find(c => c.id === categoryId)?.name || 'N/A';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>Gerenciar Produtos</Text>
        <TouchableOpacity onPress={() => {
          resetForm();
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
          {products.map((product) => (
            <View key={product.id} style={styles.productCard}>
              <View style={styles.productInfo}>
                <Text style={styles.productName}>{product.name}</Text>
                <Text style={styles.productCategory}>{getCategoryName(product.category_id)}</Text>
                <Text style={styles.productPrice}>R$ {product.price.toFixed(2)}</Text>
                {product.required_fields && product.required_fields.length > 0 && (
                  <Text style={styles.productFields}>
                    Campos: {product.required_fields.join(', ')}
                  </Text>
                )}
              </View>
              <View style={styles.actions}>
                <TouchableOpacity onPress={() => handleEdit(product)} style={styles.actionButton}>
                  <Ionicons name="pencil" size={20} color="#007AFF" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(product)} style={styles.actionButton}>
                  <Ionicons name="trash" size={20} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

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
                {editingProduct ? 'Editar Produto' : 'Novo Produto'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Nome *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                  placeholder="Nome do produto"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Descrição</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.description}
                  onChangeText={(text) => setFormData({ ...formData, description: text })}
                  placeholder="Descrição do produto"
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Preço (R$) *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.price}
                  onChangeText={(text) => setFormData({ ...formData, price: text })}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Categoria *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.categoryOptions}>
                    {categories.map((category) => (
                      <TouchableOpacity
                        key={category.id}
                        style={[
                          styles.categoryOption,
                          formData.category_id === category.id && styles.categoryOptionSelected
                        ]}
                        onPress={() => setFormData({ ...formData, category_id: category.id })}
                      >
                        <Text style={styles.categoryOptionIcon}>{category.icon}</Text>
                        <Text style={styles.categoryOptionText}>{category.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Tipo</Text>
                <View style={styles.typeOptions}>
                  <TouchableOpacity
                    style={[
                      styles.typeOption,
                      formData.type === 'activation' && styles.typeOptionSelected
                    ]}
                    onPress={() => setFormData({ ...formData, type: 'activation' })}
                  >
                    <Text style={[
                      styles.typeOptionText,
                      formData.type === 'activation' && styles.typeOptionTextSelected
                    ]}>
                      Ativação
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.typeOption,
                      formData.type === 'credits' && styles.typeOptionSelected
                    ]}
                    onPress={() => setFormData({ ...formData, type: 'credits' })}
                  >
                    <Text style={[
                      styles.typeOptionText,
                      formData.type === 'credits' && styles.typeOptionTextSelected
                    ]}>
                      Créditos
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {formData.type === 'activation' && (
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Campos Obrigatórios</Text>
                  <Text style={styles.hint}>Selecione os campos que o cliente deve preencher</Text>
                  {AVAILABLE_FIELDS.map((field) => (
                    <TouchableOpacity
                      key={field}
                      style={styles.fieldOption}
                      onPress={() => toggleField(field)}
                    >
                      <View style={styles.fieldOptionLeft}>
                        <View style={[
                          styles.checkbox,
                          formData.required_fields.includes(field) && styles.checkboxChecked
                        ]}>
                          {formData.required_fields.includes(field) && (
                            <Ionicons name="checkmark" size={16} color="#fff" />
                          )}
                        </View>
                        <Text style={styles.fieldOptionText}>{field}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveButtonText}>Salvar Produto</Text>
              </TouchableOpacity>
            </ScrollView>
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
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between'
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
  productCategory: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4
  },
  productPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4
  },
  productFields: {
    fontSize: 11,
    color: '#999',
    marginTop: 4
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
    maxHeight: '90%'
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
  hint: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top'
  },
  categoryOptions: {
    flexDirection: 'row',
    gap: 12
  },
  categoryOption: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    minWidth: 80
  },
  categoryOptionSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#007AFF20'
  },
  categoryOptionIcon: {
    fontSize: 24,
    marginBottom: 4
  },
  categoryOptionText: {
    fontSize: 12,
    color: '#666'
  },
  typeOptions: {
    flexDirection: 'row',
    gap: 12
  },
  typeOption: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    alignItems: 'center'
  },
  typeOptionSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#007AFF'
  },
  typeOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666'
  },
  typeOptionTextSelected: {
    color: '#fff'
  },
  fieldOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0'
  },
  fieldOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center'
  },
  checkboxChecked: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF'
  },
  fieldOptionText: {
    fontSize: 15,
    color: '#000'
  },
  saveButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  }
});
