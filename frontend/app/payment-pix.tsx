import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Alert, ActivityIndicator, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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

  const orderId = params.orderId as string || '';
  const paymentId = params.paymentId as string || '';
  const pixPayload = params.pixPayload as string || '';
  const pixKey = params.pixKey as string || '';
  const merchantName = params.merchantName as string || '';
  const amount = params.amount as string || '0.00';
  const productName = params.productName as string || '';
  const productImage = params.productImage as string || '';
  const itemCount = parseInt(params.itemCount as string || '1');
  
  const qrCode = (params.qrCode as string) || pixPayload;

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
    }, 10000);
  };

  const checkPaymentStatus = async () => {
    try {
      setChecking(true);
      const response = await axios.get(`${BACKEND_URL}/api/payments/${paymentId}/status`);

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
    const codeToCopy = pixPayload || qrCode;
    if (codeToCopy) {
      await Clipboard.setStringAsync(codeToCopy as string);
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
      <LinearGradient colors={['#1E1E2E', '#2D2D44']} style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.backButton}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Pagamento PIX</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {paymentApproved ? (
          <View style={styles.successContainer}>
            <LinearGradient
              colors={['#10B981', '#34D399']}
              style={styles.successIcon}
            >
              <Ionicons name="checkmark" size={60} color="#fff" />
            </LinearGradient>
            <Text style={styles.successTitle}>Pagamento Aprovado!</Text>
            <Text style={styles.successText}>Seu pedido está sendo processado</Text>
            <TouchableOpacity 
              style={styles.viewOrdersButton}
              onPress={() => router.replace('/(tabs)/orders')}
            >
              <Text style={styles.viewOrdersButtonText}>Ver Meus Pedidos</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Product Preview */}
            {(productName || productImage) && (
              <LinearGradient colors={['#2D2D44', '#1E1E2E']} style={styles.productPreview}>
                {productImage ? (
                  <Image
                    source={{ uri: productImage }}
                    style={styles.productImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.productImagePlaceholder}>
                    <Ionicons name="cube" size={40} color="#6366F1" />
                  </View>
                )}
                <View style={styles.productPreviewInfo}>
                  <Text style={styles.productPreviewName} numberOfLines={2}>
                    {productName || 'Produto'}
                  </Text>
                  {itemCount > 1 && (
                    <Text style={styles.productPreviewExtra}>+{itemCount - 1} item(s)</Text>
                  )}
                </View>
              </LinearGradient>
            )}

            {/* Amount Section */}
            <LinearGradient
              colors={['#6366F1', '#8B5CF6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.amountSection}
            >
              <Text style={styles.amountLabel}>Valor a Pagar</Text>
              <Text style={styles.amountValue}>R$ {amount}</Text>
            </LinearGradient>

            {/* QR Code Section */}
            <LinearGradient colors={['#2D2D44', '#1E1E2E']} style={styles.qrSection}>
              <Text style={styles.sectionTitle}>Escaneie o QR Code</Text>
              {(pixPayload || qrCode) && (
                <View style={styles.qrCodeContainer}>
                  <QRCode
                    value={(pixPayload || qrCode) as string}
                    size={200}
                    backgroundColor="#fff"
                  />
                </View>
              )}
              {merchantName && (
                <Text style={styles.merchantName}>
                  Pagamento para: {merchantName}
                </Text>
              )}
              {pixKey && (
                <Text style={styles.pixKeyInfo}>
                  Chave PIX: {pixKey}
                </Text>
              )}
              <Text style={styles.qrHint}>
                Abra o app do seu banco e escaneie o código
              </Text>
            </LinearGradient>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ou</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Copy Code Section */}
            <LinearGradient colors={['#2D2D44', '#1E1E2E']} style={styles.codeSection}>
              <Text style={styles.sectionTitle}>PIX Copia e Cola</Text>
              <Text style={styles.codeHint}>Copie o código abaixo e cole no app do seu banco</Text>
              <View style={styles.codeContainer}>
                {(pixPayload || qrCode) ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <Text style={styles.codeText} selectable={true}>
                      {pixPayload || qrCode}
                    </Text>
                  </ScrollView>
                ) : (
                  <Text style={styles.codeTextError}>
                    Código PIX não disponível. Use o QR Code acima.
                  </Text>
                )}
              </View>
              <TouchableOpacity 
                style={[styles.copyButton, !(pixPayload || qrCode) && styles.copyButtonDisabled]} 
                onPress={copyToClipboard}
                disabled={!(pixPayload || qrCode)}
              >
                <LinearGradient
                  colors={['#10B981', '#34D399']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.copyButtonGradient}
                >
                  <Ionicons name="copy" size={20} color="#fff" />
                  <Text style={styles.copyButtonText}>Copiar Código PIX</Text>
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>

            {/* Status Section */}
            <LinearGradient colors={['#2D2D44', '#1E1E2E']} style={styles.statusSection}>
              {checking ? (
                <View style={styles.checkingContainer}>
                  <ActivityIndicator size="small" color="#6366F1" />
                  <Text style={styles.checkingText}>Verificando pagamento...</Text>
                </View>
              ) : (
                <View style={styles.waitingContainer}>
                  <View style={styles.waitingIconBg}>
                    <Ionicons name="time-outline" size={28} color="#F59E0B" />
                  </View>
                  <Text style={styles.waitingText}>
                    Aguardando confirmação do pagamento...
                  </Text>
                  <Text style={styles.waitingSubtext}>
                    O admin será notificado e confirmará seu pagamento em breve!
                  </Text>
                </View>
              )}
            </LinearGradient>

            {/* Instructions */}
            <View style={styles.infoBox}>
              <Ionicons name="information-circle" size={24} color="#6366F1" />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Como pagar:</Text>
                <Text style={styles.infoTextItem}>1. Abra o app do seu banco</Text>
                <Text style={styles.infoTextItem}>2. Entre em PIX → Pix Copia e Cola</Text>
                <Text style={styles.infoTextItem}>3. Cole o código ou escaneie o QR Code</Text>
                <Text style={styles.infoTextItem}>4. Confirme o pagamento de R$ {amount}</Text>
                <Text style={styles.infoTextItem}>5. Aguarde a confirmação pelo vendedor</Text>
              </View>
            </View>

            <View style={{ height: 40 }} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 10
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff'
  },
  content: {
    flex: 1,
    padding: 16
  },
  productPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 12
  },
  productImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  productPreviewInfo: {
    flex: 1,
    marginLeft: 14
  },
  productPreviewName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E5E7EB'
  },
  productPreviewExtra: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 4
  },
  amountSection: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16
  },
  amountLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8
  },
  amountValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff'
  },
  qrSection: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16
  },
  qrCodeContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16
  },
  qrHint: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center'
  },
  merchantName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E5E7EB',
    marginBottom: 4,
    textAlign: 'center'
  },
  pixKeyInfo: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 12,
    textAlign: 'center'
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)'
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: '#6B7280'
  },
  codeSection: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  codeHint: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 16
  },
  codeContainer: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    padding: 16,
    borderRadius: 10,
    marginBottom: 16
  },
  codeText: {
    fontSize: 11,
    color: '#A5B4FC',
    fontFamily: 'monospace'
  },
  codeTextError: {
    fontSize: 13,
    color: '#EF4444',
    textAlign: 'center',
    padding: 8
  },
  copyButton: {
    borderRadius: 12,
    overflow: 'hidden'
  },
  copyButtonGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    gap: 10
  },
  copyButtonDisabled: {
    opacity: 0.5
  },
  copyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  statusSection: {
    padding: 20,
    borderRadius: 16,
    marginTop: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  checkingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  checkingText: {
    fontSize: 14,
    color: '#A5B4FC'
  },
  waitingContainer: {
    alignItems: 'center',
    gap: 10
  },
  waitingIconBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8
  },
  waitingText: {
    fontSize: 15,
    color: '#E5E7EB',
    textAlign: 'center'
  },
  waitingSubtext: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center'
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    padding: 16,
    borderRadius: 16,
    marginTop: 16,
    gap: 12
  },
  infoContent: {
    flex: 1
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#A5B4FC',
    marginBottom: 8
  },
  infoTextItem: {
    fontSize: 13,
    color: '#9CA3AF',
    marginBottom: 4,
    lineHeight: 18
  },
  successContainer: {
    alignItems: 'center',
    padding: 40
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24
  },
  successTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#10B981',
    marginBottom: 8
  },
  successText: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 32
  },
  viewOrdersButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12
  },
  viewOrdersButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  }
});
