const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('test')
    .setDescription('A simple test command to verify the bot works'),

  async execute(interaction) {
    await interaction.reply('Test command works!');
  },
};
