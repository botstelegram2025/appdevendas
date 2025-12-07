import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCartStore } from '../../stores/cartStore';

export default function Cart() {
  const { items, removeItem, clearCart, getTotal, getDiscount, getFinalTotal } = useCartStore();

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Carrinho</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="cart-outline" size={80} color="#CCC" />
          <Text style={styles.emptyText}>Seu carrinho está vazio</Text>
          <Text style={styles.emptySubtext}>Adicione produtos para começar</Text>
        </View>
      </SafeAreaView>
    );
  }

  const total = getTotal();
  const discount = getDiscount();
  const finalTotal = getFinalTotal();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Carrinho</Text>
        <TouchableOpacity onPress={clearCart}>
          <Text style={styles.clearButton}>Limpar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {items.map((item, index) => (
          <View key={index} style={styles.itemCard}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.product_name}</Text>
              <Text style={styles.itemQuantity}>Quantidade: {item.quantity}</Text>
              <Text style={styles.itemPrice}>R$ {item.subtotal.toFixed(2)}</Text>
              
              {Object.keys(item.fields_data).length > 0 && (
                <View style={styles.fieldsContainer}>
                  {Object.entries(item.fields_data).map(([key, value]) => (
                    <Text key={key} style={styles.fieldText}>
                      {key}: {value}
                    </Text>
                  ))}
                </View>
              )}
            </View>
            
            <TouchableOpacity onPress={() => removeItem(item.product_id)}>
              <Ionicons name="trash-outline" size={24} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        ))}

        <View style={styles.summary}>
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
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.checkoutButton}>
          <Text style={styles.checkoutButtonText}>Finalizar Compra</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
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
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0'
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000'
  },
  clearButton: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600'
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    fontWeight: '600'
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8
  },
  content: {
    flex: 1,
    padding: 16
  },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  itemInfo: {
    flex: 1
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4
  },
  itemQuantity: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 8
  },
  fieldsContainer: {
    backgroundColor: '#F5F5F5',
    padding: 8,
    borderRadius: 8,
    marginTop: 8
  },
  fieldText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2
  },
  summary: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 8
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666'
  },
  summaryValue: {
    fontSize: 14,
    color: '#000',
    fontWeight: '600'
  },
  discountLabel: {
    color: '#34C759'
  },
  discountValue: {
    color: '#34C759'
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: 12,
    marginBottom: 0
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000'
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF'
  },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0'
  },
  checkoutButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8
  },
  checkoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  }
});