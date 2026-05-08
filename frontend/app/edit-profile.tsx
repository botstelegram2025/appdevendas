import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { BACKEND_URL } from '../config';

export default function EditProfile() {
  const router = useRouter();
  const { user, token, updateUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.phone) {
      // Format phone for display
      setPhone(formatPhoneForDisplay(user.phone));
    }
  }, [user]);

  const formatPhoneForDisplay = (phoneNumber: string) => {
    // Remove all non-digits
    const numbers = phoneNumber.replace(/\D/g, '');
    
    // Format: +55 (XX) XXXXX-XXXX or +55 (XX) XXXX-XXXX
    if (numbers.length === 12) {
      // 12 digits: 55 + DDD + 8 digits
      return `+${numbers.slice(0, 2)} (${numbers.slice(2, 4)}) ${numbers.slice(4, 8)}-${numbers.slice(8)}`;
    } else if (numbers.length === 13) {
      // 13 digits: 55 + DDD + 9 digits
      return `+${numbers.slice(0, 2)} (${numbers.slice(2, 4)}) ${numbers.slice(4, 9)}-${numbers.slice(9)}`;
    }
    return phoneNumber;
  };

  const formatPhone = (text: string) => {
    // Remove tudo que não é número
    const numbers = text.replace(/\D/g, '');
    
    // Limita a 13 dígitos (55 + DDD + 9 dígitos)
    const limited = numbers.slice(0, 13);
    
    // Aplica a máscara +55 (XX) XXXXX-XXXX
    if (limited.length === 0) {
      return '';
    } else if (limited.length <= 2) {
      return `+${limited}`;
    } else if (limited.length <= 4) {
      return `+${limited.slice(0, 2)} (${limited.slice(2)}`;
    } else if (limited.length <= 9) {
      return `+${limited.slice(0, 2)} (${limited.slice(2, 4)}) ${limited.slice(4)}`;
    } else {
      return `+${limited.slice(0, 2)} (${limited.slice(2, 4)}) ${limited.slice(4, 9)}-${limited.slice(9)}`;
    }
  };

  const handlePhoneChange = (text: string) => {
    const formatted = formatPhone(text);
    setPhone(formatted);
  };

  const validatePhone = (phone: string): boolean => {
    const numbers = phone.replace(/\D/g, '');
    
    if (numbers.length < 12 || numbers.length > 13) {
      return false;
    }
    
    if (!numbers.startsWith('55')) {
      return false;
    }
    
    const ddd = parseInt(numbers.slice(2, 4));
    if (ddd < 11 || ddd > 99) {
      return false;
    }
    
    return true;
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Erro', 'Nome é obrigatório');
      return;
    }

    if (phone && !validatePhone(phone)) {
      Alert.alert(
        'WhatsApp Inválido',
        'Digite o número completo no formato internacional.\n\n✅ Formato correto:\n+55 (61) 98765-4321'
      );
      return;
    }

    setLoading(true);
    try {
      // Remove formatação do telefone antes de enviar
      let cleanPhone = phone.replace(/\D/g, '');
      
      // Remove o 9º dígito se presente
      if (cleanPhone.length === 13 && cleanPhone[4] === '9') {
        cleanPhone = cleanPhone.slice(0, 4) + cleanPhone.slice(5);
      }

      const response = await axios.put(
        `${BACKEND_URL}/api/auth/profile`,
        {},
        {
          params: {
            name: name.trim(),
            phone: cleanPhone,
            email: email.trim() || undefined
          },
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      // Update user in context
      updateUser(response.data);

      Alert.alert('Sucesso', 'Perfil atualizado com sucesso!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Erro ao atualizar perfil';
      Alert.alert('Erro', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.title}>Editar Perfil</Text>
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Nome Completo *</Text>
              <TextInput
                style={styles.input}
                placeholder="Digite seu nome completo"
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>WhatsApp *</Text>
              <TextInput
                style={styles.input}
                placeholder="+55 (61) 98765-4321"
                value={phone}
                onChangeText={handlePhoneChange}
                keyboardType="phone-pad"
                maxLength={19}
              />
              <Text style={styles.hint}>📱 Formato: +55 (DDD) 9XXXX-XXXX</Text>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>E-mail (opcional)</Text>
              <TextInput
                style={styles.input}
                placeholder="seuemail@exemplo.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity 
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={20} color="#fff" />
                  <Text style={styles.buttonText}>Salvar Alterações</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5'
  },
  keyboardView: {
    flex: 1
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
    marginRight: 16
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold'
  },
  content: {
    flex: 1
  },
  form: {
    padding: 24
  },
  inputContainer: {
    marginBottom: 20
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#000'
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16
  },
  hint: {
    fontSize: 12,
    color: '#FF9500',
    marginTop: 4,
    fontWeight: '500'
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8
  },
  buttonDisabled: {
    opacity: 0.5
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  }
});
