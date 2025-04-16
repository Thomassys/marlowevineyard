const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { connectDb } = require('../database/connect');
const { refreshVehicleEmbedById } = require('./vehicleEmbedUtils');
const moment = require('moment');

// Stockage temporaire des timers (clé = vehicleId)
const vehicleTimers = new Map();

/**
 * Lance ou relance le cycle de rappel pour un véhicule.
 * @param {string|number} vehicleId                ID interne du véhicule
 * @param {import('discord.js').User} user         Utilisateur qui a pris le véhicule
 * @param {import('discord.js').Client} client     Client Discord
 * @param {number} reminderDelay                   Délai avant le DM de rappel   (ms)
 * @param {number} fallbackDelay                   Délai avant libération auto   (ms)
 */
async function startVehicleReminder(
    vehicleId,
    user,
    client,
    reminderDelay   = 15 * 1000,   // 15 s par défaut (dev) – mettre 2h en prod
    fallbackDelay   = 15 * 1000    // 15 s de grâce (dev) – mettre 10 min en prod
) {
    console.log(`⏳ (start) Timer pour véhicule ${vehicleId} → rappel dans ${reminderDelay} ms`);

    // Supprime un éventuel ancien timer
    if (vehicleTimers.has(vehicleId)) {
        clearTimeout(vehicleTimers.get(vehicleId).timeout);
    }

    const db = await connectDb();
    const [result] = await db.query(
        'SELECT serialNumber, type, threadId FROM vehicles WHERE id = ?',
        [vehicleId]
    );
    const serial   = result[0]?.serialNumber || vehicleId;
    const type     = result[0]?.type        || 'Véhicule';
    const threadId = result[0]?.threadId    || null;

    // --- Timer principal : envoie un DM de rappel ---
    const timeout = setTimeout(async () => {
        try {
            console.log(`📩 Rappel DM → ${user.tag} pour ${serial}`);
            await user.send({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('⏳ Utilisation du véhicule')
                        .setDescription(`Vous utilisez encore le véhicule **${type} - ${serial}**.\nSouhaitez‑vous prolonger son usage ?`)
                        .setColor(0xf1c40f)
                ],
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`extend_15_${vehicleId}`)
                            .setLabel('Prolonger 15s')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId(`extend_30_${vehicleId}`)
                            .setLabel('Prolonger 30s')
                            .setStyle(ButtonStyle.Secondary)
                    )
                ]
            });

            // --- Sous‑timer : libération automatique ---
            const fallback = setTimeout(async () => {
                console.log(`⏰ Libération auto du véhicule ${vehicleId}`);
                const db = await connectDb();
                await db.query('UPDATE vehicles SET available = true WHERE id = ?', [vehicleId]);

                // Clôture d'historique
                const [history] = await db.query(
                    'SELECT * FROM vehicle_history WHERE vehicle_id = ? AND end_time IS NULL ORDER BY start_time DESC LIMIT 1',
                    [vehicleId]
                );
                if (history.length) {
                    const startTime = new Date(history[0].start_time);
                    const endTime   = new Date();
                    const duration  = Math.floor((endTime - startTime) / 1000);
                    await db.query('UPDATE vehicle_history SET end_time = NOW(), duration = ? WHERE id = ?', [duration, history[0].id]);

                    // Message dans le thread d'historique
                    if (threadId) {
                        try {
                            const thread = await client.channels.fetch(threadId);
                            if (thread?.send) {
                                const embed = new EmbedBuilder()
                                    .setTitle('🕒 Libération automatique')
                                    .setColor(0xe74c3c)
                                    .setDescription(`Le véhicule **${type} - ${serial}** a été libéré après inactivité.\n\n📅 Date : ${moment(endTime).format('DD/MM/YYYY')}\n⏱️ Durée : ${Math.floor(duration / 60)} min`);
                                await thread.send({ embeds: [embed] });
                            }
                        } catch (err) {
                            console.warn(`⚠️ Impossible de poster dans le thread ${threadId} :`, err.message);
                        }
                    }
                }

                await user.send(`🚨 Temps écoulé. Le véhicule **${type} - ${serial}** a été automatiquement libéré.`);
                await refreshVehicleEmbedById(vehicleId, client);
                vehicleTimers.delete(vehicleId);
            }, fallbackDelay);

            vehicleTimers.set(vehicleId, { timeout: fallback, start: Date.now(), duration: fallbackDelay });
        } catch (err) {
            console.error(`❌ DM impossible à ${user.tag} :`, err.message);
        }
    }, reminderDelay);

    vehicleTimers.set(vehicleId, { timeout, start: Date.now(), duration: reminderDelay });
}

function cancelVehicleReminder(vehicleId) {
    console.log(`🛑 Annulation timer véhicule ${vehicleId}`);
    if (vehicleTimers.has(vehicleId)) {
        clearTimeout(vehicleTimers.get(vehicleId).timeout);
        vehicleTimers.delete(vehicleId);
    }
}

// ----- Boutons de prolongation -----
async function handleExtendButton(interaction) {
    const [ , seconds, vehicleId ] = interaction.customId.split('_');
    const user   = interaction.user;
    const client = interaction.client;
    const extra  = parseInt(seconds) * 1000; // ms à ajouter

    console.log(`🔄 Prolongation +${seconds}s pour véhicule ${vehicleId}`);

    // Calcule le temps restant s'il y a déjà un timer
    let remaining = 0;
    if (vehicleTimers.has(vehicleId)) {
        const data = vehicleTimers.get(vehicleId);
        clearTimeout(data.timeout);
        remaining = data.start + data.duration - Date.now();
        if (remaining < 0) remaining = 0;
    }

    const newDelay = remaining + extra;

    // Réponse immédiate au clic
    await interaction.reply({ content: `✅ Le véhicule a été prolongé de ${seconds} secondes.`, ephemeral: true });

    // Redémarre un cycle complet avec le nouveau délai cumulé
    await startVehicleReminder(vehicleId, user, client, newDelay, 15 * 1000);
}

module.exports = {
    startVehicleReminder,
    cancelVehicleReminder,
    handleExtendButton
};
