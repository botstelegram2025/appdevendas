import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { BACKEND_URL } from '../config';

interface BusinessStatus {
  is_open: boolean;
  message?: string;
  next_open?: {
    day_name: string;
    time: string;
    today: boolean;
  };
  current_time?: string;
  closes_at?: string;
}

interface BusinessHoursCheckProps {
  onStatusChange?: (isOpen: boolean) => void;
}

export default function BusinessHoursCheck({ onStatusChange }: BusinessHoursCheckProps) {
  const [status, setStatus] = useState<BusinessStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    checkBusinessHours();
    
    // Verificar a cada 1 minuto
    const interval = setInterval(checkBusinessHours, 60000);
    
    return () => clearInterval(interval);
  }, []);

  const checkBusinessHours = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/business-hours/status`);
      const newStatus = response.data;
      
      setStatus(newStatus);
      setLoading(false);
      
      // Mostrar modal apenas se fechado
      setShowModal(!newStatus.is_open);
      
      // Notificar componente pai
      if (onStatusChange) {
        onStatusChange(newStatus.is_open);
      }
    } catch (error) {
      console.error('Erro ao verificar horário:', error);
      // Em caso de erro, assumir que está aberto para não bloquear
      setStatus({ is_open: true });
      setLoading(false);
      setShowModal(false);
      
      if (onStatusChange) {
        onStatusChange(true);
      }
    }
  };

  if (loading || !status || status.is_open) {
    return null;
  }

  return (
    <Modal
      visible={showModal}
      animationType="fade"
      transparent={true}
      onRequestClose={() => {}}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Ícone de Relógio */}
          <View style={styles.iconContainer}>
            <Ionicons name="time" size={80} color="#FF3B30" />
          </View>

          {/* Título */}
          <Text style={styles.title}>Estamos Fechados</Text>

          {/* Mensagem Personalizada */}
          {status.message && (
            <Text style={styles.message}>{status.message}</Text>
          )}

          {/* Próximo Horário de Abertura */}
          {status.next_open && (
            <View style={styles.nextOpenContainer}>
              <View style={styles.nextOpenHeader}>
                <Ionicons name="calendar-outline" size={24} color="#007AFF" />
                <Text style={styles.nextOpenTitle}>Próxima Abertura:</Text>
              </View>
              
              <View style={styles.nextOpenInfo}>
                <Text style={styles.nextOpenDay}>{status.next_open.day_name}</Text>
                <Text style={styles.nextOpenTime}>às {status.next_open.time}</Text>
              </View>
            </View>
          )}

          {/* Botão de Recarregar */}
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={checkBusinessHours}
          >
            <Ionicons name="refresh" size={20} color="#fff" />
            <Text style={styles.refreshButtonText}>Verificar Novamente</Text>
          </TouchableOpacity>

          {/* Informação Adicional */}
          <Text style={styles.footer}>
            Volte durante nosso horário de atendimento para fazer seus pedidos
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 16
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FF3B3010',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 16,
    textAlign: 'center'
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24
  },
  nextOpenContainer: {
    width: '100%',
    backgroundColor: '#007AFF10',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#007AFF30'
  },
  nextOpenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12
  },
  nextOpenTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF'
  },
  nextOpenInfo: {
    alignItems: 'center',
    gap: 4
  },
  nextOpenDay: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000'
  },
  nextOpenTime: {
    fontSize: 20,
    color: '#666'
  },
  refreshButton: {
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 8,
    marginBottom: 16
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  footer: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    lineHeight: 18
  }
});
