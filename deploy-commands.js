const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

const commands = [
    new SlashCommandBuilder()
        .setName('vehicules')
        .setDescription('Afficher tous les véhicules'),
    new SlashCommandBuilder()
        .setName('tracteurs')
        .setDescription('Afficher uniquement les tracteurs'),
    new SlashCommandBuilder()
        .setName('remorques')
        .setDescription('Afficher uniquement les remorques'),
    new SlashCommandBuilder()
        .setName('vehicules_autres')
        .setDescription('Afficher les autres véhicules'),
    new SlashCommandBuilder()
        .setName('ajouter_vehicule')
        .setDescription('Ajouter un nouveau véhicule')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Type du véhicule')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('serialnumber')
                .setDescription('Numéro de série du véhicule')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('plate')
                .setDescription('Plaque d\'immatriculation')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('imageurl')
                .setDescription('URL de l\'image du véhicule')
                .setRequired(false)),
    new SlashCommandBuilder()
        .setName('supprimer_vehicule')
        .setDescription('Supprimer un véhicule par numéro de série')
        .addIntegerOption(option =>
            option.setName('serialnumber')
                .setDescription('Numéro de série du véhicule')
                .setRequired(true))
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('🚀 Déploiement des commandes...');

        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );

        console.log('✅ Commandes déployées avec succès !');
    } catch (error) {
        console.error(error);
    }
})();
