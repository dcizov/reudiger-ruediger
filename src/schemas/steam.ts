import { z } from 'zod';

/**
 * Steam Web API Zod Schemas
 * Documentation: https://developer.valvesoftware.com/wiki/Steam_Web_API
 */

// ISteamApps/GetAppList
export const SteamAppSchema = z.object({
  appid: z.number(),
  name: z.string(),
});

export const SteamAppListResponseSchema = z.object({
  applist: z.object({
    apps: z.array(SteamAppSchema),
  }),
});

// ISteamUser/GetPlayerSummaries
export const PlayerSummarySchema = z.object({
  steamid: z.string(),
  communityvisibilitystate: z.number(),
  profilestate: z.number().optional(),
  personaname: z.string(),
  profileurl: z.string(),
  avatar: z.string(),
  avatarmedium: z.string(),
  avatarfull: z.string(),
  avatarhash: z.string(),
  personastate: z.number(),
  lastlogoff: z.number().optional(),
  commentpermission: z.number().optional(),
  realname: z.string().optional(),
  primaryclanid: z.string().optional(),
  timecreated: z.number().optional(),
  gameid: z.string().optional(),
  gameserverip: z.string().optional(),
  gameextrainfo: z.string().optional(),
  loccountrycode: z.string().optional(),
  locstatecode: z.string().optional(),
  loccityid: z.number().optional(),
});

export const PlayerSummariesResponseSchema = z.object({
  response: z.object({
    players: z.array(PlayerSummarySchema),
  }),
});

// IPlayerService/GetOwnedGames
export const OwnedGameSchema = z.object({
  appid: z.number(),
  name: z.string().optional(),
  playtime_forever: z.number(),
  playtime_windows_forever: z.number().optional(),
  playtime_mac_forever: z.number().optional(),
  playtime_linux_forever: z.number().optional(),
  playtime_deck_forever: z.number().optional(),
  rtime_last_played: z.number().optional(),
  playtime_2weeks: z.number().optional(),
  img_icon_url: z.string().optional(),
  img_logo_url: z.string().optional(),
  has_community_visible_stats: z.boolean().optional(),
  has_leaderboards: z.boolean().optional(),
});

export const OwnedGamesResponseSchema = z.object({
  response: z.object({
    game_count: z.number(),
    games: z.array(OwnedGameSchema).optional(),
  }),
});

// IPlayerService/GetRecentlyPlayedGames
export const RecentlyPlayedGamesResponseSchema = z.object({
  response: z.object({
    total_count: z.number(),
    games: z
      .array(
        OwnedGameSchema.extend({
          playtime_2weeks: z.number(),
        }),
      )
      .optional(),
  }),
});

// ISteamUserStats/GetPlayerAchievements
export const PlayerAchievementSchema = z.object({
  apiname: z.string(),
  achieved: z.number(),
  unlocktime: z.number(),
  name: z.string().optional(),
  description: z.string().optional(),
});

export const PlayerAchievementsResponseSchema = z.object({
  playerstats: z.object({
    steamID: z.string(),
    gameName: z.string(),
    achievements: z.array(PlayerAchievementSchema).optional(),
    success: z.boolean(),
    error: z.string().optional(),
  }),
});

// ISteamUser/ResolveVanityURL
export const ResolveVanityUrlResponseSchema = z.object({
  response: z.object({
    steamid: z.string().optional(),
    success: z.number(),
    message: z.string().optional(),
  }),
});

// Steam Store API (unofficial but widely used)
// https://store.steampowered.com/api/appdetails?appids={appid}
export const SteamStoreAppDetailsSchema = z.object({
  success: z.boolean(),
  data: z
    .object({
      type: z.string(),
      name: z.string(),
      steam_appid: z.number(),
      required_age: z.union([z.number(), z.string()]),
      is_free: z.boolean(),
      controller_support: z.string().optional(),
      dlc: z.array(z.number()).optional(),
      detailed_description: z.string(),
      about_the_game: z.string(),
      short_description: z.string(),
      supported_languages: z.string(),
      header_image: z.string(),
      capsule_image: z.string().optional(),
      capsule_imagev5: z.string().optional(),
      website: z.string().nullable().optional(),
      pc_requirements: z
        .union([
          z.object({
            minimum: z.string().optional(),
            recommended: z.string().optional(),
          }),
          z.array(z.unknown()),
        ])
        .optional(),
      mac_requirements: z.unknown().optional(),
      linux_requirements: z.unknown().optional(),
      legal_notice: z.string().optional(),
      developers: z.array(z.string()).optional(),
      publishers: z.array(z.string()).optional(),
      price_overview: z
        .object({
          currency: z.string(),
          initial: z.number(),
          final: z.number(),
          discount_percent: z.number(),
          initial_formatted: z.string(),
          final_formatted: z.string(),
        })
        .optional(),
      packages: z.array(z.number()).optional(),
      package_groups: z.array(z.unknown()).optional(),
      platforms: z.object({
        windows: z.boolean(),
        mac: z.boolean(),
        linux: z.boolean(),
      }),
      metacritic: z
        .object({
          score: z.number(),
          url: z.string(),
        })
        .optional(),
      categories: z
        .array(
          z.object({
            id: z.number(),
            description: z.string(),
          }),
        )
        .optional(),
      genres: z
        .array(
          z.object({
            id: z.string(),
            description: z.string(),
          }),
        )
        .optional(),
      screenshots: z
        .array(
          z.object({
            id: z.number(),
            path_thumbnail: z.string(),
            path_full: z.string(),
          }),
        )
        .optional(),
      movies: z
        .array(
          z.object({
            id: z.number(),
            name: z.string(),
            thumbnail: z.string(),
            webm: z.record(z.string(), z.string()),
            mp4: z.record(z.string(), z.string()).optional(),
            highlight: z.boolean(),
          }),
        )
        .optional(),
      recommendations: z
        .object({
          total: z.number(),
        })
        .optional(),
      achievements: z
        .object({
          total: z.number(),
          highlighted: z.array(
            z.object({
              name: z.string(),
              path: z.string(),
            }),
          ),
        })
        .optional(),
      release_date: z.object({
        coming_soon: z.boolean(),
        date: z.string(),
      }),
      support_info: z
        .object({
          url: z.string(),
          email: z.string(),
        })
        .optional(),
      background: z.string().optional(),
      background_raw: z.string().optional(),
      content_descriptors: z
        .object({
          ids: z.array(z.number()).optional(),
          notes: z.string().nullable().optional(),
        })
        .optional(),
    })
    .optional(),
});

// Type exports for TypeScript inference
export type SteamApp = z.infer<typeof SteamAppSchema>;
export type SteamAppListResponse = z.infer<typeof SteamAppListResponseSchema>;
export type PlayerSummary = z.infer<typeof PlayerSummarySchema>;
export type PlayerSummariesResponse = z.infer<
  typeof PlayerSummariesResponseSchema
>;
export type OwnedGame = z.infer<typeof OwnedGameSchema>;
export type OwnedGamesResponse = z.infer<typeof OwnedGamesResponseSchema>;
export type PlayerAchievement = z.infer<typeof PlayerAchievementSchema>;
export type PlayerAchievementsResponse = z.infer<
  typeof PlayerAchievementsResponseSchema
>;
export type ResolveVanityUrlResponse = z.infer<
  typeof ResolveVanityUrlResponseSchema
>;
export type SteamStoreAppDetails = z.infer<typeof SteamStoreAppDetailsSchema>;
