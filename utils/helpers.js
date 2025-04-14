const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const moment = require('moment');
const { connectDb } = require('../database/connect');
require('dotenv').config();

const DIRECTION_ROLE_ID = process.env.DIRECTION_ROLE_ID;
const RESPONSABLE_ROLE_ID = process.env.RESPONSABLE_ROLE_ID;

function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours > 0 ? `${hours}h ` : ''}${minutes}min`;
}

async function handleVehicleButtons(interaction) {
    const db = await connectDb();
    try {
        await interaction.deferUpdate();
        const [action, vehicleId] = interaction.customId.split('_');

        if (action === 'use') {
            await db.query("UPDATE vehicles SET available = false, lastUsedBy = ?, lastUsedAt = NOW() WHERE id = ?", [interaction.user.id, vehicleId]);
            await db.query("INSERT INTO vehicle_history (vehicle_id, user_id, start_time) VALUES (?, ?, NOW())", [vehicleId, interaction.user.id]);
        } else if (action === 'release') {
            const [vehicles] = await db.query("SELECT * FROM vehicles WHERE id = ?", [vehicleId]);
            const vehicle = vehicles[0];

            if (vehicle.lastUsedBy !== interaction.user.id && !interaction.member.roles.cache.has(DIRECTION_ROLE_ID) && !interaction.member.roles.cache.has(RESPONSABLE_ROLE_ID)) {
                await interaction.followUp({ content: `❌ Vous n'avez pas l'autorisation de reposer ce véhicule.`, ephemeral: true });
                return;
            }

            await db.query("UPDATE vehicles SET available = true WHERE id = ?", [vehicleId]);
            const [history] = await db.query("SELECT * FROM vehicle_history WHERE vehicle_id = ? AND end_time IS NULL ORDER BY start_time DESC LIMIT 1", [vehicleId]);
            if (history.length > 0) {
                const startTime = new Date(history[0].start_time);
                const endTime = new Date();
                const duration = Math.floor((endTime - startTime) / 1000);
                await db.query("UPDATE vehicle_history SET end_time = NOW(), duration = ? WHERE id = ?", [duration, history[0].id]);
                await postUsageToThread(interaction, vehicleId, history[0].user_id, startTime, endTime, duration, interaction.user.id);
            }
        }

        await updateVehicleEmbed(interaction);
    } catch (error) {
        console.error('❌ Erreur bouton interaction :', error);
    }
}

async function updateVehicleEmbed(interaction) {
    const db = await connectDb();
    const vehicleId = interaction.customId.split('_')[1];
    const [vehicles] = await db.query("SELECT * FROM vehicles WHERE id = ?", [vehicleId]);
    const vehicle = vehicles[0];
    const isAvailable = Boolean(vehicle.available);
    const lastUsedAtFormatted = vehicle.lastUsedAt ? moment(vehicle.lastUsedAt).format('DD/MM/YYYY à HH:mm') : 'Jamais';

    const embed = new EmbedBuilder()
        .setTitle(`${vehicle.type} - ${vehicle.serialNumber}`)
        .setColor(0x00AE86)
        .setDescription(`🚗 Plaque: ${vehicle.plate}
🆔 Numéro de série: ${vehicle.serialNumber}
📌 Disponible: ${isAvailable ? '✅' : '❌'}
👤 Dernier usage: <@${vehicle.lastUsedBy}> le ${lastUsedAtFormatted}`);

    if (vehicle.imageUrl) {
        embed.setThumbnail(vehicle.imageUrl);
    }

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`use_${vehicle.id}`)
            .setLabel("Utiliser le véhicule")
            .setStyle(ButtonStyle.Success)
            .setDisabled(!isAvailable),

        new ButtonBuilder()
            .setCustomId(`release_${vehicle.id}`)
            .setLabel("Reposer le véhicule")
            .setStyle(ButtonStyle.Danger)
            .setDisabled(isAvailable)
    );

    try {
        await interaction.editReply({ embeds: [embed], components: [row] });
    } catch (err) {
        console.warn('⚠️ Interaction expirée ou déjà répondue.');
    }
}

async function sendVehiclesEmbeds(interaction, filterType = null) {
    const db = await connectDb();
    await interaction.deferReply({ ephemeral: true });

    const [vehicles] = await db.query("SELECT * FROM vehicles");

    let filteredVehicles = vehicles;
    if (filterType === 'Tractor2') {
        filteredVehicles = vehicles.filter(v => v.type === 'Tractor2');
    } else if (filterType === 'Graintrailer') {
        filteredVehicles = vehicles.filter(v => v.type === 'Graintrailer');
    } else if (filterType === 'autres') {
        filteredVehicles = vehicles.filter(v => v.type !== 'Tractor2' && v.type !== 'Graintrailer');
    }

    for (const vehicle of filteredVehicles) {
        const isAvailable = Boolean(vehicle.available);
        const lastUsedAtFormatted = vehicle.lastUsedAt ? moment(vehicle.lastUsedAt).format('DD/MM/YYYY à HH:mm') : 'Jamais';

        const embed = new EmbedBuilder()
            .setTitle(`${vehicle.type} - ${vehicle.serialNumber}`)
            .setColor(0x00AE86)
            .setDescription(`🆔 Numéro de série: ${vehicle.serialNumber}
