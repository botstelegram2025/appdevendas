const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

let sock = null;
let isConnected = false;
let qrCodeData = null;
let reconnectAttempts = 0;
let isReconnecting = false;
const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY = 10000; // 10 segundos

// Função para limpar sessões antigas
function clearOldSessions() {
    const authPath = path.join(__dirname, 'auth_info');
    try {
        if (fs.existsSync(authPath)) {
            console.log('🧹 Limpando sessões antigas do WhatsApp...');
            fs.rmSync(authPath, { recursive: true, force: true });
            console.log('✅ Sessões antigas removidas');
        }
    } catch (error) {
        console.error('❌ Erro ao limpar sessões:', error);
    }
}

// Função para inicializar o WhatsApp
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
    
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('📱 QR Code gerado!');
            qrCodeData = qr;
            reconnectAttempts = 0; // Reset contador quando gera QR
        }
        
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            
            console.log('❌ Conexão fechada.');
            console.log('📊 Status Code:', statusCode);
            console.log('🔄 Tentativas de reconexão:', reconnectAttempts);
            
            isConnected = false;
            qrCodeData = null;
            
            // Verificar se deve reconectar
            if (!shouldReconnect) {
                console.log('⛔ Usuário fez logout. Aguardando nova solicitação.');
                clearOldSessions();
                reconnectAttempts = 0;
                isReconnecting = false;
                return;
            }
            
            // Limitar tentativas de reconexão
            if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
                console.log('⚠️ Limite de tentativas atingido. Aguardando 30 segundos...');
                isReconnecting = false;
                setTimeout(() => {
                    reconnectAttempts = 0;
                    clearOldSessions();
                    console.log('🔄 Reiniciando conexão após pausa...');
                    connectToWhatsApp();
                }, 30000); // 30 segundos
                return;
            }
            
            // Evitar reconexões simultâneas
            if (isReconnecting) {
                console.log('⏸️ Já está reconectando, aguardando...');
                return;
            }
            
            isReconnecting = true;
            reconnectAttempts++;
            
            // Limpar sessão antiga
            console.log('🧹 Limpando sessão antiga...');
            clearOldSessions();
            
            // Reconectar com delay progressivo
            const delay = RECONNECT_DELAY * reconnectAttempts;
            console.log(`🔄 Reconectando em ${delay/1000} segundos (tentativa ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
            
            setTimeout(() => {
                sock = null;
                isReconnecting = false;
                connectToWhatsApp();
            }, delay);
            
        } else if (connection === 'open') {
            console.log('✅ WhatsApp conectado com sucesso!');
            isConnected = true;
            qrCodeData = null;
            reconnectAttempts = 0;
            isReconnecting = false;
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

// Função para enviar mensagem
async function sendMessage(number, message) {
    if (!isConnected || !sock) {
        throw new Error('WhatsApp não está conectado');
    }
    
    // Formatar número (adicionar @s.whatsapp.net)
    const formattedNumber = number.includes('@') ? number : `${number}@s.whatsapp.net`;
    
    try {
        await sock.sendMessage(formattedNumber, { text: message });
        return { success: true, message: 'Mensagem enviada' };
    } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
        throw error;
    }
}

// API Endpoints
app.get('/status', (req, res) => {
    res.json({
        connected: isConnected,
        hasQR: qrCodeData !== null
    });
});

app.get('/qr', (req, res) => {
    if (qrCodeData) {
        res.json({ qr: qrCodeData });
    } else if (isConnected) {
        res.json({ message: 'Já conectado' });
    } else {
        res.json({ message: 'Aguardando QR Code...' });
    }
});

app.post('/send', async (req, res) => {
    try {
        const { number, message } = req.body;
        
        if (!number || !message) {
            return res.status(400).json({ error: 'Número e mensagem são obrigatórios' });
        }
        
        const result = await sendMessage(number, message);
        res.json(result);
    } catch (error) {
        res.status(500).json({ 
            error: 'Erro ao enviar mensagem', 
            details: error.message 
        });
    }
});

app.post('/send-bulk', async (req, res) => {
    try {
        const { messages } = req.body;
        
        if (!Array.isArray(messages)) {
            return res.status(400).json({ error: 'messages deve ser um array' });
        }
        
        const results = [];
        for (const msg of messages) {
            try {
                await sendMessage(msg.number, msg.message);
                results.push({ number: msg.number, success: true });
            } catch (error) {
                results.push({ number: msg.number, success: false, error: error.message });
            }
        }
        
        res.json({ results });
    } catch (error) {
        res.status(500).json({ 
            error: 'Erro ao enviar mensagens', 
            details: error.message 
        });
    }
});

app.post('/logout', async (req, res) => {
    try {
        console.log('🔄 Desconectando e limpando credenciais...');
        
        // Disconnect socket if connected
        if (sock) {
            try {
                await sock.logout();
            } catch (err) {
                console.log('⚠️ Erro ao fazer logout do socket:', err.message);
            }
        }
        
        // Clear auth folder
        clearOldSessions();
        
        // Reset state
        isConnected = false;
        qrCodeData = null;
        sock = null;
        reconnectAttempts = 0;
        isReconnecting = false;
        
        // Reconnect to generate new QR after a longer delay
        console.log('🔄 Aguardando 5 segundos para gerar novo QR Code...');
        setTimeout(() => {
            connectToWhatsApp();
        }, 5000);
        
        res.json({ 
            success: true, 
            message: 'Desconectado. Novo QR Code será gerado em 5 segundos.' 
        });
    } catch (error) {
        console.error('Erro ao desconectar:', error);
        res.status(500).json({ 
            error: 'Erro ao desconectar', 
            details: error.message 
        });
    }
});

// Iniciar servidor
const PORT = 3001;
app.listen(PORT, () => {
    console.log(`🚀 Serviço WhatsApp rodando na porta ${PORT}`);
    
    // Limpar sessões antigas ao iniciar
    console.log('🔄 Iniciando nova sessão WhatsApp...');
    clearOldSessions();
    
    // Conectar ao WhatsApp com nova sessão
    connectToWhatsApp();
});
