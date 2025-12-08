import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import axios from 'axios';
import { BACKEND_URL } from '../config';

export default function PaymentPix() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [checking, setChecking] = useState(false);
  const [paymentApproved, setPaymentApproved] = useState(false);
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);

  const { orderId, paymentId, qrCode, qrCodeBase64, amount } = params;

  useEffect(() => {
    startPolling();
    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, []);

  const startPolling = () => {
    checkPaymentStatus();
    pollingInterval.current = setInterval(() => {
      checkPaymentStatus();
    }, 5000);
  };

  const checkPaymentStatus = async () => {
    try {
      setChecking(true);
      const response = await axios.get(`${BACKEND_URL}/api/payments/${paymentId}/status`);
      
      console.log('Payment status:', response.data.status);

      if (response.data.status === 'approved') {
        setPaymentApproved(true);
        
        if (pollingInterval.current) {
          clearInterval(pollingInterval.current);
          pollingInterval.current = null;
        }

        Alert.alert(
          'Pagamento Aprovado!',
          'Seu pagamento foi confirmado com sucesso!',
          [
            {
              text: 'Ver Meus Pedidos',
              onPress: () => router.replace('/(tabs)/orders')
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error checking payment status:', error);
    } finally {
      setChecking(false);
    }
  };

  const copyToClipboard = async () => {
    if (qrCode) {
      await Clipboard.setStringAsync(qrCode as string);
      Alert.alert('Copiado!', 'Código PIX copiado para a área de transferência');
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancelar Pagamento',
      'Tem certeza que deseja cancelar? Você poderá ver o pedido em "Meus Pedidos".',
      [
        { text: 'Continuar Pagando', style: 'cancel' },
        {
          text: 'Cancelar',
          style: 'destructive',
          onPress: () => {
            if (pollingInterval.current) {
              clearInterval(pollingInterval.current);
            }
            router.replace('/(tabs)');
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel}>
          <Ionicons name="close" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>Pagamento PIX</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {paymentApproved ? (
          <View style={styles.successContainer}>
            <Ionicons name="checkmark-circle" size={80} color="#34C759" />
            <Text style={styles.successTitle}>Pagamento Aprovado!</Text>
            <Text style={styles.successText}>Seu pedido está sendo processado</Text>
          </View>
        ) : (
          <>
            <View style={styles.amountSection}>
              <Text style={styles.amountLabel}>Valor a Pagar</Text>
              <Text style={styles.amountValue}>R$ {amount}</Text>
            </View>

            <View style={styles.qrSection}>
              <Text style={styles.sectionTitle}>Escaneie o QR Code</Text>
              {qrCodeBase64 && (
                <View style={styles.qrCodeContainer}>
                  <QRCode
                    value={qrCode as string}
                    size={200}
                  />
                </View>
              )}
              <Text style={styles.qrHint}>
                Abra o app do seu banco e escaneie o código
              </Text>
            </View>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ou</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.codeSection}>
              <Text style={styles.sectionTitle}>Código Pix Copia e Cola</Text>
              <View style={styles.codeContainer}>
                <Text style={styles.codeText} numberOfLines={2}>
                  {qrCode}
                </Text>
              </View>
              <TouchableOpacity style={styles.copyButton} onPress={copyToClipboard}>
                <Ionicons name="copy" size={20} color="#fff" />
                <Text style={styles.copyButtonText}>Copiar Código</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.statusSection}>
              {checking ? (
                <View style={styles.checkingContainer}>
                  <ActivityIndicator size="small" color="#007AFF" />
                  <Text style={styles.checkingText}>Verificando pagamento...</Text>
                </View>
              ) : (
                <View style={styles.waitingContainer}>
                  <Ionicons name="time-outline" size={24} color="#FF9500" />
                  <Text style={styles.waitingText}>
                    Aguardando confirmação do pagamento...
                  </Text>
                </View>
              )}
              
              {/* Botão para simular aprovação (apenas para testes) */}
              <TouchableOpacity 
                style={styles.simulateButton}
                onPress={async () => {
                  try {
                    await axios.post(`${BACKEND_URL}/api/payments/${paymentId}/simulate-approval`);
                    Alert.alert('Simulado!', 'Pagamento simulado como aprovado. Aguarde a verificação...');
                  } catch (error) {
                    console.error('Error simulating payment:', error);
                  }
                }}
              >
                <Text style={styles.simulateButtonText}>🧪 Simular Pagamento (Teste)</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.infoBox}>
              <Ionicons name="information-circle" size={24} color="#007AFF" />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Como pagar:</Text>
                <Text style={styles.infoText}>
                  1. Abra o app do seu banco{'\n'}
                  2. Entre em PIX → Pix Copia e Cola{'\n'}
                  3. Cole o código ou escaneie o QR Code{'\n'}
                  4. Confirme o pagamento{'\n'}
                  5. Aguarde a confirmação automática
                </Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
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
  content: {
    flex: 1
  },
  amountSection: {
    backgroundColor: '#007AFF',
    padding: 32,
    alignItems: 'center'
  },
  amountLabel: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    marginBottom: 8
  },
  amountValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff'
  },
  qrSection: {
    backgroundColor: '#fff',
    padding: 24,
    alignItems: 'center',
    marginTop: 16
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 16
  },
  qrCodeContainer: {
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16
  },
  qrHint: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center'
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginVertical: 16
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0'
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: '#999'
  },
  codeSection: {
    backgroundColor: '#fff',
    padding: 24
  },
  codeContainer: {
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16
  },
  codeText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace'
  },
  copyButton: {
    backgroundColor: '#34C759',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8
  },
  copyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  statusSection: {
    backgroundColor: '#fff',
    padding: 24,
    marginTop: 16,
    alignItems: 'center'
  },
  checkingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  checkingText: {
    fontSize: 14,
    color: '#007AFF'
  },
  waitingContainer: {
    alignItems: 'center',
    gap: 12
  },
  waitingText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center'
  },
  successContainer: {
    alignItems: 'center',
    padding: 48
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#34C759',
    marginTop: 24,
    marginBottom: 8
  },
  successText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center'
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#007AFF20',
    padding: 16,
    borderRadius: 12,
    margin: 16,
    gap: 12
  },
  infoContent: {
    flex: 1
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 8
  },
  infoText: {
    fontSize: 13,
    color: '#007AFF',
    lineHeight: 20
  },
  simulateButton: {
    backgroundColor: '#FF9500',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    alignItems: 'center'
  },
  simulateButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600'
  }
});
