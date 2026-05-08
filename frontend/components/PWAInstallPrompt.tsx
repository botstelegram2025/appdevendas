import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Modal, Platform, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

const PWA_DISMISSED_KEY = '@pwa_install_dismissed';
const PWA_INSTALLED_KEY = '@pwa_installed';

// Registrar Service Worker
const registerServiceWorker = async () => {
  if (Platform.OS === 'web' && 'serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js');
      console.log('Service Worker registrado:', registration.scope);
    } catch (error) {
      console.error('Erro ao registrar Service Worker:', error);
    }
  }
};

export default function PWAInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    // Registrar Service Worker
    registerServiceWorker();

    const checkInstallState = async () => {
      try {
        // Check if already installed or dismissed
        const dismissed = await AsyncStorage.getItem(PWA_DISMISSED_KEY);
        const installed = await AsyncStorage.getItem(PWA_INSTALLED_KEY);
        
        if (dismissed || installed) return;

        // Check if running as standalone (already installed)
        const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches ||
          (window.navigator as any).standalone === true;
        
        setIsStandalone(isStandaloneMode);
        
        if (isStandaloneMode) {
          await AsyncStorage.setItem(PWA_INSTALLED_KEY, 'true');
          return;
        }

        // Check for iOS
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
        setIsIOS(isIOSDevice);

        // Show prompt after 2 seconds
        setTimeout(() => {
          setShowPrompt(true);
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }).start();
        }, 2000);

      } catch (error) {
        console.log('PWA check error:', error);
      }
    };

    // Listen for beforeinstallprompt event (Chrome, Edge, etc.)
    const handleBeforeInstall = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
      console.log('beforeinstallprompt event captured!');
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      console.log('App installed!');
      AsyncStorage.setItem(PWA_INSTALLED_KEY, 'true');
      setShowPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall as any);
    window.addEventListener('appinstalled', handleAppInstalled);
    checkInstallState();

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall as any);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      console.log('Triggering install prompt...');
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log('User choice:', outcome);
      
      if (outcome === 'accepted') {
        await AsyncStorage.setItem(PWA_INSTALLED_KEY, 'true');
      }
      
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  const handleDismiss = async () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(async () => {
      setShowPrompt(false);
      await AsyncStorage.setItem(PWA_DISMISSED_KEY, 'true');
    });
  };

  if (!showPrompt || isStandalone || Platform.OS !== 'web') {
    return null;
  }

  return (
    <Modal
      visible={showPrompt}
      transparent={true}
      animationType="none"
      onRequestClose={handleDismiss}
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <View style={styles.container}>
          <TouchableOpacity style={styles.closeButton} onPress={handleDismiss}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>

          <Image
            source={require('../assets/images/logo-markimagem.png')}
            style={styles.logo}
            resizeMode="contain"
          />

          <Text style={styles.title}>Instale nosso App!</Text>
          
          <Text style={styles.description}>
            Adicione MARKIMAGEM TV à sua tela inicial para acesso rápido e experiência completa.
          </Text>

          {isIOS ? (
            <View style={styles.iosInstructions}>
              <Text style={styles.iosTitle}>Como instalar no iPhone/iPad:</Text>
              <View style={styles.iosStep}>
                <Ionicons name="share-outline" size={24} color="#007AFF" />
                <Text style={styles.iosStepText}>1. Toque no botão Compartilhar</Text>
              </View>
              <View style={styles.iosStep}>
                <Ionicons name="add-circle-outline" size={24} color="#007AFF" />
                <Text style={styles.iosStepText}>2. Selecione "Adicionar à Tela de Início"</Text>
              </View>
              <TouchableOpacity style={styles.dismissButton} onPress={handleDismiss}>
                <Text style={styles.dismissButtonText}>Entendi</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.actions}>
              {deferredPrompt ? (
                <TouchableOpacity style={styles.installButton} onPress={handleInstall}>
                  <Ionicons name="download-outline" size={20} color="#fff" />
                  <Text style={styles.installButtonText}>Instalar App</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.chromeInstructions}>
                  <Text style={styles.chromeText}>
                    Clique no ícone <Ionicons name="ellipsis-vertical" size={16} /> no navegador e selecione "Instalar app" ou "Adicionar à tela inicial"
                  </Text>
                </View>
              )}
              
              <TouchableOpacity style={styles.laterButton} onPress={handleDismiss}>
                <Text style={styles.laterButtonText}>Agora não</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    position: 'relative'
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 8
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 16,
    borderRadius: 20
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center'
  },
  description: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20
  },
  actions: {
    width: '100%',
    gap: 12
  },
  installButton: {
    backgroundColor: '#FF6B00',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8
  },
  installButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  },
  laterButton: {
    paddingVertical: 12,
    alignItems: 'center'
  },
  laterButtonText: {
    color: '#666',
    fontSize: 14
  },
  dismissButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 16,
    width: '100%',
    alignItems: 'center'
  },
  dismissButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  },
  iosInstructions: {
    width: '100%',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16
  },
  iosTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12
  },
  iosStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8
  },
  iosStepText: {
    fontSize: 14,
    color: '#333',
    flex: 1
  },
  chromeInstructions: {
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 12
  },
  chromeText: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
    lineHeight: 20
  }
});
