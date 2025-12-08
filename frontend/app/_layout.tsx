import { Stack } from 'expo-router';
import { AuthProvider } from '../contexts/AuthContext';
import '@react-native-async-storage/async-storage';

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="auth/welcome" />
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="auth/register" />
        <Stack.Screen name="auth/admin-login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="admin-dashboard" />
        <Stack.Screen name="admin/categories" />
        <Stack.Screen name="admin/products" />
        <Stack.Screen name="admin/orders" />
        <Stack.Screen name="admin/whatsapp-config" />
        <Stack.Screen name="product-detail" />
        <Stack.Screen name="checkout" />
        <Stack.Screen name="payment-pix" />
      </Stack>
    </AuthProvider>
  );
}