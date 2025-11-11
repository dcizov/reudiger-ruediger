import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { sql } from 'drizzle-orm';

import { db } from '../db/index';
import { reactionRoles, subscriptions } from '../db/schema';
import type { SubcommandCommand } from '../types/command';
import {
  getBotConfig,
  getLogChannelId,
  setDealsChannelId,
  setLogChannelId,
  setNewsChannelId,
  setSchedule,
} from '../utils/botConfig';
import { logger } from '../utils/logger';
import {
  addReactionRoleButton,
  addReactionRoleMessage,
} from '../utils/reactionRoles';

export const setup: SubcommandCommand = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Admin: Configure bot settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('channels')
        .setDescription('Configure deals, news, and log channels')
        .addChannelOption((option) =>
          option
            .setName('deals_channel')
            .setDescription('📢 Where to post game deals')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        )
        .addChannelOption((option) =>
          option
            .setName('news_channel')
            .setDescription('📰 Where to post game news updates')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false),
        )
        .addChannelOption((option) =>
          option
            .setName('log_channel')
            .setDescription('🧪 Log channel for errors, dev info, etc')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('roles')
        .setDescription('Create a role selection message with buttons')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('Channel to send the role message')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        )
        .addRoleOption((option) =>
          option
            .setName('role1')
            .setDescription('First role')
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('emoji1')
            .setDescription('Emoji for first role (e.g., 👨)')
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('label1')
            .setDescription('Button label for first role')
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('title')
            .setDescription('Title for the role message')
            .setRequired(false),
        )
        .addStringOption((option) =>
          option
            .setName('description')
            .setDescription('Description for the role message')
            .setRequired(false),
        )
        .addRoleOption((option) =>
          option
            .setName('role2')
            .setDescription('Second role')
            .setRequired(false),
        )
        .addStringOption((option) =>
          option
            .setName('emoji2')
            .setDescription('Emoji for second role')
            .setRequired(false),
        )
        .addStringOption((option) =>
          option
            .setName('label2')
            .setDescription('Button label for second role')
            .setRequired(false),
        )
        .addRoleOption((option) =>
          option
            .setName('role3')
            .setDescription('Third role')
            .setRequired(false),
        )
        .addStringOption((option) =>
          option
            .setName('emoji3')
            .setDescription('Emoji for third role')
            .setRequired(false),
        )
        .addStringOption((option) =>
          option
            .setName('label3')
            .setDescription('Button label for third role')
            .setRequired(false),
        )
        .addRoleOption((option) =>
          option
            .setName('role4')
            .setDescription('Fourth role')
            .setRequired(false),
        )
        .addStringOption((option) =>
          option
            .setName('emoji4')
            .setDescription('Emoji for fourth role')
            .setRequired(false),
        )
        .addStringOption((option) =>
          option
            .setName('label4')
            .setDescription('Button label for fourth role')
            .setRequired(false),
        )
        .addRoleOption((option) =>
          option
            .setName('role5')
            .setDescription('Fifth role')
            .setRequired(false),
        )
        .addStringOption((option) =>
          option
            .setName('emoji5')
            .setDescription('Emoji for fifth role')
            .setRequired(false),
        )
        .addStringOption((option) =>
          option
            .setName('label5')
            .setDescription('Button label for fifth role')
            .setRequired(false),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('schedule')
        .setDescription('Configure cron schedule for deal posting')
        .addStringOption((option) =>
          option
            .setName('cron')
            .setDescription(
              "Cron expression (e.g., '*/30 * * * *' for every 30 mins)",
            )
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('view')
        .setDescription('View current bot configuration'),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'channels':
        return handleChannels(interaction);
      case 'roles':
        return handleRoles(interaction);
      case 'schedule':
        return handleSchedule(interaction);
      case 'view':
        return handleView(interaction);
      default:
        await interaction.reply({
          content: '❌ Unknown subcommand.',
          ephemeral: true,
        });
    }
  },
};

/**
 * Handle /setup channels subcommand
 */
async function handleChannels(interaction: ChatInputCommandInteraction) {
  const dealsChannel = interaction.options.getChannel('deals_channel', true);
  const newsChannel = interaction.options.getChannel('news_channel', false);
  const logChannel = interaction.options.getChannel('log_channel', false);

  await setDealsChannelId(dealsChannel.id);

  let message = `✅ Deal channel set to <#${dealsChannel.id}>`;

  if (newsChannel) {
    await setNewsChannelId(newsChannel.id);
    message += `\n📰 News channel set to <#${newsChannel.id}>`;
  }

  if (logChannel) {
    await setLogChannelId(logChannel.id);
    message += `\n🧪 Log/debug channel set to <#${logChannel.id}>`;
  }

  await interaction.reply({
    content: message,
    ephemeral: true,
  });
}

