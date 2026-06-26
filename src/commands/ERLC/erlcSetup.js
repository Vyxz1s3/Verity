import { SlashCommandBuilder, ChannelType } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { erlc } from '../../services/erlcService.js';

export default {
  data: new SlashCommandBuilder()
    .setName('erlc')
    .setDescription('ERLC server management')
    .addSubcommand(sub =>
      sub
        .setName('setup')
        .setDescription('Setup ERLC server with API key')
        .addStringOption(opt =>
          opt
            .setName('api_key')
            .setDescription('ERLC server API key')
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
        .addStringOption(opt =>
          opt
            .setName('suspect')
            .setDescription('Suspect name to interrogate')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt
            .setName('charges')
            .setDescription('Charges against suspect')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('end')
        .setDescription('End current interrogation')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'setup') {
      return handleSetup(interaction);
    } else if (subcommand === 'status') {
      return handleStatus(interaction);
    } else if (subcommand === 'interrogate') {
      return handleInterrogate(interaction);
    } else if (subcommand === 'end') {
      return handleEnd(interaction);
    }
  }
};

async function handleSetup(interaction) {
  try {
    const apiKey = interaction.options.getString('api_key');
    const logChannel = interaction.options.getChannel('log_channel');

    // Check permissions
    if (!interaction.member.permissions.has('ADMINISTRATOR')) {
      return interaction.reply({
        content: '❌ You need Administrator permissions',
        ephemeral: true
      });
    }

    // Test the API key
    await interaction.deferReply({ ephemeral: true });
    const stats = await erlc.getServerStats(apiKey);

    if (!stats) {
      return interaction.editReply({
        content: '❌ Invalid API key or server unreachable'
      });
    }

    // Store config (TODO: save to database)
    const config = {
      apiKey,
      logChannelId: logChannel.id,
      setupBy: interaction.user.id,
      setupAt: new Date()
    };

    logger.info(`✅ ERLC setup for guild ${interaction.guildId}`);

    const embed = {
      title: '✅ ERLC Server Setup Complete',
      color: 0x00ff00,
      fields: [
        { name: 'Server Name', value: stats.serverName, inline: true },
        { name: 'Status', value: stats.status, inline: true },
        { name: 'Log Channel', value: `<#${logChannel.id}>`, inline: false },
        { name: 'Setup By', value: `<@${interaction.user.id}>`, inline: false }
      ],
      timestamp: new Date()
    };

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    logger.error('❌ Setup error:', err.message);
    await interaction.editReply({
      content: '❌ Setup failed'
    }).catch(() => {});
  }
}

async function handleStatus(interaction) {
  try {
    await interaction.deferReply();

    // TODO: Get API key from database for this guild
    const apiKey = process.env.ERLC_API_KEY; // Placeholder
    
    if (!apiKey) {
      return interaction.editReply({
        content: '❌ ERLC not configured. Use `/erlc setup` first'
      });
    }

    const stats = await erlc.getServerStats(apiKey);

    if (!stats) {
      return interaction.editReply({
        content: '❌ Failed to fetch server status'
      });
    }

    const embed = {
      title: `🎮 ${stats.serverName} - Server Status`,
      color: 0x1a1a1a,
      fields: [
        { name: '👥 Total Players', value: `${stats.totalPlayers}/${stats.maxPlayers}`, inline: true },
        { name: '👮 Police/Sheriff', value: `${stats.police + stats.sheriff}`, inline: true },
        { name: '🚒 Firefighters', value: `${stats.firefighters}`, inline: true },
        { name: '👤 Civilians', value: `${stats.civilians}`, inline: true },
        { name: 'Server Status', value: stats.status === 'online' ? '🟢 Online' : '🔴 Offline', inline: true },
        { name: 'Available Slots', value: `${stats.maxPlayers - stats.totalPlayers}`, inline: true }
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
    const suspect = interaction.options.getString('suspect');
    const charges = interaction.options.getString('charges');

    await interaction.deferReply();

    // TODO: Get API key from database for this guild
    const apiKey = process.env.ERLC_API_KEY; // Placeholder

    if (!apiKey) {
      return interaction.editReply({
        content: '❌ ERLC not configured. Use `/erlc setup` first'
      });
    }

    // Start interrogation in game
    const success = await erlc.startInterrogation(apiKey, suspect);

    if (!success) {
      return interaction.editReply({
        content: '❌ Failed to start interrogation in game'
      });
    }

    const embed = {
      title: '🚔 Interrogation Started',
      color: 0xff6600,
      fields: [
        { name: 'Suspect', value: suspect, inline: true },
        { name: 'Officer', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'Charges', value: charges, inline: false },
        { name: 'Started At', value: `<t:${Math.floor(Date.now() / 1000)}:T>`, inline: true }
      ],
      footer: { text: `Interrogation ID: ${Date.now()}` },
      timestamp: new Date()
    };

    await interaction.editReply({ embeds: [embed] });
    logger.info(`🚔 Interrogation started: ${suspect} - Charges: ${charges}`);
  } catch (err) {
    logger.error('❌ Interrogate error:', err.message);
    await interaction.editReply({
      content: '❌ Failed to start interrogation'
    }).catch(() => {});
  }
}

async function handleEnd(interaction) {
  try {
    await interaction.deferReply();

    // TODO: Get API key from database for this guild
    const apiKey = process.env.ERLC_API_KEY; // Placeholder

    if (!apiKey) {
      return interaction.editReply({
        content: '❌ ERLC not configured. Use `/erlc setup` first'
      });
    }

    const success = await erlc.endInterrogation(apiKey);

    if (!success) {
      return interaction.editReply({
        content: '❌ Failed to end interrogation'
      });
    }

    const embed = {
      title: '✅ Interrogation Ended',
      color: 0x00ff00,
      fields: [
        { name: 'Officer', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'Ended At', value: `<t:${Math.floor(Date.now() / 1000)}:T>`, inline: true }
      ],
      timestamp: new Date()
    };

    await interaction.editReply({ embeds: [embed] });
    logger.info(`✅ Interrogation ended by ${interaction.user.tag}`);
  } catch (err) {
    logger.error('❌ End error:', err.message);
    await interaction.editReply({
      content: '❌ Failed to end interrogation'
    }).catch(() => {});
  }
}

