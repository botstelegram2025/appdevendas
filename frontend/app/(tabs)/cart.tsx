import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCartStore } from '../../stores/cartStore';

export default function Cart() {
  const router = useRouter();
  const { items, removeItem, clearCart, getTotal, getDiscount, getFinalTotal } = useCartStore();

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={['#1E1E2E', '#2D2D44']} style={styles.header}>
          <Text style={styles.title}>Carrinho</Text>
        </LinearGradient>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="cart-outline" size={80} color="#4B5563" />
          </View>
          <Text style={styles.emptyText}>Seu carrinho está vazio</Text>
          <Text style={styles.emptySubtext}>Adicione produtos para começar</Text>
          <TouchableOpacity 
            style={styles.shopButton}
            onPress={() => router.push('/(tabs)/products')}
          >
            <Text style={styles.shopButtonText}>Ver Produtos</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const total = getTotal();
  const discount = getDiscount();
  const finalTotal = getFinalTotal();

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#1E1E2E', '#2D2D44']} style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.title}>Carrinho</Text>
            <Text style={styles.subtitle}>{items.length} item(s)</Text>
          </View>
          <TouchableOpacity onPress={clearCart} style={styles.clearButton}>
            <Ionicons name="trash-outline" size={20} color="#EF4444" />
            <Text style={styles.clearButtonText}>Limpar</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {items.map((item, index) => (
          <LinearGradient 
            key={index} 
            colors={['#2D2D44', '#1E1E2E']} 
            style={styles.itemCard}
          >
            <View style={styles.itemRow}>
              {item.product_image ? (
                <Image
                  source={{ uri: item.product_image }}
                  style={styles.itemImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.itemImagePlaceholder}>
                  <Ionicons name="cube" size={28} color="#6366F1" />
                </View>
              )}
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.product_name}</Text>
                <Text style={styles.itemQuantity}>Quantidade: {item.quantity}</Text>
                <Text style={styles.itemPrice}>R$ {item.subtotal.toFixed(2)}</Text>
              </View>
              
              <TouchableOpacity 
                style={styles.removeButton}
                onPress={() => removeItem(item.product_id)}
              >
                <Ionicons name="close-circle" size={28} color="#EF4444" />
              </TouchableOpacity>
            </View>
            
            {Object.keys(item.fields_data).length > 0 && (
              <View style={styles.fieldsContainer}>
                {Object.entries(item.fields_data).map(([key, value]) => (
                  <View key={key} style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>{key}:</Text>
                    <Text style={styles.fieldValue}>{value}</Text>
                  </View>
                ))}
              </View>
            )}
          </LinearGradient>
        ))}

        <LinearGradient colors={['#2D2D44', '#1E1E2E']} style={styles.summary}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>R$ {total.toFixed(2)}</Text>
          </View>
          
          {discount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, styles.discountLabel]}>Desconto</Text>
              <Text style={[styles.summaryValue, styles.discountValue]}>- R$ {discount.toFixed(2)}</Text>
            </View>
          )}
          
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>R$ {finalTotal.toFixed(2)}</Text>
          </View>
        </LinearGradient>

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.checkoutButton}
          onPress={() => router.push('/checkout')}
        >
          <LinearGradient
            colors={['#6366F1', '#8B5CF6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.checkoutButtonGradient}
          >
            <Text style={styles.checkoutButtonText}>Finalizar Compra</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </View>
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
    alignItems: 'flex-start'
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff'
  },
  subtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6
  },
  clearButtonText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600'
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24
  },
  emptyText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '600'
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8
  },
  shopButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 24
  },
  shopButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  content: {
    flex: 1,
    padding: 16
  },
  itemCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 12
  },
  itemImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  itemInfo: {
    flex: 1,
    marginLeft: 14
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E5E7EB',
    marginBottom: 4
  },
  itemQuantity: {
    fontSize: 13,
    color: '#9CA3AF',
    marginBottom: 4
  },
  itemPrice: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#A5B4FC'
  },
  removeButton: {
    padding: 4
  },
  fieldsContainer: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    padding: 12,
    borderRadius: 10,
    marginTop: 12
  },
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 4
  },
  fieldLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginRight: 6
  },
  fieldValue: {
    fontSize: 12,
    color: '#E5E7EB',
    flex: 1
  },
  summary: {
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  summaryLabel: {
    fontSize: 14,
    color: '#9CA3AF'
  },
  summaryValue: {
    fontSize: 14,
    color: '#E5E7EB',
    fontWeight: '600'
  },
  discountLabel: {
    color: '#10B981'
  },
  discountValue: {
    color: '#10B981'
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 12,
    marginBottom: 0
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff'
  },
  totalValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#A5B4FC'
  },
  footer: {
    padding: 16,
    paddingBottom: 24,
    backgroundColor: '#111827'
  },
  checkoutButton: {
    borderRadius: 14,
    overflow: 'hidden'
  },
  checkoutButtonGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    gap: 10
  },
  checkoutButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600'
  }
});