/**
 * Handle /setup roles subcommand
 */
async function handleRoles(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guild) {
    await interaction.editReply(
      '❌ This command can only be used in a server.',
    );
    return;
  }

  const channel = interaction.options.getChannel('channel', true);
  const title = interaction.options.getString('title') ?? 'Select Your Roles';
  const description =
    interaction.options.getString('description') ??
    'Click the buttons below to get or remove roles!';

  const roleConfigs: {
    role: string;
    emoji: string;
    label: string;
    buttonId: string;
  }[] = [];

  for (let i = 1; i <= 5; i++) {
    const role = interaction.options.getRole(`role${i}`);
    const emoji = interaction.options.getString(`emoji${i}`);
    const label = interaction.options.getString(`label${i}`);

    if (role && emoji && label) {
      roleConfigs.push({
        role: role.id,
        emoji,
        label,
        buttonId: `role_${role.id}_${Date.now()}_${i}`,
      });
    }
  }

  if (roleConfigs.length === 0) {
    await interaction.editReply('❌ You must configure at least one role.');
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(0x5865f2)
    .addFields(
      roleConfigs.map((config) => ({
        name: `${config.emoji} ${config.label}`,
        value: `<@&${config.role}>`,
        inline: true,
      })),
    )
    .setFooter({
      text: 'Click a button to toggle a role • You can have multiple roles',
    })
    .setTimestamp();

  const buttons = roleConfigs.map((config) =>
    new ButtonBuilder()
      .setCustomId(config.buttonId)
      .setLabel(config.label)
      .setEmoji(config.emoji)
      .setStyle(ButtonStyle.Primary),
  );

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);

  if (!('send' in channel)) {
    await interaction.editReply('❌ Selected channel is not a text channel.');
    return;
  }

  try {
    const message = await channel.send({
      embeds: [embed],
      components: [row],
    });

    await addReactionRoleMessage(message.id, channel.id, interaction.guild.id);

    for (const config of roleConfigs) {
      await addReactionRoleButton(
        message.id,
        config.role,
        config.emoji,
        config.label,
        config.buttonId,
      );
    }

    await interaction.editReply(
      `✅ Role selection message created in <#${channel.id}>!\n🔗 [Jump to message](${message.url})`,
    );
  } catch (error) {
    logger.error('Error creating role message:', { error });
    await interaction.editReply(
      '❌ Failed to create role message. Make sure I have permission to send messages in that channel.',
    );
  }
}

/**
 * Handle /setup schedule subcommand
 */
async function handleSchedule(interaction: ChatInputCommandInteraction) {
  const schedule = interaction.options.getString('cron', true);

  await setSchedule(schedule);

  await interaction.reply({
    content: `⏰ Cron schedule set to \`${schedule}\``,
    ephemeral: true,
  });
}

/**
 * Handle /setup view subcommand
 */
async function handleView(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const config = await getBotConfig();
  const logChannelId = await getLogChannelId();

  // Get total subscription count
  const subCountResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(subscriptions);
  const totalSubscriptions = Number(subCountResult[0]?.count ?? 0);

  // Get total reaction role messages count
  const roleCountResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(reactionRoles);
  const totalRoleMessages = Number(roleCountResult[0]?.count ?? 0);

  const embed = new EmbedBuilder()
    .setTitle('⚙️ Bot Configuration')
    .setColor(0x5865f2)
    .addFields(
      {
        name: '📢 Deals Channel',
        value: config.dealsChannelId
          ? `<#${config.dealsChannelId}>`
          : '❌ Not configured',
        inline: true,
      },
      {
        name: '📰 News Channel',
        value: config.newsChannelId
          ? `<#${config.newsChannelId}>`
          : '❌ Not configured',
        inline: true,
      },
      {
        name: '🧪 Log Channel',
        value: logChannelId ? `<#${logChannelId}>` : '❌ Not configured',
        inline: true,
      },
      {
        name: '⏰ Schedule',
        value: `\`${config.schedule}\``,
        inline: true,
      },
      {
        name: '🎭 Role Messages',
        value: `${totalRoleMessages} active`,
        inline: true,
      },
      {
        name: '📊 Total Subscriptions',
        value: `${totalSubscriptions} across all users`,
        inline: true,
      },
    )
    .setFooter({ text: 'Use /setup <subcommand> to change settings' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
