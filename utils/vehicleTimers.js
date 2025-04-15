const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { connectDb } = require('../database/connect');
const { refreshVehicleEmbedById } = require('./vehicleEmbedUtils');
const moment = require('moment');

// Stockage temporaire des timers
const vehicleTimers = new Map();

async function startVehicleReminder(vehicleId, user, client) {
    console.log(`⏳ Démarrage du timer pour le véhicule ID ${vehicleId}`);

    if (vehicleTimers.has(vehicleId)) {
        clearTimeout(vehicleTimers.get(vehicleId).timeout);
    }

    const db = await connectDb();
    const [result] = await db.query("SELECT serialNumber, type, threadId FROM vehicles WHERE id = ?", [vehicleId]);
    const serial = result[0]?.serialNumber || vehicleId;
    const type = result[0]?.type || 'Véhicule';
    const threadId = result[0]?.threadId;

    const timeout = setTimeout(async () => {
        try {
            console.log(`📩 Envoi du rappel à ${user.tag} pour le véhicule ${serial}`);
            const dm = await user.send({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('⏳ Utilisation du véhicule')
                        .setDescription(`Vous utilisez encore le véhicule **${type} - ${serial}**.\nSouhaitez-vous prolonger son usage ?`)
                        .setColor(0xf1c40f)
                ],
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`extend_15s_${vehicleId}`)
                            .setLabel('Prolonger 15s')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId(`extend_30s_${vehicleId}`)
                            .setLabel('Prolonger 30s')
                            .setStyle(ButtonStyle.Secondary)
                    )
                ]
            });

            const fallback = setTimeout(async () => {
                console.log(`⏰ Temps écoulé sans réponse pour le véhicule ID ${vehicleId}`);
                const db = await connectDb();
                await db.query("UPDATE vehicles SET available = true WHERE id = ?", [vehicleId]);

                const [history] = await db.query("SELECT * FROM vehicle_history WHERE vehicle_id = ? AND end_time IS NULL ORDER BY start_time DESC LIMIT 1", [vehicleId]);
                if (history.length > 0) {
                    const startTime = new Date(history[0].start_time);
                    const endTime = new Date();
                    const duration = Math.floor((endTime - startTime) / 1000);
                    await db.query("UPDATE vehicle_history SET end_time = NOW(), duration = ? WHERE id = ?", [duration, history[0].id]);

                    if (threadId) {
                        try {
                            const thread = await client.channels.fetch(threadId);
                            if (thread && thread.send) {
                                const embed = new EmbedBuilder()
                                    .setTitle("🕒 Libération automatique")
                                    .setColor(0xe74c3c)
                                    .setDescription(`Le véhicule **${type} - ${serial}** a été automatiquement libéré après inactivité.\n\n📅 • Date : ${moment(endTime).format('DD/MM/YYYY')}\n⏱️ • Durée : ${Math.floor(duration / 60)} min`);
                                await thread.send({ embeds: [embed] });
                            }
                        } catch (err) {
                            console.warn(`⚠️ Impossible d'envoyer dans le thread ${threadId}:`, err.message);
                        }
                    }
                }

                await user.send(`🚨 Temps écoulé. Le véhicule **${type} - ${serial}** a été automatiquement libéré.`);
                await refreshVehicleEmbedById(vehicleId, client);
                vehicleTimers.delete(vehicleId);
            }, 15 * 1000);

            vehicleTimers.set(vehicleId, { timeout: fallback, start: Date.now(), duration: 15 * 1000 });
        } catch (err) {
            console.error(`❌ Impossible d'envoyer un DM à ${user.tag}:`, err.message);
        }
    }, 15 * 1000);

    vehicleTimers.set(vehicleId, { timeout, start: Date.now(), duration: 15 * 1000 });
}

function cancelVehicleReminder(vehicleId) {
    console.log(`🛑 Annulation du timer pour le véhicule ID ${vehicleId}`);
    if (vehicleTimers.has(vehicleId)) {
        clearTimeout(vehicleTimers.get(vehicleId).timeout);
        vehicleTimers.delete(vehicleId);
    }
}

async function handleExtendButton(interaction) {
    const [_, seconds, vehicleId] = interaction.customId.split('_');
    const user = interaction.user;
    const client = interaction.client;
    const extensionMs = parseInt(seconds) * 1000;

    console.log(`🔄 Prolongation demandée de ${seconds}s pour le véhicule ID ${vehicleId}`);

    if (vehicleTimers.has(vehicleId)) {
        clearTimeout(vehicleTimers.get(vehicleId).timeout);
    }

    await interaction.reply({ content: `✅ Le véhicule a été prolongé de ${seconds} secondes.`, ephemeral: true });

    // Redémarrer le cycle complet de rappel
    await startVehicleReminder(vehicleId, user, client);
}

module.exports = {
    startVehicleReminder,
    cancelVehicleReminder,
    handleExtendButton
};
