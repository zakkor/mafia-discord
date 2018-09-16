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
  isGameRole: boolean
  canVote: boolean // if this role can vote (doesn't mean that it can vote if it has already voted)
  channel: Channel
  type: RoleType
  leftToAssign: number
  limit: number

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
    this.isGameRole = cfg.isGameRole
    this.type = cfg.type
    this.limit = cfg.maximumAssigned
    this.leftToAssign = cfg.maximumAssigned

    this.canVote = true
    switch (this.type) {
    case RoleType.None:
    case RoleType.Villager:
      this.canVote = false
      break;
    }
  }
}