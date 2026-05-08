import { create } from 'zustand';

interface CartItem {
  product_id: string;
  product_name: string;
  product_type: string;
  quantity: number;
  unit_price: number;
  fields_data: { [key: string]: string };
  discount_rules?: Array<{ min_quantity: number; discount_percent: number }>;
  subtotal: number;
}

interface CartStore {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (product_id: string) => void;
  clearCart: () => void;
  getTotal: () => number;
  getDiscount: () => number;
  getFinalTotal: () => number;
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  
  addItem: (item) => {
    set((state) => {
      // Check if item already exists
      const existingIndex = state.items.findIndex(i => i.product_id === item.product_id);
      
      if (existingIndex >= 0) {
        // Update quantity and subtotal
        const newItems = [...state.items];
        const newQuantity = newItems[existingIndex].quantity + item.quantity;
        newItems[existingIndex] = {
          ...newItems[existingIndex],
          quantity: newQuantity,
          subtotal: newQuantity * item.unit_price
        };
        return { items: newItems };
      } else {
        // Add new item
        return { items: [...state.items, item] };
      }
    });
  },
  
  removeItem: (product_id) => {
    set((state) => ({
      items: state.items.filter(item => item.product_id !== product_id)
    }));
  },
  
  clearCart: () => set({ items: [] }),
  
  getTotal: () => {
    const state = get();
    return state.items.reduce((sum, item) => sum + item.subtotal, 0);
  },
  
  getDiscount: () => {
    const state = get();
    let totalDiscount = 0;
    
    state.items.forEach(item => {
      if (item.discount_rules && item.discount_rules.length > 0) {
        // Find applicable discount rule
        const applicableRule = item.discount_rules
          .filter(rule => item.quantity >= rule.min_quantity)
          .sort((a, b) => b.discount_percent - a.discount_percent)[0];
        
        if (applicableRule) {
          totalDiscount += item.subtotal * (applicableRule.discount_percent / 100);
        }
      }
    });
    
    return totalDiscount;
  },
  
  getFinalTotal: () => {
    const state = get();
    return state.getTotal() - state.getDiscount();
  }
}));