🚗 Plaque: ${vehicle.plate}
📌 Disponible: ${isAvailable ? '✅' : '❌'}
👤 Dernier usage: <@${vehicle.lastUsedBy}> le ${lastUsedAtFormatted}`);

        if (vehicle.imageUrl) {
            embed.setThumbnail(vehicle.imageUrl);
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`use_${vehicle.id}`)
                .setLabel("Utiliser le véhicule")
                .setStyle(ButtonStyle.Success)
                .setDisabled(!isAvailable),

            new ButtonBuilder()
                .setCustomId(`release_${vehicle.id}`)
                .setLabel("Reposer le véhicule")
                .setStyle(ButtonStyle.Danger)
                .setDisabled(isAvailable)
        );

        const message = await interaction.channel.send({ embeds: [embed], components: [row] });

        try {
            const thread = await message.startThread({
                name: `Historique - ${vehicle.serialNumber}`,
                autoArchiveDuration: 1440,
            });

            const historyEmbed = new EmbedBuilder()
                .setTitle("📝 Historique d'utilisation")
                .setColor(0x3498db)
                .setDescription("Aucune utilisation pour le moment.");

            await thread.send({ embeds: [historyEmbed] });
        } catch (error) {
            console.error(`❌ Impossible de créer le thread pour ${vehicle.serialNumber}:`, error.message);
            await interaction.channel.send(`⚠️ Impossible de créer le thread pour **${vehicle.type} - ${vehicle.serialNumber}**.`);
        }

        await new Promise(resolve => setTimeout(resolve, 500));
    }

    await interaction.editReply({ content: "Les véhicules ont été affichés." });
}

async function postUsageToThread(interaction, vehicleId, userId, startTime, endTime, duration, releaserId = null) {
    const db = await connectDb();
    const [vehicles] = await db.query("SELECT * FROM vehicles WHERE id = ?", [vehicleId]);
    const vehicle = vehicles[0];
    const threadName = `Historique - ${vehicle.serialNumber}`;
    const threads = await interaction.channel.threads.fetch();
    const thread = threads.threads.find(t => t.name === threadName);

    if (!thread) return;
    if (thread.archived) await thread.setArchived(false);

    let description = `👤 • Utilisateur: <@${userId}>
📅 • Date: ${moment(endTime).format('DD/MM/YYYY')}
🕒 • Départ du véhicule : ${moment(startTime).format('HH:mm')}
🕒 • Repose du véhicule : ${moment(endTime).format('HH:mm')}
⏱️ • Durée: ${formatDuration(duration)}`;
    if (releaserId && releaserId !== userId) {
        description += `\n🔄 • Reposé par: <@${releaserId}>`;
    }

    const embed = new EmbedBuilder()
        .setTitle("📝 Historique d'utilisation")
        .setColor(0x3498db)
        .setDescription(description);

    await thread.send({ embeds: [embed] });
}

async function sendSingleVehicleEmbed(vehicle, client) {
    const isAvailable = Boolean(vehicle.available);
    const lastUsedAtFormatted = vehicle.lastUsedAt ? moment(vehicle.lastUsedAt).format('DD/MM/YYYY à HH:mm') : 'Jamais';

    const embed = new EmbedBuilder()
        .setTitle(`${vehicle.type} - ${vehicle.serialNumber}`)
        .setColor(0x00AE86)
        .setDescription(`🆔 Numéro de série: ${vehicle.serialNumber}
🚗 Plaque: ${vehicle.plate}
📌 Disponible: ${isAvailable ? '✅' : '❌'}
👤 Dernier usage: <@${vehicle.lastUsedBy}> le ${lastUsedAtFormatted}`);

    if (vehicle.imageUrl) {
        embed.setThumbnail(vehicle.imageUrl);
    }

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`use_${vehicle.id}`)
            .setLabel("Utiliser le véhicule")
            .setStyle(ButtonStyle.Success)
            .setDisabled(!isAvailable),
        new ButtonBuilder()
            .setCustomId(`release_${vehicle.id}`)
            .setLabel("Reposer le véhicule")
            .setStyle(ButtonStyle.Danger)
            .setDisabled(isAvailable)
    );

    // 🔀 Choix du salon selon le type
    let channelId;
    if (vehicle.type === 'Tractor2') {
        channelId = process.env.CHANNEL_TRACTEURS_ID;
    } else if (vehicle.type === 'Graintrailer') {
        channelId = process.env.CHANNEL_REMORQUES_ID;
    } else {
        channelId = process.env.CHANNEL_AUTRES_ID;
    }

    const channel = await client.channels.fetch(channelId);
    const message = await channel.send({ embeds: [embed], components: [row] });

    // 📎 Crée un thread d’historique
    try {
        const thread = await message.startThread({
            name: `Historique - ${vehicle.serialNumber}`,
            autoArchiveDuration: 1440,
        });

        const historyEmbed = new EmbedBuilder()
            .setTitle("📝 Historique d'utilisation")
            .setColor(0x3498db)
            .setDescription("Aucune utilisation pour le moment.");

        await thread.send({ embeds: [historyEmbed] });
    } catch (err) {
        console.error(`❌ Impossible de créer le thread pour ${vehicle.serialNumber}:`, err.message);
    }
}


function handleSlashCommand(interaction) {
    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) return;
    return command.execute(interaction);
}

module.exports = {
    handleVehicleButtons,
    handleSlashCommand,
    updateVehicleEmbed,
    sendVehiclesEmbeds,
    postUsageToThread,
    formatDuration,
    sendSingleVehicleEmbed
};
