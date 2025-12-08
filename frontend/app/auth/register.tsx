import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';

export default function Register() {
  const router = useRouter();
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const formatPhone = (text: string) => {
    // Remove tudo que não é número
    const numbers = text.replace(/\D/g, '');
    
    // Limita a 11 dígitos (DDD + 9 dígitos)
    const limited = numbers.slice(0, 11);
    
    // Aplica a máscara (XX) XXXXX-XXXX
    if (limited.length <= 2) {
      return limited;
    } else if (limited.length <= 7) {
      return `(${limited.slice(0, 2)}) ${limited.slice(2)}`;
    } else {
      return `(${limited.slice(0, 2)}) ${limited.slice(2, 7)}-${limited.slice(7)}`;
    }
  };

  const handlePhoneChange = (text: string) => {
    const formatted = formatPhone(text);
    setPhone(formatted);
  };

  const validatePhone = (phone: string): boolean => {
    // Remove formatação
    const numbers = phone.replace(/\D/g, '');
    
    // Deve ter 11 dígitos (DDD + 9 dígitos)
    if (numbers.length !== 11) {
      return false;
    }
    
    // DDD deve ser válido (10-99)
    const ddd = parseInt(numbers.slice(0, 2));
    if (ddd < 11 || ddd > 99) {
      return false;
    }
    
    // Primeiro dígito do número deve ser 9 (celular)
    if (numbers[2] !== '9') {
      return false;
    }
    
    return true;
  };

  const handleRegister = async () => {
    if (!name || !phone || !cpf || !password) {
      Alert.alert('Erro', 'Preencha todos os campos obrigatórios');
      return;
    }

    if (!validatePhone(phone)) {
      Alert.alert(
        'Telefone Inválido',
        'Digite um número de celular válido com DDD.\nExemplo: (61) 98765-4321\n\n⚠️ Apenas números de celular (que começam com 9) são aceitos para receber notificações via WhatsApp.'
      );
      return;
    }

    if (password.length !== 6) {
      Alert.alert('Erro', 'A senha deve ter 6 dígitos');
      return;
    }

    setLoading(true);
    try {
      // Remove formatação antes de enviar
      const cleanPhone = phone.replace(/\D/g, '');
      await register(name, cleanPhone, cpf, email, password);
      // Use setTimeout to ensure state is updated before navigation
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 100);
    } catch (error: any) {
      Alert.alert('Erro', error.message);
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
          <Text style={styles.title}>Criar Conta</Text>
        </View>

        <ScrollView style={styles.scrollView}>
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
              <Text style={styles.label}>Celular com DDD (WhatsApp) *</Text>
              <TextInput
                style={styles.input}
                placeholder="(61) 98765-4321"
                value={phone}
                onChangeText={handlePhoneChange}
                keyboardType="numeric"
                maxLength={15}
              />
              <Text style={styles.hint}>⚠️ Apenas celular (começa com 9) para receber notificações</Text>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>CPF *</Text>
              <TextInput
                style={styles.input}
                placeholder="12345678900"
                value={cpf}
                onChangeText={setCpf}
                keyboardType="numeric"
              />
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

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Senha (6 dígitos) *</Text>
              <TextInput
                style={styles.input}
                placeholder="123456"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                keyboardType="numeric"
                maxLength={6}
              />
            </View>

            <TouchableOpacity 
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Criar Conta</Text>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity onPress={() => router.push('/auth/login')}>
              <Text style={styles.linkText}>Já tem conta? Faça login</Text>
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
    backgroundColor: '#fff'
  },
  keyboardView: {
    flex: 1
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
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
  scrollView: {
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
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8
  },
  buttonDisabled: {
    opacity: 0.5
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  linkText: {
    color: '#007AFF',
    textAlign: 'center',
    marginTop: 16
  }
});