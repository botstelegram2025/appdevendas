import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { BACKEND_URL } from '../config';

interface User {
  id: string;
  name: string;
  phone: string;
  email?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAdmin: boolean;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (name: string, phone: string, cpf: string, email: string, password: string) => Promise<void>;
  adminLogin: (cpf: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('token');
      const storedUser = await AsyncStorage.getItem('user');
      const storedIsAdmin = await AsyncStorage.getItem('isAdmin');
      
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        setIsAdmin(storedIsAdmin === 'true');
        axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
      }
    } catch (error) {
      console.error('Error loading auth:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (identifier: string, password: string) => {
    try {
      const response = await axios.post(`${BACKEND_URL}/api/auth/login`, {
        identifier,
        password
      });
      
      const { token: newToken, user: newUser } = response.data;
      
      await AsyncStorage.setItem('token', newToken);
      await AsyncStorage.setItem('user', JSON.stringify(newUser));
      await AsyncStorage.setItem('isAdmin', 'false');
      
      setToken(newToken);
      setUser(newUser);
      setIsAdmin(false);
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Erro ao fazer login');
    }
  };

  const register = async (name: string, phone: string, cpf: string, email: string, password: string) => {
    try {
      console.log('Register - BACKEND_URL:', BACKEND_URL);
      console.log('Register - Data:', { name, phone, cpf, email, password });
      const response = await axios.post(`${BACKEND_URL}/api/auth/register`, {
        name,
        phone,
        cpf,
        email: email || undefined,
        password
      });
      console.log('Register - Response:', response.data);
      
      const { token: newToken, user: newUser } = response.data;
      
      await AsyncStorage.setItem('token', newToken);
      await AsyncStorage.setItem('user', JSON.stringify(newUser));
      await AsyncStorage.setItem('isAdmin', 'false');
      
      setToken(newToken);
      setUser(newUser);
      setIsAdmin(false);
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Erro ao criar conta');
    }
  };

  const adminLogin = async (cpf: string, password: string) => {
    try {
      console.log('AdminLogin - BACKEND_URL:', BACKEND_URL);
      console.log('AdminLogin - Data:', { cpf, password });
      const response = await axios.post(`${BACKEND_URL}/api/admin/login`, {
        cpf,
        password
      });
      console.log('AdminLogin - Response:', response.data);
      
      const { token: newToken, admin } = response.data;
      
      await AsyncStorage.setItem('token', newToken);
      await AsyncStorage.setItem('user', JSON.stringify({ id: admin.id, name: admin.name, phone: '', email: '' }));
      await AsyncStorage.setItem('isAdmin', 'true');
      
      setToken(newToken);
      setUser({ id: admin.id, name: admin.name, phone: '', email: '' });
      setIsAdmin(true);
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Erro ao fazer login admin');
    }
  };

  const logout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    await AsyncStorage.removeItem('isAdmin');
    setToken(null);
    setUser(null);
    setIsAdmin(false);
    delete axios.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{ user, token, isAdmin, loading, login, register, adminLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};