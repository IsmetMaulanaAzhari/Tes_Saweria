/**
 * Voice Module
 * Mengelola koneksi voice channel dan sound alert
 */

const { 
    joinVoiceChannel, 
    createAudioPlayer, 
    createAudioResource, 
    AudioPlayerStatus, 
    VoiceConnectionStatus, 
    entersState 
} = require('@discordjs/voice');
const googleTTS = require('google-tts-api');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { SOUND_FILE, TTS_LANGUAGE } = require('../config');

// State variables
let audioPlayer = null;
let voiceConnection = null;
let audioQueue = [];
let isPlaying = false;

/**
 * Bergabung ke voice channel
 * @param {VoiceChannel} channel - Discord voice channel
 * @returns {Promise<boolean>} Berhasil atau tidak
 */
async function joinVoice(channel) {
    try {
        voiceConnection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
        });
        
        audioPlayer = createAudioPlayer();
        voiceConnection.subscribe(audioPlayer);
        
        await entersState(voiceConnection, VoiceConnectionStatus.Ready, 30_000);
        console.log(`🔊 Bot bergabung ke voice channel: ${channel.name}`);
        return true;
    } catch (error) {
        console.error('❌ Error joining voice channel:', error);
        return false;
    }
}

/**
 * Keluar dari voice channel
 * @returns {boolean} Berhasil atau tidak
 */
function leaveVoice() {
    if (voiceConnection) {
        voiceConnection.destroy();
        voiceConnection = null;
        audioPlayer = null;
        console.log('🔇 Bot keluar dari voice channel');
        return true;
    }
    return false;
}

/**
 * Mainkan sound alert
 * @returns {Promise<void>}
 */
async function playSoundAlert() {
    if (!audioPlayer || !voiceConnection) return;
    
    // Sound file di root project
    const soundPath = path.join(__dirname, '..', '..', SOUND_FILE);
    if (!fs.existsSync(soundPath)) {
        console.warn(`⚠️ File suara tidak ditemukan: ${soundPath}`);
        return;
    }
    
    try {
        const resource = createAudioResource(soundPath);
        await playAudio(resource);
        console.log('🔔 Sound alert dimainkan');
    } catch (error) {
        console.error('❌ Error playing sound:', error);
    }
}

/**
 * Play audio dengan queue system
 * @param {AudioResource} resource - Audio resource to play
 * @returns {Promise<void>}
 */
function playAudio(resource) {
    return new Promise((resolve, reject) => {
        if (!audioPlayer) {
            reject(new Error('Audio player tidak tersedia'));
            return;
        }
        
        audioQueue.push({ resource, resolve, reject });
        processQueue();
    });
}

/**
 * Process audio queue
 */
function processQueue() {
    if (isPlaying || audioQueue.length === 0) return;
    
    isPlaying = true;
    const { resource, resolve, reject } = audioQueue.shift();
    
    try {
        audioPlayer.play(resource);
        
        const onIdle = () => {
            audioPlayer.removeListener(AudioPlayerStatus.Idle, onIdle);
            audioPlayer.removeListener('error', onError);
            isPlaying = false;
            resolve();
            processQueue();
        };
        
        const onError = (error) => {
            audioPlayer.removeListener(AudioPlayerStatus.Idle, onIdle);
            audioPlayer.removeListener('error', onError);
            isPlaying = false;
            reject(error);
            processQueue();
        };
        
        audioPlayer.once(AudioPlayerStatus.Idle, onIdle);
        audioPlayer.once('error', onError);
    } catch (error) {
        isPlaying = false;
        reject(error);
        processQueue();
    }
}

/**
 * Generate TTS audio dan mainkan di voice channel
 * @param {string} text - Text yang akan dibacakan
 * @param {string} lang - Bahasa (default: id)
 * @returns {Promise<void>}
 */
async function speakTTS(text, lang = TTS_LANGUAGE) {
    if (!audioPlayer || !voiceConnection) {
        console.warn('⚠️ Bot tidak di voice channel untuk TTS');
        return;
    }
    
    if (!text || text.trim().length === 0) {
        return;
    }
    
    try {
        // Batasi panjang text untuk TTS (max 200 chars per request)
        const maxLength = 200;
        const textParts = [];
        
        // Split text menjadi bagian-bagian yang lebih kecil
        let remainingText = text.trim();
        while (remainingText.length > 0) {
            if (remainingText.length <= maxLength) {
                textParts.push(remainingText);
                break;
            }
            
            // Cari titik potong yang baik (spasi, koma, titik)
            let cutIndex = maxLength;
            const lastSpace = remainingText.lastIndexOf(' ', maxLength);
            const lastComma = remainingText.lastIndexOf(',', maxLength);
            const lastPeriod = remainingText.lastIndexOf('.', maxLength);
            
            cutIndex = Math.max(lastSpace, lastComma, lastPeriod);
            if (cutIndex <= 0) cutIndex = maxLength;
            
            textParts.push(remainingText.substring(0, cutIndex).trim());
            remainingText = remainingText.substring(cutIndex).trim();
        }
        
        // Generate dan mainkan setiap bagian
        for (const part of textParts) {
            if (part.length === 0) continue;
            
            const url = googleTTS.getAudioUrl(part, {
                lang: lang,
                slow: false,
                host: 'https://translate.google.com',
            });
            
            // Download dan play audio
            await playTTSFromUrl(url);
        }
        
        console.log('🗣️ TTS selesai dimainkan');
    } catch (error) {
        console.error('❌ Error TTS:', error);
    }
}

/**
 * Download dan play TTS dari URL
 * @param {string} url - URL audio TTS
 * @returns {Promise<void>}
 */
function playTTSFromUrl(url) {
    return new Promise((resolve, reject) => {
        const tempFile = path.join(__dirname, '..', '..', `temp_tts_${Date.now()}.mp3`);
        const file = fs.createWriteStream(tempFile);
        
        https.get(url, (response) => {
            response.pipe(file);
            
            file.on('finish', async () => {
                file.close();
                
                try {
                    const resource = createAudioResource(tempFile);
                    await playAudio(resource);
                    
                    // Hapus temp file setelah selesai
                    setTimeout(() => {
                        fs.unlink(tempFile, () => {});
                    }, 1000);
                    
                    resolve();
                } catch (error) {
                    fs.unlink(tempFile, () => {});
                    reject(error);
                }
            });
        }).on('error', (error) => {
            fs.unlink(tempFile, () => {});
            reject(error);
        });
    });
}

/**
 * Cek apakah bot sedang di voice channel
 * @returns {boolean}
 */
function isInVoiceChannel() {
    return voiceConnection !== null;
}

/**
 * Dapatkan voice connection
 * @returns {VoiceConnection|null}
 */
function getVoiceConnection() {
    return voiceConnection;
}

/**
 * Cleanup saat shutdown
 */
function cleanup() {
    if (voiceConnection) {
        voiceConnection.destroy();
        voiceConnection = null;
        audioPlayer = null;
    }
    audioQueue = [];
    isPlaying = false;
}

module.exports = {
    joinVoice,
    leaveVoice,
    playSoundAlert,
    speakTTS,
    isInVoiceChannel,
    getVoiceConnection,
    cleanup,
};
