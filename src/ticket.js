// src/ticket.js
require('dotenv').config();
const fs = require('fs');
const {
  Client,
  GatewayIntentBits,
  Collection,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  AttachmentBuilder,
  StringSelectMenuBuilder,
  ChannelType,
  MessageFlags,
} = require('discord.js');

// ===== IDs (update if needed) =====
const TICKET_CHANNEL_ID     = '1404163599454306376'; // "tickets" hub channel
const TICKET_CATEGORY_ID    = '1399872666843873280';
const STAFF_ROLE_ID         = '1399128110774878319';
const TRANSCRIPT_CHANNEL_ID = '1399878825235447848';
const FORUM_CHANNEL_ID      = '1399843405328027879';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ---------- Forum thread limiter ----------
client.on('threadCreate', async thread => {
  if (thread.parentId !== FORUM_CHANNEL_ID) return;

  const allThreads = thread.guild.channels.cache.filter(
    c => c.parentId === FORUM_CHANNEL_ID && c.isThread()
  );
  const userThreads = allThreads.filter(t => t.ownerId === thread.ownerId);

  if (userThreads.size > 1) {
    await thread.delete().catch(() => null);
    const member = await thread.guild.members.fetch(thread.ownerId).catch(() => null);
    if (member) {
      member
        .send('🚫 You may only have one active trade post at a time. Please delete your existing thread before creating a new one.')
        .catch(() => null);
    }
  }
});

// ---------- Load slash commands from src/commands ----------
client.commands = new Collection();
const commandsDir = __dirname + '/commands';
if (fs.existsSync(commandsDir)) {
  fs.readdirSync(commandsDir)
    .filter(f => f.endsWith('.js'))
    .forEach(file => {
      const cmd = require(`./commands/${file}`);
      if (cmd?.data?.name) client.commands.set(cmd.data.name, cmd);
    });
}

// ---------- On ready: ensure Ticket Hub with dropdown ----------
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const hub = await client.channels.fetch(TICKET_CHANNEL_ID).catch(() => null);
  if (!hub?.isTextBased()) return;

  const msgs = await hub.messages.fetch({ limit: 50 });
  const hasHub = msgs.some(
    m =>
      m.embeds?.[0]?.title === 'Ticket Hub' &&
      m.components?.[0]?.components?.[0]?.customId === 'ticket_select'
  );

  if (!hasHub) {
    const hubEmbed = new EmbedBuilder()
      .setTitle('Ticket Hub')
      .setDescription(
        `Need help, want to trade safely, or have a request?\n` +
        `Select an option from the menu below to open a ticket.\n\n` +
        `🛒 **Buy A Brainrot** – Purchase your dream brainrot.\n` +
        `🛡️ **Request a Middleman** – Trade safely with staff assistance.\n` +
        `🎁 **Invite Rewards** – Redeem your invites for prizes.\n` +
        `🚨 **Scam Report** – Report suspicious activity or users.\n` +
        `📋 **Apply For Roles** – Join our team or gain special ranks.\n` +
        `❓ **Other** – Anything not listed above.`
      )
      .setColor('#5865F2');

    const menu = new StringSelectMenuBuilder()
      .setCustomId('ticket_select')
      .setPlaceholder('Choose a ticket type…')
      .addOptions(
        { label: 'Buy A Brainrot',      value: 'buy',  description: 'Request to purchase a brainrot',        emoji: '🛒' },
        { label: 'Request a Middleman', value: 'mm',   description: 'Use a trusted middleman for your trade', emoji: '🛡️' },
        { label: 'Invite Rewards',      value: 'inv',  description: 'Redeem your invites for a brainrot',     emoji: '🎁' },
        { label: 'Scam Report',         value: 'scam', description: 'Report a scammer',                        emoji: '🚨' },
        { label: 'Apply For Roles',     value: 'apply',description: 'Apply for a server role',                 emoji: '📋' },
        { label: 'Other',               value: 'other',description: 'Anything else',                           emoji: '❓' },
      );

    await hub.send({
      embeds: [hubEmbed],
      components: [new ActionRowBuilder().addComponents(menu)],
    });
  }
});

