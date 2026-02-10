/**
 * Saweria Service
 * Koneksi Socket.io ke Saweria untuk menerima event donasi
 */

const { io } = require('socket.io-client');
const { SAWERIA_STREAM_KEY } = require('../config');
const { handleDonation } = require('../modules/donation');

let socket = null;

/**
 * Connect ke Saweria socket server
 */
function connectToSaweria() {
    if (!SAWERIA_STREAM_KEY) {
        console.error('❌ SAWERIA_STREAM_KEY tidak ditemukan di .env');
        return;
    }

    console.log('🔗 Menghubungkan ke Saweria...');
    
    socket = io('https://events.saweria.co', {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
        console.log('✅ Terhubung ke Saweria Socket');
        socket.emit('join', SAWERIA_STREAM_KEY);
    });

    socket.on('disconnect', () => {
        console.log('⚠️ Terputus dari Saweria Socket, mencoba menghubungkan kembali...');
    });

    socket.on('donations', async (data) => {
        console.log('💰 Donasi diterima:', data);
        await handleDonation(data, false);
    });

    socket.on('error', (error) => {
        console.error('❌ Error Saweria Socket:', error);
    });
}

/**
 * Disconnect dari Saweria
 */
function disconnectFromSaweria() {
    if (socket) {
        socket.disconnect();
        socket = null;
        console.log('📴 Terputus dari Saweria');
    }
}

/**
 * Cek status koneksi
 * @returns {boolean}
 */
function isConnected() {
    return socket && socket.connected;
}

module.exports = {
    connectToSaweria,
    disconnectFromSaweria,
    isConnected,
};
