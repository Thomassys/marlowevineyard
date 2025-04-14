const { SlashCommandBuilder } = require('discord.js');
const { connectDb } = require('../database/connect');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('supprimer_vehicule')
        .setDescription('Supprimer un véhicule existant')
        .addIntegerOption(option =>
            option.setName('serialnumber')
                .setDescription('Numéro de série du véhicule à supprimer')
                .setRequired(true)
        ),

    async execute(interaction) {
        const db = await connectDb();
        const serialNumber = interaction.options.getInteger('serialnumber');

        const [results] = await db.query('SELECT * FROM vehicles WHERE serialNumber = ?', [serialNumber]);

        if (results.length === 0) {
            return interaction.reply({ content: `❌ Aucun véhicule trouvé avec le numéro de série ${serialNumber}.`, ephemeral: true });
        }

        const vehicle = results[0];

        try {
            if (vehicle.messageId) {
                // Cherche le bon salon selon le type
                let channelId;
                if (vehicle.type === 'Tractor2') {
                    channelId = process.env.CHANNEL_TRACTEURS_ID;
                } else if (vehicle.type === 'Graintrailer') {
                    channelId = process.env.CHANNEL_REMORQUES_ID;
                } else {
                    channelId = process.env.CHANNEL_AUTRES_ID;
                }

                const channel = await interaction.client.channels.fetch(channelId);

                try {
                    const message = await channel.messages.fetch(vehicle.messageId);
                    await message.delete();
                } catch (err) {
                    console.warn(`⚠️ Message déjà supprimé ou introuvable (${vehicle.messageId})`);
                }

                // Supprime le thread si trouvé
                if (vehicle.threadId) {
                    try {
                        const thread = await interaction.client.channels.fetch(vehicle.threadId);
                        await thread.delete();
                    } catch (err) {
                        console.warn(`⚠️ Thread déjà supprimé ou introuvable (${vehicle.threadId})`);
                    }
                }
            }
        } catch (error) {
            console.error('❌ Erreur lors de l\'accès au salon :', error);
            return interaction.reply({ content: '❌ Impossible d\'accéder au salon ou au message.', ephemeral: true });
        }
        await db.query('DELETE FROM vehicle_history WHERE vehicle_id = ?', [vehicle.id]);
        await db.query('DELETE FROM vehicles WHERE serialNumber = ?', [serialNumber]);

        await interaction.reply({
            content: `❌ Véhicule **${vehicle.type} - ${serialNumber}** supprimé avec succès.`,
            ephemeral: true
        });
    }
};
