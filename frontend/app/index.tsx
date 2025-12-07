import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';

export default function Index() {
  const router = useRouter();
  const { token, isAdmin, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (token) {
        if (isAdmin) {
          router.replace('/admin');
        } else {
          router.replace('/(tabs)');
        }
      } else {
        router.replace('/auth/welcome');
      }
    }
  }, [token, isAdmin, loading]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#007AFF" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff'
  }
});