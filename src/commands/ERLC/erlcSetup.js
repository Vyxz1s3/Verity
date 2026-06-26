import { SlashCommandBuilder, ChannelType } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { executeCommand } from '../../services/erlcApi.js';
import { getErlcConfig } from '../../utils/erlcConfig.js';

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
            .setName('api_key')
            .setDescription('Server API key for owner commands')
            .setRequired(true)
        )
        .addChannelOption(opt =>
          opt
            .setName('log_channel')
            .setDescription('Channel to log commands')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('cmds')
        .setDescription('Execute ER:LC in-game commands')
        .addStringOption(opt =>
          opt
            .setName('command')
            .setDescription('Command to execute (e.g., :load username, :kick username reason)')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'setup') {
      return handleSetup(interaction);
    } else if (subcommand === 'cmds') {
      return handleCommand(interaction);
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

    // Store config in guild data (you'd use your database here)
    const guildId = interaction.guildId;
    const config = {
      apiKey,
      logChannelId: logChannel?.id || null,
      setupBy: interaction.user.id,
      setupAt: new Date()
    };

    // TODO: Save to database
    logger.info(`✅ ERLC setup for guild ${guildId}`);

    const embed = {
      title: '✅ ERLC Server Setup Complete',
      color: 0x00ff00,
      fields: [
        { name: 'API Key', value: '••••••••' + apiKey.slice(-4), inline: true },
        { name: 'Log Channel', value: logChannel ? `<#${logChannel.id}>` : 'Not set', inline: true },
        { name: 'Setup By', value: `<@${interaction.user.id}>`, inline: false },
        { name: 'Usage', value: 'Use `/erlc cmds` to execute in-game commands', inline: false }
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

async function handleCommand(interaction) {
  try {
    await interaction.deferReply();

    const commandInput = interaction.options.getString('command');
    const config = await getErlcConfig(interaction.guildId);

    if (!config?.apiKey) {
      return interaction.editReply({
        content: '❌ ERLC server not configured. Use `/erlc setup` first.',
        ephemeral: true
      });
    }

    // Validate command format (must start with :)
    if (!commandInput.startsWith(':')) {
      return interaction.editReply({
        content: '❌ Command must start with `:` (e.g., `:load username`)',
        ephemeral: true
      });
    }

    // Execute the command
    const result = await executeCommand(config.apiKey, commandInput);

    if (result.success) {
      const embed = {
        title: '✅ Command Executed',
        color: 0x00ff00,
        fields: [
          { name: 'Command', value: `\`${commandInput}\``, inline: false },
          { name: 'Executed By', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Status', value: 'Success', inline: true }
        ],
        timestamp: new Date()
      };

      await interaction.editReply({ embeds: [embed] });
      logger.info(`✅ ERLC command executed: ${commandInput} by ${interaction.user.tag}`);

      // Log to channel if configured
      if (config.logChannelId) {
        try {
          const logChannel = await interaction.guild.channels.fetch(config.logChannelId);
          if (logChannel) {
            await logChannel.send({
              embeds: [{
                title: '📋 ERLC Command Log',
                color: 0x0099ff,
                fields: [
                  { name: 'Command', value: `\`${commandInput}\``, inline: false },
                  { name: 'Executed By', value: `<@${interaction.user.id}>`, inline: true },
                  { name: 'Timestamp', value: `<t:${Math.floor(Date.now() / 1000)}:T>`, inline: true }
                ]
              }]
            });
          }
        } catch (err) {
          logger.warn('Could not log to channel:', err.message);
        }
      }
    } else {
      await interaction.editReply({
        content: `❌ Command failed: ${result.error}`,
        ephemeral: true
      });
    }
  } catch (err) {
    logger.error('Command execution error:', err.message);
    await interaction.editReply({
      content: '❌ An error occurred',
      ephemeral: true
    }).catch(() => {});
  }
}

