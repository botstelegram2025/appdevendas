import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, TextInput, Switch, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { BACKEND_URL } from '../../config';
import { useAuth } from '../../contexts/AuthContext';

interface DaySchedule {
  _id: string;
  day_of_week: number;
  is_open: boolean;
  open_time: string;
  close_time: string;
}

interface BusinessConfig {
  enabled: boolean;
  closed_message: string;
  timezone: string;
}

export default function BusinessHoursScreen() {
  const router = useRouter();
  const { adminToken } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingDay, setSavingDay] = useState<number | null>(null);
  const [config, setConfig] = useState<BusinessConfig>({
    enabled: false,
    closed_message: '',
    timezone: 'America/Sao_Paulo'
  });
  const [schedule, setSchedule] = useState<DaySchedule[]>([]);
  
  const daysOfWeek = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  useEffect(() => {
    loadBusinessHours();
  }, []);

  const loadBusinessHours = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${BACKEND_URL}/api/admin/business-hours/config`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      
      setConfig(response.data.config);
      setSchedule(response.data.schedule);
    } catch (error) {
      console.error('Erro ao carregar horários:', error);
      Alert.alert('Erro', 'Não foi possível carregar os horários');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    try {
      setSaving(true);
      await axios.put(
        `${BACKEND_URL}/api/admin/business-hours/config`,
        config,
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      Alert.alert('Sucesso', 'Configuração salva!');
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      Alert.alert('Erro', 'Não foi possível salvar a configuração');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSchedule = async (day: DaySchedule) => {
    try {
      setSavingDay(day.day_of_week);
      
      console.log(`💾 Salvando ${daysOfWeek[day.day_of_week]}: Aberto=${day.is_open}, ${day.open_time}-${day.close_time}`);
      
      const response = await axios.put(
        `${BACKEND_URL}/api/admin/business-hours/schedule/${day.day_of_week}`,
        {
          day_of_week: day.day_of_week,
          is_open: day.is_open,
          open_time: day.open_time,
          close_time: day.close_time
        },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      
      console.log(`✅ ${daysOfWeek[day.day_of_week]} salvo com sucesso!`, response.data);
      
      // Recarregar dados para confirmar
      await loadBusinessHours();
      
      Alert.alert('✅ Salvo!', `Horário de ${daysOfWeek[day.day_of_week]} atualizado com sucesso!`);
    } catch (error: any) {
      console.error('❌ Erro ao salvar horário:', error);
      const errorMsg = error.response?.data?.detail || 'Não foi possível salvar o horário';
      Alert.alert('❌ Erro', errorMsg);
    } finally {
      setSavingDay(null);
    }
  };

  const updateScheduleDay = (dayIndex: number, field: keyof DaySchedule, value: any) => {
    const newSchedule = [...schedule];
    const daySchedule = newSchedule.find(d => d.day_of_week === dayIndex);
    if (daySchedule) {
      (daySchedule as any)[field] = value;
      setSchedule(newSchedule);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Horário de Atendimento</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Ativar/Desativar Sistema */}
        <View style={styles.section}>
          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <Text style={styles.switchLabel}>Sistema de Horários</Text>
              <Text style={styles.switchDescription}>
                {config.enabled ? 'Loja com horário de funcionamento' : 'Loja sempre aberta'}
              </Text>
            </View>
            <Switch
              value={config.enabled}
              onValueChange={(value) => setConfig({ ...config, enabled: value })}
              trackColor={{ false: '#E0E0E0', true: '#007AFF' }}
            />
          </View>
        </View>

        {/* Mensagem de Fechado */}
        {config.enabled && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Mensagem Quando Fechado</Text>
            <TextInput
              style={styles.textArea}
              value={config.closed_message}
              onChangeText={(text) => setConfig({ ...config, closed_message: text })}
              placeholder="Digite a mensagem que aparecerá quando a loja estiver fechada"
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
          </View>
        )}

        {/* Botão Salvar Configuração */}
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSaveConfig}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="save" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>Salvar Configuração</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Horários por Dia */}
        {config.enabled && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Horários por Dia da Semana</Text>
            
            {schedule.map((day) => (
              <View key={day.day_of_week} style={styles.dayCard}>
                <View style={styles.dayHeader}>
                  <Text style={styles.dayName}>{daysOfWeek[day.day_of_week]}</Text>
                  <View style={styles.daySwitch}>
                    <Text style={styles.daySwitchLabel}>{day.is_open ? 'Aberto' : 'Fechado'}</Text>
                    <Switch
                      value={day.is_open}
                      onValueChange={(value) => updateScheduleDay(day.day_of_week, 'is_open', value)}
                      trackColor={{ false: '#E0E0E0', true: '#34C759' }}
                    />
                  </View>
                </View>

                {day.is_open && (
                  <View style={styles.timeRow}>
                    <View style={styles.timeInput}>
                      <Text style={styles.timeLabel}>Abre</Text>
                      <TextInput
                        style={styles.timeField}
                        value={day.open_time}
                        onChangeText={(text) => updateScheduleDay(day.day_of_week, 'open_time', text)}
                        placeholder="09:00"
                        keyboardType="numeric"
                        maxLength={5}
                      />
                    </View>

                    <Ionicons name="arrow-forward" size={20} color="#999" />

                    <View style={styles.timeInput}>
                      <Text style={styles.timeLabel}>Fecha</Text>
                      <TextInput
                        style={styles.timeField}
                        value={day.close_time}
                        onChangeText={(text) => updateScheduleDay(day.day_of_week, 'close_time', text)}
                        placeholder="18:00"
                        keyboardType="numeric"
                        maxLength={5}
                      />
                    </View>

                    <TouchableOpacity
                      style={styles.saveIconButton}
                      onPress={() => handleSaveSchedule(day)}
                    >
                      <Ionicons name="checkmark-circle" size={32} color="#34C759" />
                    </TouchableOpacity>
                  </View>
                )}

                {!day.is_open && (
                  <TouchableOpacity
                    style={styles.saveDayButton}
                    onPress={() => handleSaveSchedule(day)}
                  >
                    <Text style={styles.saveDayButtonText}>Salvar</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0'
  },
  backButton: {
    padding: 8
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16
  },
  loadingText: {
    fontSize: 16,
    color: '#666'
  },
  content: {
    flex: 1,
    padding: 16
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  switchInfo: {
    flex: 1
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4
  },
  switchDescription: {
    fontSize: 14,
    color: '#666'
  },
  textArea: {
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#000',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    minHeight: 120
  },
  saveButton: {
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  dayCard: {
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  dayName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000'
  },
  daySwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  daySwitchLabel: {
    fontSize: 14,
    color: '#666'
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  timeInput: {
    flex: 1
  },
  timeLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4
  },
  timeField: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0'
  },
  saveIconButton: {
    padding: 4
  },
  saveDayButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center'
  },
  saveDayButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600'
  }
});
