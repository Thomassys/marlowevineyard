const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { connectDb } = require('../database/connect');
const moment = require('moment');

async function refreshVehicleEmbedById(vehicleId, client) {
    const db = await connectDb();
    const [rows] = await db.query("SELECT * FROM vehicles WHERE id = ?", [vehicleId]);
    const vehicle = rows[0];
    if (!vehicle) return;

    const isAvailable = Boolean(vehicle.available);
    const lastUsedAtFormatted = vehicle.lastUsedAt
        ? moment(vehicle.lastUsedAt).format('DD/MM/YYYY à HH:mm')
        : 'Jamais';

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

    try {
        const channel = await client.channels.fetch(
            vehicle.type === 'Tractor2'
                ? process.env.CHANNEL_TRACTEURS_ID
                : vehicle.type === 'Graintrailer'
                ? process.env.CHANNEL_REMORQUES_ID
                : process.env.CHANNEL_AUTRES_ID
        );
        const message = await channel.messages.fetch(vehicle.messageId);
        await message.edit({ embeds: [embed], components: [row] });
    } catch (err) {
        console.error(`❌ Erreur pour mettre à jour le message du véhicule ${vehicleId}:`, err.message);
    }
}

module.exports = { refreshVehicleEmbedById };
