const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, Collection } = require('discord.js');
const mysql = require('mysql2/promise');
const moment = require('moment');
require('dotenv').config();

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

const DIRECTION_ROLE_ID = process.env.DIRECTION_ROLE_ID;
const RESPONSABLE_ROLE_ID = process.env.RESPONSABLE_ROLE_ID;

client.commands = new Collection();

client.once('ready', async () => {
    console.log(`Connecté en tant que ${client.user.tag}`);
});

async function getVehicles() {
    const [rows] = await db.query("SELECT * FROM vehicles");
    return rows;
}

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'vehicules') {
            await sendVehiclesEmbeds(interaction);
        } else if (interaction.commandName === 'tracteurs') {
            await sendVehiclesEmbeds(interaction, 'Tractor2');
        } else if (interaction.commandName === 'remorques') {
            await sendVehiclesEmbeds(interaction, 'Graintrailer');
        } else if (interaction.commandName === 'vehicules_autres') {
            await sendVehiclesEmbeds(interaction, 'autres');
        } else if (interaction.commandName === 'ajouter_vehicule') {
            const type = interaction.options.getString('type');
            const serialNumber = interaction.options.getInteger('serialnumber');
            const plate = interaction.options.getString('plate');
            const imageUrl = interaction.options.getString('imageurl') || '';
            await db.query("INSERT INTO vehicles (type, serialNumber, plate, available, lastUsedBy, lastUsedAt, imageUrl) VALUES (?, ?, ?, 1, NULL, NULL, ?)", [type, serialNumber, plate, imageUrl]);
            await interaction.reply({ content: `✅ Véhicule **${type} - ${serialNumber}** ajouté avec succès.`, ephemeral: true });
        } else if (interaction.commandName === 'supprimer_vehicule') {
            const serialNumber = interaction.options.getInteger('serialnumber');
            await db.query("DELETE FROM vehicles WHERE serialNumber = ?", [serialNumber]);
            await interaction.reply({ content: `❌ Véhicule avec numéro de série **${serialNumber}** supprimé.`, ephemeral: true });
        }
    }

    if (!interaction.isButton()) return;
    const [action, vehicleId] = interaction.customId.split('_');

    if (action === 'use') {
        await db.query("UPDATE vehicles SET available = false, lastUsedBy = ?, lastUsedAt = NOW() WHERE id = ?", [interaction.user.id, vehicleId]);
        await db.query("INSERT INTO vehicle_history (vehicle_id, user_id, start_time) VALUES (?, ?, NOW())", [vehicleId, interaction.user.id]);
    } else if (action === 'release') {
        const [vehicles] = await db.query("SELECT * FROM vehicles WHERE id = ?", [vehicleId]);
        const vehicle = vehicles[0];

        if (vehicle.lastUsedBy !== interaction.user.id && !interaction.member.roles.cache.has(DIRECTION_ROLE_ID) && !interaction.member.roles.cache.has(RESPONSABLE_ROLE_ID)) {
            await interaction.reply({ content: `❌ Vous n'avez pas l'autorisation de reposer ce véhicule.`, ephemeral: true });
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
});

async function updateVehicleEmbed(interaction) {
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

    await interaction.update({ embeds: [embed], components: [row] });
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendVehiclesEmbeds(interaction, filterType = null) {
    await interaction.deferReply({ ephemeral: true });

    const vehicles = await getVehicles();

    let filteredVehicles;
    if (filterType === 'Tractor2') {
        filteredVehicles = vehicles.filter(v => v.type === 'Tractor2');
    } else if (filterType === 'Graintrailer') {
        filteredVehicles = vehicles.filter(v => v.type === 'Graintrailer');
    } else if (filterType === 'autres') {
        filteredVehicles = vehicles.filter(v => v.type !== 'Tractor2' && v.type !== 'Graintrailer');
    } else {
        filteredVehicles = vehicles;
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

        await delay(500);
    }

    await interaction.editReply({ content: "Les véhicules ont été affichés." });
}

function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours > 0 ? `${hours}h ` : ''}${minutes}min`;
}

async function postUsageToThread(interaction, vehicleId, userId, startTime, endTime, duration, releaserId = null) {
    const [vehicles] = await db.query("SELECT * FROM vehicles WHERE id = ?", [vehicleId]);
    const vehicle = vehicles[0];
    const threadName = `Historique - ${vehicle.serialNumber}`;

    const threads = await interaction.channel.threads.fetch();
    const thread = threads.threads.find(t => t.name === threadName);

    if (!thread) return;

    if (thread.archived) {
        await thread.setArchived(false, 'Ajout de l\'historique d\'utilisation');
    }

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

client.login(process.env.TOKEN);
