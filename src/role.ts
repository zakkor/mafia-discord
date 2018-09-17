import Discord from 'discord.js'
import { RoleConfig } from './config'

export enum RoleType {
  None,
  Day,
  Villager,
  Mafia,
  Cop,
  Doctor
}

export type Channel = Discord.TextChannel | Discord.DMChannel | Discord.GroupDMChannel

export class Role {
  guild: Discord.Guild
  discordRole: Discord.Role
  name: string
  isNightRole: boolean
  canVoteNight: boolean // if this role can vote (doesn't mean that it can vote if it has already voted)
  canVoteDay: boolean;
  channel: Channel
  type: RoleType
  leftToAssign: number
  limit: number
  isInnocent: boolean

  async uppercaseDiscordChannelName(channel: Discord.Channel) {
    let name = (<Discord.TextChannel>channel).name
    name = name[0].toUpperCase()
    await (<Discord.TextChannel>channel).setName(name)
  }

  constructor(guild: Discord.Guild, cfg: RoleConfig) {
    this.guild = guild

    this.discordRole = this.guild.roles.find(ro => ro.id === cfg.id)!
    this.channel = (<Channel>this.guild.channels.find(ch => ch.id === cfg.channelID)!)
    this.name = this.discordRole.name
    this.isNightRole = cfg.isGameRole
    this.type = cfg.type
    this.limit = cfg.maximumAssigned
    this.leftToAssign = cfg.maximumAssigned

    this.canVoteNight = true
    this.canVoteDay = false
    this.isInnocent = true
    switch (this.type) {
    case RoleType.None:
    case RoleType.Day:
    case RoleType.Villager:
      this.canVoteNight = false
      break
    case RoleType.Mafia:
      this.isInnocent = false
      break
    }

    if (this.type === RoleType.Day) {
      this.canVoteDay = true
    }
  }
}