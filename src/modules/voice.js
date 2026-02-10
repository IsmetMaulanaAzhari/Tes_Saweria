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
const path = require('path');
const fs = require('fs');
const { SOUND_FILE } = require('../config');

// State variables
let audioPlayer = null;
let voiceConnection = null;

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
        audioPlayer.play(resource);
        console.log('🔔 Sound alert dimainkan');
    } catch (error) {
        console.error('❌ Error playing sound:', error);
    }
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
}

module.exports = {
    joinVoice,
    leaveVoice,
    playSoundAlert,
    isInVoiceChannel,
    getVoiceConnection,
    cleanup,
};