// ---------- Helpers ----------
const makeInput = (id, label, style, required = true, placeholder = 'EXAMPLE') =>
  new TextInputBuilder()
    .setCustomId(id)
    .setLabel(label)
    .setStyle(style)
    .setRequired(required)
    .setPlaceholder(placeholder);

const makeCloseRow = () =>
  new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('close_ticket')
      .setLabel('Close Ticket')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🔒')
  );

const makeOverwrites = (guild, userId) => [
  { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
  { id: userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
  { id: STAFF_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
];

const createTicketChannel = async (interaction, kind, user) => {
  return interaction.guild.channels.create({
    name: `${kind}-${user.username}`.toLowerCase().replace(/[^a-z0-9\-]/g, ''),
    type: ChannelType.GuildText,
    parent: TICKET_CATEGORY_ID,
    permissionOverwrites: makeOverwrites(interaction.guild, user.id),
  });
};

// ---------- Interactions ----------
client.on('interactionCreate', async interaction => {
  // Slash commands
  if (interaction.isChatInputCommand()) {
    const cmd = client.commands.get(interaction.commandName);
    if (cmd) {
      try {
        await cmd.execute(interaction);
      } catch (err) {
        console.error(err);
        if (!interaction.replied) {
          await interaction.reply({ content: 'There was an error.', flags: MessageFlags.Ephemeral });
        }
      }
    }
    return;
  }

  // Dropdown -> show modal
  if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
    const choice = interaction.values[0];
    let modal;

    switch (choice) {
      case 'buy': {
        modal = new ModalBuilder().setCustomId('modal_buy').setTitle('Buy A Brainrot');
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            makeInput('wanted', 'What brainrot are you looking to purchase?', TextInputStyle.Short, true, 'e.g. Tralalero Tralala')
          )
        );
        break;
      }

      case 'mm': {
        modal = new ModalBuilder().setCustomId('modal_mm').setTitle('Request a Middleman');
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            makeInput('q1', 'Who are you trading with?', TextInputStyle.Short, true, 'e.g. @DiscordUser or RobloxName')
          ),
          new ActionRowBuilder().addComponents(
            makeInput('q2', 'What is the trade?', TextInputStyle.Paragraph, true, 'e.g. My Graipus for 2 Rainbow Tralalero Tralala')
          ),
          new ActionRowBuilder().addComponents(
            makeInput('q3', 'Can you both join links? (Yes/No)', TextInputStyle.Short, true, 'e.g. Yes')
          ),
          new ActionRowBuilder().addComponents(
            makeInput('q4', 'If not, list both Roblox users', TextInputStyle.Short, false, 'e.g. User1, User2')
          )
        );
        break;
      }

      case 'inv': {
        modal = new ModalBuilder().setCustomId('modal_inv').setTitle('Invite Rewards');
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            makeInput('brainrot', 'What brainrot would you like?', TextInputStyle.Short, true, 'e.g. Tralalero Tralala')
          ),
          new ActionRowBuilder().addComponents(
            makeInput('invites', 'How many invites do you have?', TextInputStyle.Short, true, 'e.g. 5')
          )
        );
        break;
      }

      case 'scam': {
        modal = new ModalBuilder().setCustomId('modal_scam').setTitle('Scam Report');
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            makeInput('scammer', 'Scammer Discord/Roblox user', TextInputStyle.Short, true, 'e.g. @DiscordUser or RobloxName')
          ),
          new ActionRowBuilder().addComponents(
            makeInput('proof', 'Do you have proof? (Yes/No)', TextInputStyle.Paragraph, true, 'e.g. Yes')
          )
        );
        break;
      }

      case 'apply': {
        modal = new ModalBuilder().setCustomId('modal_apply').setTitle('Apply For Roles');
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            makeInput('role', 'What role are you applying for?', TextInputStyle.Short, true, 'e.g. Content Creator')
          )
        );
        break;
      }

      case 'other': {
        modal = new ModalBuilder().setCustomId('modal_other').setTitle('Other Ticket');
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            makeInput('reason', 'Reason for your ticket', TextInputStyle.Paragraph, true, 'e.g. I have a question about …')
          )
        );
        break;
      }
    }

    if (modal) await interaction.showModal(modal);
    return;
  }

  // ===== Modal submits -> create channels =====

  // Buy
  if (interaction.isModalSubmit() && interaction.customId === 'modal_buy') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const user = interaction.user;
    const wanted = interaction.fields.getTextInputValue('wanted');

    let ch;
    try {
      ch = await createTicketChannel(interaction, 'ticket-buy', user);
    } catch (e) {
      console.error('Create ticket-buy failed:', e);
      return interaction.followUp({ content: '❌ Failed to create ticket channel.', flags: MessageFlags.Ephemeral });
    }

    const embed = new EmbedBuilder()
      .setTitle(`Buy A Brainrot — ${user.tag}`)
      .setColor('#EB459E')
      .addFields({ name: 'Looking to purchase', value: wanted })
      .setTimestamp();

    await ch.send({ content: `<@${user.id}> opened a purchase ticket`, embeds: [embed], components: [makeCloseRow()] });
    await interaction.followUp({ content: `✅ Your purchase ticket: ${ch}`, flags: MessageFlags.Ephemeral });
    return;
  }

  // Middleman
  if (interaction.isModalSubmit() && interaction.customId === 'modal_mm') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const user = interaction.user;
    const answers = {
      tradingWith: interaction.fields.getTextInputValue('q1'),
      tradeWhat:   interaction.fields.getTextInputValue('q2'),
      joinLinks:   interaction.fields.getTextInputValue('q3'),
      robloxUsers: interaction.fields.getTextInputValue('q4') || '—',
    };

    let ch;
    try {
      ch = await createTicketChannel(interaction, 'ticket-mm', user);
    } catch (e) {
      console.error('Create ticket-mm failed:', e);
      return interaction.followUp({ content: '❌ Failed to create ticket channel.', flags: MessageFlags.Ephemeral });
    }

    const embed = new EmbedBuilder()
      .setTitle(`Middleman Ticket — ${user.tag}`)
      .setThumbnail(user.displayAvatarURL())
      .setColor('#5865F2')
      .addFields(
        { name: 'Who Are You Trading With?', value: answers.tradingWith },
        { name: 'What Is The Trade?',        value: answers.tradeWhat },
        { name: 'Can You Join Links?',       value: answers.joinLinks },
        { name: 'Roblox Users (if cannot join links)', value: answers.robloxUsers },
      )
      .setTimestamp();

    await ch.send({ content: `<@${user.id}> opened a ticket`, embeds: [embed], components: [makeCloseRow()] });
    await interaction.followUp({ content: `✅ Your ticket has been created: ${ch}`, flags: MessageFlags.Ephemeral });
    return;
  }

  // Invite
  if (interaction.isModalSubmit() && interaction.customId === 'modal_inv') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const user = interaction.user;
    const brainrot = interaction.fields.getTextInputValue('brainrot');
    const invites  = interaction.fields.getTextInputValue('invites');

    let ch;
    try {
      ch = await createTicketChannel(interaction, 'ticket-invite', user);
    } catch (e) {
      console.error('Create ticket-invite failed:', e);
      return interaction.followUp({ content: '❌ Failed to create ticket channel.', flags: MessageFlags.Ephemeral });
    }

    const embed = new EmbedBuilder()
      .setTitle(`Invite Rewards — ${user.tag}`)
      .setColor('#57F287')
      .addFields(
        { name: 'Requested brainrot', value: brainrot },
        { name: 'Invites claimed',    value: invites },
      )
      .setTimestamp();

    await ch.send({ content: `<@${user.id}> opened an invite ticket`, embeds: [embed], components: [makeCloseRow()] });
    await interaction.followUp({ content: `✅ Your invite ticket: ${ch}`, flags: MessageFlags.Ephemeral });
    return;
  }

  // Scam
  if (interaction.isModalSubmit() && interaction.customId === 'modal_scam') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const user = interaction.user;
    const scammer = interaction.fields.getTextInputValue('scammer');
    const proof   = interaction.fields.getTextInputValue('proof');

    let ch;
    try {
      ch = await createTicketChannel(interaction, 'ticket-scam', user);
    } catch (e) {
      console.error('Create ticket-scam failed:', e);
      return interaction.followUp({ content: '❌ Failed to create ticket channel.', flags: MessageFlags.Ephemeral });
    }

    const embed = new EmbedBuilder()
      .setTitle(`Scam Report — ${user.tag}`)
      .setColor('#ED4245')
      .addFields(
        { name: 'Scammer', value: scammer },
        { name: 'Proof',   value: proof },
      )
      .setTimestamp();

    await ch.send({ content: `<@${user.id}> opened a scam report`, embeds: [embed], components: [makeCloseRow()] });
    await interaction.followUp({ content: `✅ Your scam report: ${ch}`, flags: MessageFlags.Ephemeral });
    return;
  }

  // Apply
  if (interaction.isModalSubmit() && interaction.customId === 'modal_apply') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const user = interaction.user;
    const role = interaction.fields.getTextInputValue('role');

    let ch;
    try {
      ch = await createTicketChannel(interaction, 'ticket-apply', user);
    } catch (e) {
      console.error('Create ticket-apply failed:', e);
      return interaction.followUp({ content: '❌ Failed to create ticket channel.', flags: MessageFlags.Ephemeral });
    }

    const embed = new EmbedBuilder()
      .setTitle(`Role Application — ${user.tag}`)
      .setColor('#FEE75C')
      .addFields({ name: 'Requested role', value: role })
      .setTimestamp();

    await ch.send({ content: `<@${user.id}> opened a role application`, embeds: [embed], components: [makeCloseRow()] });
    await interaction.followUp({ content: `✅ Your application ticket: ${ch}`, flags: MessageFlags.Ephemeral });
    return;
  }

  // Other
  if (interaction.isModalSubmit() && interaction.customId === 'modal_other') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const user = interaction.user;
    const reason = interaction.fields.getTextInputValue('reason');

    let ch;
    try {
      ch = await createTicketChannel(interaction, 'ticket-other', user);
    } catch (e) {
      console.error('Create ticket-other failed:', e);
      return interaction.followUp({ content: '❌ Failed to create ticket channel.', flags: MessageFlags.Ephemeral });
    }

    const embed = new EmbedBuilder()
      .setTitle(`Other Ticket — ${user.tag}`)
      .setColor('#99AAB5')
      .addFields({ name: 'Reason', value: reason })
      .setTimestamp();

    await ch.send({ content: `<@${user.id}> opened a ticket`, embeds: [embed], components: [makeCloseRow()] });
    await interaction.followUp({ content: `✅ Your ticket: ${ch}`, flags: MessageFlags.Ephemeral });
    return;
  }

  // Close + transcript
  if (interaction.isButton() && interaction.customId === 'close_ticket') {
    const channel = interaction.channel;
    const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
    if (!messages) return;

    const transcript = messages
      .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
      .map(m => `[${new Date(m.createdTimestamp).toLocaleString()}] ${m.author?.tag ?? m.author?.id}: ${m.content}`)
      .join('\n');

    const transcriptChannel = await channel.guild.channels.fetch(TRANSCRIPT_CHANNEL_ID).catch(() => null);
    const attachment = new AttachmentBuilder(Buffer.from(transcript, 'utf-8'), {
      name: `${channel.name}-transcript.txt`,
    });

    if (transcriptChannel?.isTextBased()) {
      await transcriptChannel.send({ content: `Transcript for ${channel.name}:`, files: [attachment] });
    }

    await channel.delete().catch(() => null);
  }
});

client.login(process.env.DISCORD_TOKEN);
