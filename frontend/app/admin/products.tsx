import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Alert, ActivityIndicator, Modal, Switch, Platform, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
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
  image_url?: string;
  links?: Array<{ title: string; url: string; visibility: 'admin_only' | 'all' }>;
}

interface ProductLink {
  title: string;
  url: string;
  visibility: 'admin_only' | 'all';
}

const AVAILABLE_FIELDS = ['MAC', 'CHAVE OTP', 'E-mail', 'Senha do app', 'Device ID', 'Usuário', 'Login'];

export default function ProductsManagement() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category_id: '',
    type: 'activation',
    required_fields: [] as string[],
    discount_rules: [] as Array<{ min_quantity: number; discount_percent: number }>,
    active: true,
    image_url: '',
    links: [] as ProductLink[]
  });
  const [imageUri, setImageUri] = useState<string | null>(null);
  
  // Estados para gerenciar links
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [newLink, setNewLink] = useState<ProductLink>({ title: '', url: '', visibility: 'all' });

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
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.price),
        category_id: formData.category_id,
        type: formData.type,
        required_fields: formData.required_fields,
        discount_rules: formData.discount_rules,
        active: true,
        image: formData.image_url || null,
        links: formData.links || []
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
    setImageUri(null);
    setNewLink({ title: '', url: '', visibility: 'all' });
    setFormData({
      name: '',
      description: '',
      price: '',
      category_id: categories[0]?.id || '',
      type: 'activation',
      required_fields: [],
      discount_rules: [],
      active: true,
      image_url: '',
      links: []
    });
  };

  const pickImage = async () => {
    try {
      // Solicitar permissão
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Precisamos de acesso à galeria para selecionar imagens.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setImageUri(asset.uri);
        if (asset.base64) {
          setFormData(prev => ({
            ...prev,
            image_url: `data:image/jpeg;base64,${asset.base64}`
          }));
        }
      }
    } catch (error) {
      console.error('Erro ao selecionar imagem:', error);
      Alert.alert('Erro', 'Não foi possível selecionar a imagem');
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setImageUri(product.image_url || null);
    setFormData({
      name: product.name,
      description: product.description,
      price: product.price.toString(),
      category_id: product.category_id,
      type: product.type,
      required_fields: product.required_fields || [],
      discount_rules: product.discount_rules || [],
      active: product.active,
      image_url: product.image_url || '',
      links: product.links || []
    });
    setModalVisible(true);
  };

  // Funções para gerenciar links
  const addLink = () => {
    if (!newLink.title || !newLink.url) {
      Alert.alert('Erro', 'Preencha o título e URL do link');
      return;
    }
    setFormData(prev => ({
      ...prev,
      links: [...prev.links, { ...newLink }]
    }));
    setNewLink({ title: '', url: '', visibility: 'all' });
    setShowLinkModal(false);
  };

  const removeLink = (index: number) => {
    setFormData(prev => ({
      ...prev,
      links: prev.links.filter((_, i) => i !== index)
    }));
  };

  const handleDelete = (product: Product) => {
    setProductToDelete(product);
    setDeleteModalVisible(true);
  };

  const confirmDelete = async () => {
    if (!productToDelete) return;
    
    setDeleting(true);
    try {
      await axios.delete(`${BACKEND_URL}/api/products/${productToDelete.id}`);
      setDeleteModalVisible(false);
      setProductToDelete(null);
      if (Platform.OS === 'web') {
        window.alert('Produto excluído com sucesso!');
      } else {
        Alert.alert('Sucesso', 'Produto excluído!');
      }
      loadData();
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || 'Erro ao excluir produto';
      if (Platform.OS === 'web') {
        window.alert(errorMsg);
      } else {
        Alert.alert('Erro', errorMsg);
      }
    } finally {
      setDeleting(false);
    }
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
                <Pressable 
                  onPress={() => handleEdit(product)} 
                  style={styles.actionButton}
                  accessibilityLabel="Editar produto"
                >
                  <Ionicons name="pencil" size={20} color="#007AFF" />
                </Pressable>
                <Pressable 
                  onPress={() => handleDelete(product)} 
                  style={styles.actionButton}
                  accessibilityLabel={`Excluir ${product.name}`}
                >
                  <Ionicons name="trash" size={20} color="#FF3B30" />
                </Pressable>
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
              {/* Seção de Imagem */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Imagem do Produto</Text>
                <TouchableOpacity style={styles.imagePickerContainer} onPress={pickImage}>
                  {imageUri || formData.image_url ? (
                    <Image 
                      source={{ uri: imageUri || formData.image_url }} 
                      style={styles.productImagePreview} 
                    />
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <Ionicons name="image" size={48} color="#999" />
                      <Text style={styles.imagePlaceholderText}>Toque para adicionar imagem</Text>
                    </View>
                  )}
                  <View style={styles.imagePickerOverlay}>
                    <Ionicons name="camera" size={24} color="#fff" />
                  </View>
                </TouchableOpacity>
                {(imageUri || formData.image_url) && (
                  <TouchableOpacity 
                    style={styles.removeImageButton}
                    onPress={() => {
                      setImageUri(null);
                      setFormData(prev => ({ ...prev, image_url: '' }));
                    }}
                  >
                    <Ionicons name="trash" size={16} color="#FF3B30" />
                    <Text style={styles.removeImageText}>Remover imagem</Text>
                  </TouchableOpacity>
                )}
              </View>

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

              {/* Seção de Links */}
              <View style={styles.formGroup}>
                <View style={styles.linksSectionHeader}>
                  <Text style={styles.label}>Links do Produto</Text>
                  <TouchableOpacity 
                    style={styles.addLinkButton}
                    onPress={() => setShowLinkModal(true)}
                  >
                    <Ionicons name="add-circle" size={24} color="#007AFF" />
                    <Text style={styles.addLinkButtonText}>Adicionar Link</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.hint}>Links vinculados ao produto (ex: downloads, manuais)</Text>
                
                {formData.links.length === 0 ? (
                  <View style={styles.noLinksContainer}>
                    <Ionicons name="link-outline" size={32} color="#CCC" />
                    <Text style={styles.noLinksText}>Nenhum link adicionado</Text>
                  </View>
                ) : (
                  <View style={styles.linksList}>
                    {formData.links.map((link, index) => (
                      <View key={index} style={styles.linkItem}>
                        <View style={styles.linkItemContent}>
                          <View style={styles.linkItemHeader}>
                            <Ionicons name="link" size={16} color="#007AFF" />
                            <Text style={styles.linkTitle}>{link.title}</Text>
                            <View style={[
                              styles.visibilityBadge,
                              link.visibility === 'admin_only' ? styles.visibilityAdmin : styles.visibilityAll
                            ]}>
                              <Ionicons 
                                name={link.visibility === 'admin_only' ? 'lock-closed' : 'globe'} 
                                size={12} 
                                color={link.visibility === 'admin_only' ? '#FF9500' : '#34C759'} 
                              />
                              <Text style={[
                                styles.visibilityText,
                                link.visibility === 'admin_only' ? styles.visibilityTextAdmin : styles.visibilityTextAll
                              ]}>
                                {link.visibility === 'admin_only' ? 'Admin' : 'Todos'}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.linkUrl} numberOfLines={1}>{link.url}</Text>
                        </View>
                        <TouchableOpacity 
                          style={styles.removeLinkButton}
                          onPress={() => removeLink(index)}
                        >
                          <Ionicons name="trash" size={18} color="#FF3B30" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveButtonText}>Salvar Produto</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal para adicionar link */}
      <Modal
        visible={showLinkModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowLinkModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.linkModalContainer}>
            <View style={styles.linkModalHeader}>
              <Text style={styles.linkModalTitle}>Adicionar Link</Text>
              <TouchableOpacity onPress={() => setShowLinkModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Título do Link *</Text>
              <TextInput
                style={styles.input}
                value={newLink.title}
                onChangeText={(text) => setNewLink(prev => ({ ...prev, title: text }))}
                placeholder="Ex: Manual de Instalação"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>URL *</Text>
              <TextInput
                style={styles.input}
                value={newLink.url}
                onChangeText={(text) => setNewLink(prev => ({ ...prev, url: text }))}
                placeholder="https://..."
                keyboardType="url"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Visibilidade</Text>
              <View style={styles.visibilityOptions}>
                <TouchableOpacity
                  style={[
                    styles.visibilityOption,
                    newLink.visibility === 'all' && styles.visibilityOptionSelected
                  ]}
                  onPress={() => setNewLink(prev => ({ ...prev, visibility: 'all' }))}
                >
                  <Ionicons name="globe" size={20} color={newLink.visibility === 'all' ? '#34C759' : '#666'} />
                  <Text style={[
                    styles.visibilityOptionText,
                    newLink.visibility === 'all' && styles.visibilityOptionTextSelected
                  ]}>
                    Admin e Usuário
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.visibilityOption,
                    newLink.visibility === 'admin_only' && styles.visibilityOptionSelectedAdmin
                  ]}
                  onPress={() => setNewLink(prev => ({ ...prev, visibility: 'admin_only' }))}
                >
                  <Ionicons name="lock-closed" size={20} color={newLink.visibility === 'admin_only' ? '#FF9500' : '#666'} />
                  <Text style={[
                    styles.visibilityOptionText,
                    newLink.visibility === 'admin_only' && styles.visibilityOptionTextSelectedAdmin
                  ]}>
                    Apenas Admin
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={styles.addLinkSubmitButton} onPress={addLink}>
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.addLinkSubmitText}>Adicionar Link</Text>
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
            <Text style={styles.deleteModalTitle}>Excluir Produto</Text>
            <Text style={styles.deleteModalMessage}>
              Deseja realmente excluir "{productToDelete?.name}"?
            </Text>
            <Text style={styles.deleteModalWarning}>
              Esta ação não pode ser desfeita.
            </Text>
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity 
                style={styles.deleteModalCancelButton}
                onPress={() => {
                  setDeleteModalVisible(false);
                  setProductToDelete(null);
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
  },
  // Estilos do Image Picker
  imagePickerContainer: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F5F5F5',
    position: 'relative'
  },
  productImagePreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover'
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F0F0'
  },
  imagePlaceholderText: {
    marginTop: 8,
    fontSize: 14,
    color: '#999'
  },
  imagePickerOverlay: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center'
  },
  removeImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    padding: 8,
    gap: 6
  },
  removeImageText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '500'
  }
});
