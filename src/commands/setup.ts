import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { eq, sql } from 'drizzle-orm';

import { db } from '../db/index';
import {
  newsSettings,
  reactionRoleButtons,
  reactionRoles,
  subscriptions,
} from '../db/schema';
import { AVAILABLE_NEWS_SOURCES } from '../services/newsService';
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
            .setName('news_default')
            .setDescription('📰 Default news channel (fallback for all games)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false),
        )
        .addChannelOption((option) =>
          option
            .setName('cs2_news')
            .setDescription('🎮 CS2-specific news channel')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false),
        )
        .addChannelOption((option) =>
          option
            .setName('wow_news')
            .setDescription('🏰 WoW-specific news channel')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false),
        )
        .addChannelOption((option) =>
          option
            .setName('wow_indev_news')
            .setDescription('🔨 WoW In Development (PTR/Beta) news channel')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false),
        )
        .addChannelOption((option) =>
          option
            .setName('valheim_news')
            .setDescription('⚔️ Valheim-specific news channel')
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
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const subcommand = interaction.options.getSubcommand();

      switch (subcommand) {
        case 'channels':
          return await handleChannels(interaction);
        case 'roles':
          return await handleRoles(interaction);
        case 'schedule':
          return await handleSchedule(interaction);
        case 'view':
          return await handleView(interaction);
        default:
          await interaction.editReply({
            content: '❌ Unknown subcommand.',
          });
      }
    } catch (error) {
      logger.error('Setup command error:', {
        error,
        subcommand: interaction.options.getSubcommand(),
      });

      try {
        await interaction.editReply({
          content: '❌ An error occurred while processing your request.',
        });
      } catch (replyError) {
        logger.error('Could not send error message:', { error: replyError });
      }
    }
  },
};

/**
 * Handle /setup channels subcommand
 */
async function handleChannels(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) {
    await interaction.editReply({
      content: '❌ This command can only be used in a server.',
    });
    return;
  }

  const dealsChannel = interaction.options.getChannel('deals_channel', true);
  const newsDefaultChannel = interaction.options.getChannel(
    'news_default',
    false,
  );
  const cs2NewsChannel = interaction.options.getChannel('cs2_news', false);
  const wowNewsChannel = interaction.options.getChannel('wow_news', false);
  const wowInDevNewsChannel = interaction.options.getChannel(
    'wow_indev_news',
    false,
  );
  const valheimNewsChannel = interaction.options.getChannel(
    'valheim_news',
    false,
  );
  const logChannel = interaction.options.getChannel('log_channel', false);

  await setDealsChannelId(dealsChannel.id);

  let message = `✅ Deal channel set to <#${dealsChannel.id}>`;

  if (newsDefaultChannel) {
    await setNewsChannelId(newsDefaultChannel.id);
    message += `\n📰 Default news channel set to <#${newsDefaultChannel.id}>`;
  }

  const sourceChannelMap: {
    source: keyof typeof AVAILABLE_NEWS_SOURCES;
    channelId: string;
    name: string;
    icon: string;
  }[] = [];

  if (cs2NewsChannel) {
    sourceChannelMap.push({
      source: 'cs2',
      channelId: cs2NewsChannel.id,
      name: 'Counter-Strike 2',
      icon: '🎮',
    });
  }

  if (wowNewsChannel) {
    sourceChannelMap.push({
      source: 'wowRetail',
      channelId: wowNewsChannel.id,
      name: 'WoW Retail',
      icon: '🏰',
    });
  }

  if (wowInDevNewsChannel) {
    sourceChannelMap.push({
      source: 'wowInDev',
      channelId: wowInDevNewsChannel.id,
      name: 'WoW In Development',
      icon: '🔨',
    });
  }

  if (valheimNewsChannel) {
    sourceChannelMap.push({
      source: 'valheim',
      channelId: valheimNewsChannel.id,
      name: 'Valheim',
      icon: '⚔️',
    });
  }

  for (const { source, channelId, name, icon } of sourceChannelMap) {
    try {
      await db
        .insert(newsSettings)
        .values({
          guildId: interaction.guildId,
          source,
          enabled: true,
          channelId,
        })
        .onConflictDoUpdate({
          target: [newsSettings.guildId, newsSettings.source],
          set: {
            channelId,
            enabled: true,
            updatedAt: new Date(),
          },
        });

      message += `\n${icon} ${name} news → <#${channelId}>`;
    } catch (dbError) {
      logger.error('Failed to save news setting:', {
        error: dbError,
        source,
        channelId,
      });
    }
  }

  if (logChannel) {
    await setLogChannelId(logChannel.id);
    message += `\n🧪 Log/debug channel set to <#${logChannel.id}>`;
  }

  await interaction.editReply({
    content: message,
  });
}

