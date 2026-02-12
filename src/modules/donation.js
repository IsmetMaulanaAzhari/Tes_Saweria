/**
 * Donation Module
 * Mengelola pemrosesan dan notifikasi donasi
 */

const { EmbedBuilder } = require('discord.js');
const { dbHelpers } = require('../database');
const { formatRupiah, getMilestone } = require('../utils/helpers');
const { censorMessage } = require('./blacklist');
const { playSoundAlert, isInVoiceChannel, speakTTS } = require('./voice');
const { checkGoalProgress } = require('./goals');
const { DISCORD_CHANNEL_ID, ENABLE_SOUND_ALERT, ENABLE_TTS, TOP_DONATOR_ROLE_ID, GUILD_ID } = require('../config');

let discordClient = null;

/**
 * Set Discord client untuk digunakan module ini
 * @param {Client} client - Discord client instance
 */
function setClient(client) {
    discordClient = client;
}

/**
 * Update role top donatur
 */
async function updateTopDonatorRole() {
    if (!TOP_DONATOR_ROLE_ID || !GUILD_ID || !discordClient) return;
    
    try {
        const guild = await discordClient.guilds.fetch(GUILD_ID);
        const role = await guild.roles.fetch(TOP_DONATOR_ROLE_ID);
        if (!role) return;
        
        // Get current top donor
        const topDonor = dbHelpers.getTopDonor.get();
        if (!topDonor) return;
        
        // Remove role from all members who have it
        const membersWithRole = role.members;
        for (const [memberId, member] of membersWithRole) {
            await member.roles.remove(role);
        }
        
        // Log top donor info
        console.log(`🏆 Top donatur saat ini: ${topDonor.donor_name} dengan total ${formatRupiah(topDonor.total)}`);
        
    } catch (error) {
        console.error('❌ Error updating top donator role:', error);
    }
}

/**
 * Handle donasi masuk
 * @param {object} data - Data donasi dari Saweria
 * @param {boolean} isTest - Apakah ini test donasi
 */
async function handleDonation(data, isTest = false) {
    try {
        if (!discordClient) {
            console.error('❌ Discord client tidak tersedia');
            return;
        }
        
        const channel = await discordClient.channels.fetch(DISCORD_CHANNEL_ID);
        if (!channel) {
            console.error('❌ Channel tidak ditemukan!');
            return;
        }

        // Parse data donasi
        const donation = {
            id: data.id || Date.now().toString(),
            donorName: data.donator || 'Anonim',
            amount: data.amount || 0,
            message: data.message || '',
            media: data.media || null, // URL media/GIF
            timestamp: new Date(),
        };

        // Simpan ke database (hanya jika bukan test)
        if (!isTest) {
            dbHelpers.addDonation.run(
                donation.id,
                donation.donorName,
                donation.amount,
                donation.message
            );
        }

        // Check milestone
        const milestone = getMilestone(donation.amount);
        
        // Buat embed notifikasi
        const embed = new EmbedBuilder()
            .setColor(milestone ? 0xFFD700 : 0xFF6B35)
            .setTitle(milestone ? `${milestone.emoji} ${milestone.title}` : '🎉 Donasi Baru!')
            .setDescription(`**${donation.donorName}** telah berdonasi!`)
            .addFields(
                { name: '💵 Jumlah', value: formatRupiah(donation.amount), inline: true },
                { name: '📅 Waktu', value: `<t:${Math.floor(donation.timestamp.getTime() / 1000)}:R>`, inline: true },
            )
            .setThumbnail('https://saweria.co/favicon.ico')
            .setFooter({ text: isTest ? '⚠️ INI ADALAH TEST DONASI' : 'Terima kasih atas dukungannya! 💖' })
            .setTimestamp();

        // Tambahkan pesan donatur jika ada (dengan filter blacklist)
        if (donation.message) {
            const censoredMessage = censorMessage(donation.message);
            const wasFiltered = censoredMessage !== donation.message;
            embed.addFields({ 
                name: wasFiltered ? '💬 Pesan (difilter)' : '💬 Pesan', 
                value: censoredMessage 
            });
        }

        // Tambahkan media/GIF jika ada
        if (donation.media && donation.media.src) {
            embed.setImage(donation.media.src);
            embed.addFields({ name: '🎬 Media', value: `[Lihat Media](${donation.media.src})` });
        }

        // Kirim notifikasi
        const messageContent = milestone && !isTest ? '@everyone' : undefined;
        await channel.send({ content: messageContent, embeds: [embed] });
        
        console.log('✅ Notifikasi donasi terkirim ke Discord');

        // Voice channel features (hanya jika bukan test)
        if (isInVoiceChannel() && !isTest) {
            // Play sound alert jika aktif
            if (ENABLE_SOUND_ALERT) {
                await playSoundAlert();
            }
            
            // TTS: Bacakan pesan donasi
            if (ENABLE_TTS) {
                // Format pesan untuk TTS
                const amountText = `${Math.floor(donation.amount / 1000)} ribu rupiah`;
                let ttsMessage = `${donation.donorName} donasi ${amountText}.`;
                
                // Tambahkan pesan donatur jika ada
                if (donation.message) {
                    const censoredMsg = censorMessage(donation.message);
                    ttsMessage += ` Pesan: ${censoredMsg}`;
                }
                
                await speakTTS(ttsMessage);
            }
        }

        // Update goal progress jika ada
        if (!isTest) {
            await checkGoalProgress(channel, donation.amount);
            await updateTopDonatorRole();
        }
        
    } catch (error) {
        console.error('❌ Error mengirim notifikasi:', error);
    }
}

module.exports = {
    setClient,
    handleDonation,
    updateTopDonatorRole,
};
