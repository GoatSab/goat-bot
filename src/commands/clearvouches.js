// src/commands/clearvouches.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const dbPath = './vouches.json';

const STAFF_ROLES = ['Head Admin', 'Staff'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clearvouches')
    .setDescription('Clear all vouches for a user (staff only)')
    .addUserOption(o =>
      o.setName('target')
       .setDescription('User whose vouches to clear')
       .setRequired(true)
    ),

  async execute(interaction) {
    // only allow staff+ to run this
    const memberRoles = interaction.member.roles.cache.map(r => r.name);
    if (!memberRoles.some(r => STAFF_ROLES.includes(r))) {
      return interaction.reply({
        content: '❌ You don’t have permission to do that.',
        ephemeral: true
      });
    }

    const target = interaction.options.getUser('target');
    if (!fs.existsSync(dbPath)) {
      return interaction.reply({
        content: '⚠️ No vouches file found.',
        ephemeral: true
      });
    }

    const db = JSON.parse(fs.readFileSync(dbPath));
    if (!db[target.id] || db[target.id].length === 0) {
      return interaction.reply({
        content: `${target.tag} has no vouches to clear.`,
        ephemeral: true
      });
    }

    delete db[target.id];
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

    const embed = new EmbedBuilder()
      .setTitle('Vouches Cleared')
      .setColor('#E74C3C')
      .setDescription(`All vouches for **${target.tag}** have been removed.`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
