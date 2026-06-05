import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView, 
  ScrollView, 
  ActivityIndicator, 
  Alert,
  Image,
  TextInput,
  Dimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { BACKEND_URL } from '../../config';
import { useCartStore } from '../../stores/cartStore';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

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
  type: string;
  category_id: string;
  image_url?: string;
}

export default function Products() {
  const router = useRouter();
  const cartItems = useCartStore((state) => state.items);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>('all');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'popular'>('name');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [selectedCategory, searchQuery, sortBy, allProducts]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [catRes, prodRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/categories`),
        axios.get(`${BACKEND_URL}/api/products`)
      ]);
      setCategories(catRes.data);
      setAllProducts(prodRes.data);
      setProducts(prodRes.data);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível carregar os dados');
    } finally {
      setLoading(false);
    }
  };

  const filterProducts = () => {
    let filtered = [...allProducts];
    
    // Filtrar por categoria
    if (selectedCategory && selectedCategory !== 'all') {
      filtered = filtered.filter(p => p.category_id === selectedCategory);
    }
    
    // Filtrar por busca
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query)
      );
    }
    
    // Ordenar
    if (sortBy === 'name') {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'price') {
      filtered.sort((a, b) => a.price - b.price);
    }
    
    setProducts(filtered);
  };

  const getCategoryName = (categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId);
    return cat?.name || '';
  };

  if (loading && categories.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Carregando produtos...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header com gradiente */}
      <LinearGradient
        colors={['#1E1E2E', '#2D2D44']}
        style={styles.header}
      >
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Catálogo</Text>
            <Text style={styles.headerSubtitle}>{products.length} produtos disponíveis</Text>
          </View>
          <TouchableOpacity 
            style={styles.cartButton}
            onPress={() => router.push('/(tabs)/cart')}
          >
            <Ionicons name="bag-handle" size={24} color="#fff" />
            {cartItems.length > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartItems.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Barra de busca */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar produtos..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {/* Filtros */}
      <View style={styles.filtersSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filtersRow}>
            <TouchableOpacity
              style={[styles.filterChip, selectedCategory === 'all' && styles.filterChipActive]}
              onPress={() => setSelectedCategory('all')}
            >
              <Text style={[styles.filterText, selectedCategory === 'all' && styles.filterTextActive]}>
                Todos
              </Text>
            </TouchableOpacity>
            {categories.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={[styles.filterChip, selectedCategory === category.id && styles.filterChipActive]}
                onPress={() => setSelectedCategory(category.id)}
              >
                <Text style={styles.filterIcon}>{category.icon}</Text>
                <Text style={[styles.filterText, selectedCategory === category.id && styles.filterTextActive]}>
                  {category.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Ordenação */}
        <View style={styles.sortRow}>
          <TouchableOpacity
            style={[styles.sortButton, sortBy === 'name' && styles.sortButtonActive]}
            onPress={() => setSortBy('name')}
          >
            <Text style={[styles.sortText, sortBy === 'name' && styles.sortTextActive]}>A-Z</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortButton, sortBy === 'price' && styles.sortButtonActive]}
            onPress={() => setSortBy('price')}
          >
            <Text style={[styles.sortText, sortBy === 'price' && styles.sortTextActive]}>Preço</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Grid de Produtos */}
      {products.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="cube-outline" size={80} color="#4B5563" />
          <Text style={styles.emptyTitle}>Nenhum produto encontrado</Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery ? 'Tente buscar por outro termo' : 'Os produtos aparecerão aqui'}
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.productsScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.productsGrid}>
            {products.map((product) => (
              <TouchableOpacity
                key={product.id}
                style={styles.productCard}
                onPress={() => router.push({ pathname: '/product-detail', params: { productId: product.id } })}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#2D2D44', '#1E1E2E']}
                  style={styles.cardGradient}
                >
                  {/* Imagem do produto */}
                  <View style={styles.imageContainer}>
                    {product.image_url ? (
                      <Image
                        source={{ uri: product.image_url }}
                        style={styles.productImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.placeholderImage}>
                        <Ionicons name="cube" size={48} color="#6366F1" />
                      </View>
                    )}
                  </View>

                  {/* Info do produto */}
                  <View style={styles.cardContent}>
                    <Text style={styles.productName} numberOfLines={2}>
                      {product.name}
                    </Text>
                    
                    <View style={styles.badgeContainer}>
                      <View style={styles.badge}>
                        <Ionicons name="flash" size={12} color="#10B981" />
                        <Text style={styles.badgeText}>Disponível</Text>
                      </View>
                    </View>

                    <View style={styles.priceRow}>
                      <Text style={styles.price}>R$ {product.price.toFixed(2)}</Text>
                      <View style={styles.addButton}>
                        <Ionicons name="add" size={20} color="#fff" />
                      </View>
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827'
  },
  loadingText: {
    color: '#9CA3AF',
    marginTop: 12,
    fontSize: 14
  },
  header: {
    padding: 20,
    paddingTop: 10
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff'
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4
  },
  cartButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(99, 102, 241, 0.3)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center'
  },
  cartBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold'
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    gap: 12
  },
  searchInput: {
    flex: 1,
    height: 48,
    color: '#fff',
    fontSize: 16
  },
  filtersSection: {
    backgroundColor: '#1F2937',
    paddingVertical: 12
  },
  filtersRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 6
  },
  filterChipActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1'
  },
  filterIcon: {
    fontSize: 16
  },
  filterText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '500'
  },
  filterTextActive: {
    color: '#fff'
  },
  sortRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginTop: 12
  },
  sortButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)'
  },
  sortButtonActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.3)'
  },
  sortText: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600'
  },
  sortTextActive: {
    color: '#A5B4FC'
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16
  },
  emptySubtitle: {
    color: '#6B7280',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center'
  },
  productsScroll: {
    flex: 1
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 16
  },
  productCard: {
    width: CARD_WIDTH,
    borderRadius: 16,
    overflow: 'hidden'
  },
  cardGradient: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  imageContainer: {
    width: '100%',
    height: 120,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  productImage: {
    width: '100%',
    height: '100%'
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.1)'
  },
  cardContent: {
    padding: 12
  },
  productName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    height: 36
  },
  badgeContainer: {
    marginBottom: 8
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start'
  },
  badgeText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '600'
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  price: {
    color: '#A5B4FC',
    fontSize: 16,
    fontWeight: 'bold'
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center'
  }
});
