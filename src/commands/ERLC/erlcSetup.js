import { SlashCommandBuilder, ChannelType } from 'discord.js';
import { logger } from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('erlc')
    .setDescription('ERLC server management')
    .addSubcommand(sub =>
      sub
        .setName('setup')
        .setDescription('Setup ERLC server API')
        .addStringOption(opt =>
          opt
            .setName('server_id')
            .setDescription('ERLC private server ID')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt
            .setName('api_key')
            .setDescription('Server API key for owner commands')
            .setRequired(true)
        )
        .addChannelOption(opt =>
          opt
            .setName('log_channel')
            .setDescription('Channel to log interrogations')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('status')
        .setDescription('Get current server status')
    )
    .addSubcommand(sub =>
      sub
        .setName('interrogate')
        .setDescription('Start an interrogation')
        .addUserOption(opt =>
          opt
            .setName('suspect')
            .setDescription('Suspect being interrogated')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt
            .setName('charges')
            .setDescription('Charges against suspect')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'setup') {
      return handleSetup(interaction);
    } else if (subcommand === 'status') {
      return handleStatus(interaction);
    } else if (subcommand === 'interrogate') {
      return handleInterrogate(interaction);
    }
  }
};

async function handleSetup(interaction) {
  try {
    const serverId = interaction.options.getString('server_id');
    const apiKey = interaction.options.getString('api_key');
    const logChannel = interaction.options.getChannel('log_channel');

    // Check permissions
    if (!interaction.member.permissions.has('ADMINISTRATOR')) {
      return interaction.reply({
        content: '❌ You need Administrator permissions',
        ephemeral: true
      });
    }

    // Store config in guild data (you'd use your database here)
    const guildId = interaction.guildId;
    const config = {
      serverId,
      apiKey,
      logChannelId: logChannel.id,
      setupBy: interaction.user.id,
      setupAt: new Date()
    };

    // TODO: Save to database
    logger.info(`✅ ERLC setup for guild ${guildId}: Server ${serverId}`);

    const embed = {
      title: '✅ ERLC Server Setup Complete',
      color: 0x00ff00,
      fields: [
        { name: 'Server ID', value: serverId, inline: true },
        { name: 'Log Channel', value: `<#${logChannel.id}>`, inline: true },
        { name: 'Setup By', value: `<@${interaction.user.id}>`, inline: false }
      ],
      timestamp: new Date()
    };

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (err) {
    logger.error('❌ Setup error:', err.message);
    await interaction.reply({
      content: '❌ Setup failed',
      ephemeral: true
    }).catch(() => {});
  }
}

async function handleStatus(interaction) {
  try {
    await interaction.deferReply();

    // TODO: Fetch actual server status
    const embed = {
      title: '🎮 ERLC Server Status',
      color: 0x1a1a1a,
      fields: [
        { name: 'Total Players', value: '0', inline: true },
        { name: '👮 Police/Sheriff', value: '0', inline: true },
        { name: '🚒 Firefighters', value: '0', inline: true },
        { name: '👤 Civilians', value: '0', inline: true },
        { name: 'Server Status', value: '🟢 Online', inline: true },
        { name: 'Ping', value: '0ms', inline: true }
      ],
      timestamp: new Date()
    };

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    logger.error('❌ Status error:', err.message);
    await interaction.editReply('❌ Failed to fetch status').catch(() => {});
  }
}

async function handleInterrogate(interaction) {
  try {
    const suspect = interaction.options.getUser('suspect');
    const charges = interaction.options.getString('charges');

    const embed = {
      title: '🚔 Interrogation Started',
      color: 0xff6600,
      fields: [
        { name: 'Suspect', value: `<@${suspect.id}>`, inline: true },
        { name: 'Officer', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'Charges', value: charges, inline: false },
        { name: 'Started At', value: `<t:${Math.floor(Date.now() / 1000)}:T>`, inline: true }
      ],
      footer: { text: `Interrogation ID: ${Date.now()}` },
      timestamp: new Date()
    };

    await interaction.reply({ embeds: [embed] });

    // TODO: Log to ERLC log channel
    logger.info(`🚔 Interrogation started: ${suspect.tag} - Charges: ${charges}`);
  } catch (err) {
    logger.error('❌ Interrogate error:', err.message);
    await interaction.reply({
      content: '❌ Failed to start interrogation',
      ephemeral: true
    }).catch(() => {});
  }
}