/**
 * Handle /setup roles subcommand
 */
async function handleRoles(interaction: ChatInputCommandInteraction) {
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

  await interaction.editReply({
    content: `⏰ Cron schedule set to \`${schedule}\``,
  });
}

/**
 * Handle /setup view subcommand
 */
async function handleView(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) {
    await interaction.editReply(
      '❌ This command can only be used in a server.',
    );
    return;
  }

  const config = await getBotConfig();
  const logChannelId = await getLogChannelId();

  const subCountResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(subscriptions);
  const totalSubscriptions = Number(subCountResult[0]?.count ?? 0);

  const roleMessages = await db
    .select({
      messageId: reactionRoles.messageId,
      channelId: reactionRoles.channelId,
      createdAt: reactionRoles.createdAt,
    })
    .from(reactionRoles)
    .where(eq(reactionRoles.guildId, interaction.guildId))
    .orderBy(reactionRoles.createdAt);

  const roleMessagesWithCounts = await Promise.all(
    roleMessages.map(async (rm) => {
      const buttons = await db
        .select({ count: sql<number>`count(*)` })
        .from(reactionRoleButtons)
        .where(eq(reactionRoleButtons.messageId, rm.messageId));

      return {
        ...rm,
        buttonCount: Number(buttons[0]?.count ?? 0),
      };
    }),
  );

  const allNewsSettings = await db
    .select()
    .from(newsSettings)
    .where(eq(newsSettings.guildId, interaction.guildId));

  const newsSourceLines: string[] = [];

  for (const [key, source] of Object.entries(AVAILABLE_NEWS_SOURCES)) {
    const setting = allNewsSettings.find((s) => s.source === key);

    if (setting?.enabled === false) {
      newsSourceLines.push(`~~${source.icon} ${source.name}~~ *(disabled)*`);
    } else if (setting?.channelId) {
      newsSourceLines.push(
        `${source.icon} ${source.name} → <#${setting.channelId}>`,
      );
    } else {
      newsSourceLines.push(`${source.icon} ${source.name} → *Default channel*`);
    }
  }

  const newsSourcesDisplay =
    newsSourceLines.length > 0
      ? newsSourceLines.join('\n')
      : 'No sources configured';

  const roleMessagesDisplay =
    roleMessagesWithCounts.length > 0
      ? roleMessagesWithCounts
          .map(
            (rm) =>
              `<#${rm.channelId}> - ${rm.buttonCount} roles ([Jump](https://discord.com/channels/${interaction.guildId}/${rm.channelId}/${rm.messageId}))`,
          )
          .join('\n')
      : 'No role messages configured';

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
        name: '📰 Default News Channel',
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
        name: '📊 Total Subscriptions',
        value: `${totalSubscriptions} across all users`,
        inline: true,
      },
      {
        name: '\u200B',
        value: '\u200B',
        inline: true,
      },
      {
        name: '📰 News Sources & Channels',
        value: newsSourcesDisplay,
        inline: false,
      },
      {
        name: `🎭 Role Messages (${roleMessagesWithCounts.length} active)`,
        value: roleMessagesDisplay,
        inline: false,
      },
    )
    .setFooter({ text: 'Use /setup <subcommand> to change settings' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
