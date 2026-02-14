/**
 * Thank You Module
 * Pesan terima kasih yang dapat dikustomisasi
 */

const { EmbedBuilder } = require('discord.js');
const { dbHelpers } = require('../database');
const { formatRupiah } = require('../utils/helpers');

// Default thank you templates
const DEFAULT_TEMPLATES = {
    small: '🎉 Terima kasih {name}! Donasimu sebesar {amount} sangat berarti!',
    medium: '🌟 WOW! {name} baru saja donasi {amount}! Terima kasih banyak! 💕',
    large: '🔥🔥🔥 AMAZING! {name} memberikan {amount}! Kamu luar biasa! 🎊✨',
    milestone: '🎆 MILESTONE! {name} membantu mencapai target dengan donasi {amount}! 🏆'
};

// Tier thresholds (can be customized)
const DEFAULT_TIERS = {
    small: 0,      // 0 - 49,999
    medium: 50000, // 50,000 - 99,999
    large: 100000  // 100,000+
};

/**
 * Get thank you settings from database
 * @returns {object} Thank you settings
 */
function getThankYouSettings() {
    const settings = dbHelpers.getSetting.get('thankyou_settings');
    if (settings) {
        try {
            return JSON.parse(settings.value);
        } catch {
            return { templates: DEFAULT_TEMPLATES, tiers: DEFAULT_TIERS };
        }
    }
    return { templates: DEFAULT_TEMPLATES, tiers: DEFAULT_TIERS };
}

/**
 * Save thank you settings to database
 * @param {object} settings - Settings to save
 */
function saveThankYouSettings(settings) {
    dbHelpers.setSetting.run('thankyou_settings', JSON.stringify(settings));
}

/**
 * Set a custom template for a tier
 * @param {string} tier - Tier name (small/medium/large/milestone)
 * @param {string} template - Template string
 */
function setTemplate(tier, template) {
    const settings = getThankYouSettings();
    settings.templates[tier] = template;
    saveThankYouSettings(settings);
}

/**
 * Set tier threshold
 * @param {string} tier - Tier name (medium/large)
 * @param {number} amount - Threshold amount
 */
function setTierThreshold(tier, amount) {
    const settings = getThankYouSettings();
    settings.tiers[tier] = amount;
    saveThankYouSettings(settings);
}

/**
 * Reset templates to default
 */
function resetTemplates() {
    saveThankYouSettings({ templates: DEFAULT_TEMPLATES, tiers: DEFAULT_TIERS });
}

/**
 * Get tier based on amount
 * @param {number} amount - Donation amount
 * @returns {string} Tier name
 */
function getTier(amount) {
    const settings = getThankYouSettings();
    const tiers = settings.tiers || DEFAULT_TIERS;
    
    if (amount >= tiers.large) return 'large';
    if (amount >= tiers.medium) return 'medium';
    return 'small';
}

/**
 * Replace template variables
 * @param {string} template - Template string
 * @param {object} data - Data object with replacement values
 * @returns {string} Processed string
 */
function processTemplate(template, data) {
    return template
        .replace(/{name}/gi, data.name || 'Anonymous')
        .replace(/{amount}/gi, formatRupiah(data.amount || 0))
        .replace(/{message}/gi, data.message || '')
        .replace(/{tier}/gi, data.tier || '')
        .replace(/{date}/gi, new Date().toLocaleDateString('id-ID'))
        .replace(/{time}/gi, new Date().toLocaleTimeString('id-ID'));
}

/**
 * Generate thank you message for a donation
 * @param {object} donation - Donation object
 * @param {boolean} isMilestone - Is this a milestone donation
 * @returns {string} Thank you message
 */
function generateThankYouMessage(donation, isMilestone = false) {
    const settings = getThankYouSettings();
    const templates = settings.templates || DEFAULT_TEMPLATES;
    
    const tier = isMilestone ? 'milestone' : getTier(donation.amount);
    const template = templates[tier] || DEFAULT_TEMPLATES[tier];
    
    return processTemplate(template, {
        name: donation.donator || 'Anonymous',
        amount: donation.amount,
        message: donation.message || '',
        tier: tier
    });
}

/**
 * Generate thank you embed message
 * @param {object} donation - Donation object
 * @param {boolean} isMilestone - Is this a milestone donation
 * @returns {EmbedBuilder} Thank you embed
 */
function generateThankYouEmbed(donation, isMilestone = false) {
    const tier = isMilestone ? 'milestone' : getTier(donation.amount);
    const message = generateThankYouMessage(donation, isMilestone);
    
    // Color based on tier
    const colors = {
        small: 0x00FF00,
        medium: 0xFFD700,
        large: 0xFF6B35,
        milestone: 0xFF00FF
    };
    
    const embed = new EmbedBuilder()
        .setColor(colors[tier] || 0x00FF00)
        .setDescription(message);
    
    if (donation.message) {
        embed.addFields({ name: '💬 Pesan:', value: donation.message });
    }
    
    return embed;
}

/**
 * Generate settings preview embed
 * @returns {EmbedBuilder} Settings embed
 */
function generateSettingsEmbed() {
    const settings = getThankYouSettings();
    const templates = settings.templates || DEFAULT_TEMPLATES;
    const tiers = settings.tiers || DEFAULT_TIERS;
    
    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('💌 Thank You Settings')
        .setDescription('Template pesan terima kasih untuk setiap tier donasi')
        .addFields(
            { 
                name: `🟢 Small (< ${formatRupiah(tiers.medium)})`, 
                value: `\`\`\`${templates.small}\`\`\``,
                inline: false 
            },
            { 
                name: `🟡 Medium (${formatRupiah(tiers.medium)} - ${formatRupiah(tiers.large - 1)})`, 
                value: `\`\`\`${templates.medium}\`\`\``,
                inline: false 
            },
            { 
                name: `🟠 Large (>= ${formatRupiah(tiers.large)})`, 
                value: `\`\`\`${templates.large}\`\`\``,
                inline: false 
            },
            { 
                name: '🎆 Milestone', 
                value: `\`\`\`${templates.milestone}\`\`\``,
                inline: false 
            },
        )
        .addFields({
            name: '📝 Variables',
            value: '`{name}` - Nama donatur\n`{amount}` - Jumlah donasi\n`{message}` - Pesan donatur\n`{date}` - Tanggal\n`{time}` - Waktu',
            inline: false
        })
        .setFooter({ text: 'Gunakan /thankyou set <tier> <template> untuk mengubah' })
        .setTimestamp();
    
    return embed;
}

module.exports = {
    getThankYouSettings,
    saveThankYouSettings,
    setTemplate,
    setTierThreshold,
    resetTemplates,
    getTier,
    processTemplate,
    generateThankYouMessage,
    generateThankYouEmbed,
    generateSettingsEmbed,
    DEFAULT_TEMPLATES,
    DEFAULT_TIERS
};
