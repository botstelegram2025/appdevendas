import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Alert, ActivityIndicator, TextInput, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { BACKEND_URL } from '../../config';
import { useAuth } from '../../contexts/AuthContext';

export default function WhatsAppConfig() {
  const router = useRouter();
  const { adminToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [testNumber, setTestNumber] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [phoneDisplay, setPhoneDisplay] = useState<string | null>(null);
  const [allowedNumber, setAllowedNumber] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 5000); // Atualiza a cada 5 segundos
    return () => clearInterval(interval);
  }, []);

  const checkStatus = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/whatsapp/status`);
      setIsConnected(response.data.connected);
      setPhoneNumber(response.data.phone_number || null);
      setPhoneDisplay(response.data.phone_display || null);
      setAllowedNumber(response.data.allowed_number || null);
      setIsAuthorized(response.data.is_authorized || false);
      
      if (!response.data.connected) {
        // Sempre tentar buscar QR Code quando não conectado
        try {
          const qrResponse = await axios.get(`${BACKEND_URL}/api/whatsapp/qr`);
          if (qrResponse.data.qr) {
            setQrCode(qrResponse.data.qr);
          } else {
            setQrCode(null);
          }
        } catch (qrError) {
          console.log('QR não disponível ainda');
          setQrCode(null);
        }
      } else {
        setQrCode(null);
      }
    } catch (error) {
      console.error('Erro ao verificar status:', error);
    } finally {
      setLoading(false);
    }
  };

  const startSession = async () => {
    setLoading(true);
    try {
      await axios.post(
        `${BACKEND_URL}/api/whatsapp/start`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${adminToken}`
          }
        }
      );
      Alert.alert('Sucesso', 'Sessão iniciada! Aguarde o QR Code...');
      setTimeout(checkStatus, 3000);
    } catch (error: any) {
      Alert.alert('Erro', error.response?.data?.detail || 'Erro ao iniciar sessão');
    } finally {
      setLoading(false);
    }
  };

  const sendTestMessage = async () => {
    if (!testNumber || !testMessage) {
      Alert.alert('Erro', 'Preencha o número e a mensagem');
      return;
    }

    setSending(true);
    try {
      await axios.post(
        `${BACKEND_URL}/api/whatsapp/send`, 
        {
          number: testNumber,
          message: testMessage
        },
        {
          headers: {
            'Authorization': `Bearer ${adminToken}`
          }
        }
      );
      Alert.alert('Sucesso', 'Mensagem enviada!');
      setTestMessage('');
    } catch (error: any) {
      Alert.alert('Erro', error.response?.data?.detail || 'Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  const disconnectWhatsApp = async () => {
    Alert.alert(
      'Desconectar WhatsApp',
      `Isso irá desconectar o número ${phoneDisplay || phoneNumber || 'atual'} e gerar um novo QR Code. Deseja continuar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desconectar',
          style: 'destructive',
          onPress: async () => {
            setDisconnecting(true);
            try {
              const response = await axios.post(
                `${BACKEND_URL}/api/whatsapp/logout`,
                {},
                {
                  headers: {
                    'Authorization': `Bearer ${adminToken}`
                  }
                }
              );
              if (response.data.success) {
                Alert.alert('Sucesso', response.data.message || 'WhatsApp desconectado! Novo QR Code será gerado.');
                setIsConnected(false);
                setPhoneNumber(null);
                setPhoneDisplay(null);
              } else {
                Alert.alert('Erro', response.data.error || 'Erro ao desconectar');
              }
              setTimeout(checkStatus, 3000);
            } catch (error: any) {
              Alert.alert('Erro', error.response?.data?.detail || 'Erro ao desconectar');
            } finally {
              setDisconnecting(false);
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>Configurar WhatsApp</Text>
        <TouchableOpacity onPress={checkStatus}>
          <Ionicons name="refresh" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Ionicons 
              name={isConnected ? "checkmark-circle" : "alert-circle"} 
              size={32} 
              color={isConnected ? "#34C759" : "#FF9500"} 
            />
            <Text style={styles.statusTitle}>
              {isConnected ? 'WhatsApp Conectado' : 'WhatsApp Desconectado'}
            </Text>
          </View>
          
          {isConnected && phoneDisplay && (
            <View style={styles.phoneNumberBox}>
              <Ionicons name="call" size={20} color="#007AFF" />
              <Text style={styles.phoneNumberText}>{phoneDisplay}</Text>
            </View>
          )}
          
          <Text style={styles.statusSubtitle}>
            {isConnected 
              ? '✅ Notificações serão enviadas automaticamente'
              : '⚠️ Escaneie o QR Code abaixo para conectar'
            }
          </Text>
          
          {allowedNumber && (
            <View style={styles.allowedNumberBox}>
              <Ionicons name="shield-checkmark" size={16} color="#34C759" />
              <Text style={styles.allowedNumberText}>
                Número autorizado: {allowedNumber.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, '+$1 ($2) $3-$4')}
              </Text>
            </View>
          )}
          
          {isConnected && (
            <TouchableOpacity 
              style={[styles.disconnectButton, disconnecting && styles.disconnectButtonDisabled]}
              onPress={disconnectWhatsApp}
              disabled={disconnecting}
            >
              {disconnecting ? (
                <ActivityIndicator size="small" color="#FF3B30" />
              ) : (
                <>
                  <Ionicons name="log-out-outline" size={20} color="#FF3B30" />
                  <Text style={styles.disconnectButtonText}>Desconectar WhatsApp</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* QR Code Section */}
        {!isConnected && qrCode && (
          <View style={styles.qrSection}>
            <Text style={styles.sectionTitle}>Escaneie com seu WhatsApp</Text>
            <View style={styles.qrContainer}>
              <Image
                source={{ uri: qrCode }}
                style={{ width: 300, height: 300 }}
                resizeMode="contain"
              />
            </View>
            <View style={styles.instructionsBox}>
              <Text style={styles.instructionsTitle}>Como conectar:</Text>
              <Text style={styles.instructionText}>
                1. Abra o WhatsApp no seu celular{'\n'}
                2. Toque em Mais opções (⋮) → Aparelhos conectados{'\n'}
                3. Toque em Conectar um aparelho{'\n'}
                4. Aponte o celular para esta tela e escaneie o QR Code{'\n'}
                5. Aguarde a conexão
              </Text>
            </View>
          </View>
        )}

        {!isConnected && !qrCode && !loading && (
          <View style={styles.startSessionContainer}>
            <Ionicons name="qr-code-outline" size={64} color="#CCC" />
            <Text style={styles.startSessionTitle}>Sessão não iniciada</Text>
            <Text style={styles.startSessionText}>
              Inicie uma nova sessão para gerar o QR Code e conectar seu WhatsApp
            </Text>
            <TouchableOpacity 
              style={styles.startButton}
              onPress={startSession}
            >
              <Ionicons name="play-circle" size={24} color="#fff" />
              <Text style={styles.startButtonText}>Iniciar Sessão</Text>
            </TouchableOpacity>
          </View>
        )}

        {!isConnected && !qrCode && loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Gerando QR Code...</Text>
          </View>
        )}

        {/* Test Message Section */}
        {isConnected && (
          <View style={styles.testSection}>
            <Text style={styles.sectionTitle}>Testar Envio de Mensagem</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Número (com DDI)</Text>
              <TextInput
                style={styles.input}
                placeholder="5561999999999"
                value={testNumber}
                onChangeText={setTestNumber}
                keyboardType="phone-pad"
              />
              <Text style={styles.hint}>Exemplo: 5561999999999 (Brasil)</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mensagem</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Digite a mensagem de teste..."
                value={testMessage}
                onChangeText={setTestMessage}
                multiline
                numberOfLines={4}
              />
            </View>

            <TouchableOpacity 
              style={[styles.sendButton, sending && styles.buttonDisabled]}
              onPress={sendTestMessage}
              disabled={sending}
            >
              {sending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="send" size={20} color="#fff" />
                  <Text style={styles.sendButtonText}>Enviar Teste</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color="#007AFF" />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Notificações Automáticas</Text>
            <Text style={styles.infoText}>
              • Novo pedido → Notifica admin{'\n'}
              • Pagamento aprovado → Notifica cliente e admin{'\n'}
              • Pedido entregue → Notifica cliente{'\n'}
              {'\n'}
              Todas as mensagens serão enviadas com o nome "MARKIMAGEM TV"
            </Text>
          </View>
        </View>
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
    flex: 1,
    padding: 16
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000'
  },
  statusSubtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20
  },
  phoneNumberBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    marginBottom: 8
  },
  phoneNumberText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32'
  },
  allowedNumberBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    padding: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 6
  },
  allowedNumberText: {
    fontSize: 12,
    color: '#666'
  },
  disconnectButton: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#FFF5F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFE0E0'
  },
  disconnectButtonDisabled: {
    opacity: 0.6
  },
  disconnectButtonText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '600'
  },
  qrSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center'
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 16
  },
  qrContainer: {
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#E0E0E0'
  },
  instructionsBox: {
    backgroundColor: '#007AFF20',
    padding: 16,
    borderRadius: 8,
    width: '100%'
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 8
  },
  instructionText: {
    fontSize: 13,
    color: '#007AFF',
    lineHeight: 20
  },
  loadingContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    marginBottom: 16
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#666'
  },
  testSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16
  },
  inputGroup: {
    marginBottom: 16
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top'
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4
  },
  sendButton: {
    backgroundColor: '#34C759',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8
  },
  buttonDisabled: {
    opacity: 0.5
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16
  },
  infoContent: {
    flex: 1
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8
  },
  infoText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 20
  },
  startSessionContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    marginBottom: 16
  },
  startSessionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginTop: 16,
    marginBottom: 8
  },
  startSessionText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20
  },
  startButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    justifyContent: 'center'
  },
  startButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  }
});
