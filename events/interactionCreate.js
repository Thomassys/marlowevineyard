const { Events } = require('discord.js');
const { handleVehicleButtons, handleSlashCommand } = require('../utils/helpers');
const { handleExtendButton } = require('../utils/vehicleTimers');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (interaction.isChatInputCommand()) {
            return handleSlashCommand(interaction);
        }

        if (interaction.isButton()) {
            // 🎯 D'abord on vérifie les boutons de prolongation
            if (interaction.customId.startsWith('extend_')) {
                return handleExtendButton(interaction);
            }

            // 🧭 Sinon on traite les boutons classiques
            return handleVehicleButtons(interaction);
        }
    },
};
