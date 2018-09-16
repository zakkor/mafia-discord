import Discord from 'discord.js'
import R from 'ramda'
import { Game, Phase } from './game'
import { gameConfigInstance } from './config'
import { Role } from './role'
import { FakePlayers } from './mock'
import { inspect } from './util'

class GameManager {
  // the discord client
  disc: Discord.Client
  // map of server id to game instance
  games: { [index: string]: Game } = {}

  constructor(discord: Discord.Client) {
    this.disc = discord

    this.registerMessageHandler()
  }

  registerMessageHandler() {
    this.disc.on('message', message => {
      let cont = R.clone(message.content)

      const guildID = message.guild.id
      const guild = message.guild
      if (!(guildID in this.games)) {
        let roles = []
        for (let roleCfg of gameConfigInstance.roles) {
          let role = new Role(guild, roleCfg) 
          roles.push(role)
        }
        this.games[guildID] = new Game(guild, roles)
      }
      let game = this.games[guildID]

      const prefix = game.prefix
      if (!cont.startsWith(prefix)) {
        return
      }

      // remove prefix
      cont = cont.slice(prefix.length)

      if (cont.length === 0) {
        return
      }
      
      const split = cont.split(' ')

      const cmd = split[0]
      const args = split.slice(1)

      switch (cmd) {
      case 'start':
        game.startLookingForPlayers()  
        break
      case 'join':
        const user = message.member
        const playerID = user.user.id
        const playerName = user.user.username
        game.addPlayer(user, playerID, playerName)  
        break
      case 'status':
        game.status(game.findRole((<Discord.TextChannel>message.channel).name))
        break
      case 'vote':
        if (args.length === 0) {
          message.channel.send(`${message.author}, you must mention the user you want to vote for`)
        }
        this.handleVote(game, message, args[0])
        break
      // debug stuff
      case 'fill':
        this.fillWithFakePlayers(game, guild)
        break
      case 'ins':
        inspect(game.roles)
        break
      case 'qs':
        game.startLookingForPlayers()  
        this.fillWithFakePlayers(game, guild)
        const myID = '164469337258721280'
        const myRef = guild.members.find(m => m.id === myID)
        game.addPlayer(myRef, myRef.user.id, myRef.user.username)  
        break
      // force complete all votes
      case 'qv':
        // TODO:
        // game.forceCompleteAllVotes()
        break
      case 'phasen':
        game.setPhase(Phase.Night)
        break
      case 'phased':
        game.setPhase(Phase.Day)
        break
      }
    })
  }

  handleVote(game: Game, message: Discord.Message, voteName: string) {
    switch (game.phase) {
      case Phase.Pregame:
        game.sendMessage('lobby', 'No game is in progress')
        break;
      case Phase.Night:
        const author = message.author

        // find in game player and check if his role can vote
        let player = game.findPlayer(author.id)
        if (!player) {
          return
        }
        // player cannot vote
        if (!player.role.canVote) {
          return
        }
        // player posted message in a different channel than his role (should not happen)
        if (player.role.channel.id !== message.channel.id) {
          message.channel.send(`${author}, you should not be able to see or type in this channel, please report this bug`)
          return
        }

        let roleVoting = game.voting[player.role.name]
        // find vote destination player by name
        let voteMember = game.findPlayerByName(voteName)
        
        if (!voteMember) {
          player.role.channel.send(`${author}, could not find a player named ${voteName}`)
          return
        }
        if (roleVoting.alreadyVoted[player.id]) {
          player.role.channel.send(`${author}, you have already voted`)
          return
        }

        const voteID = voteMember.id
        if (!(voteID in roleVoting.votes)) {
          player.role.channel.send(`${author}, you cannot vote for ${voteMember.id}`)
          return
        }

        // increment how many votes this player has
        roleVoting.votes[voteID]++
        // set author already voted true
        roleVoting.alreadyVoted[player.id] = true

        player.role.channel.send(`${author} has voted for ${voteMember.id}`)

        // check if vote completed for this role
        const totalVotes = game.getTotalVotesForRole(player.role)
        if (totalVotes === player.role.limit) {
          roleVoting.isCompleted = true
          player.role.channel.send(`Vote completed in channel ${player.role.channel}`)
        }
      
        // check if all roles completed their votes
        if (game.areAllVotesCompleted()) {
          game.sendMessage('lobby', 'All votes completed, performing action')

          game.performAllVoteActions()
        }

        break;
      case Phase.Day:
        // lynch
        game.sendMessage('Day', 'supposed to lynch here')
        break;
      default:
        break;
    }
  }

  fillWithFakePlayers(game: Game, guild: Discord.Guild) {
    FakePlayers.forEach(p => {
      const fakeUser = new Discord.GuildMember(guild, { id: '<none>' })
      game.addPlayer(fakeUser, p.id, p.name)  
    })
  }
}
export default GameManager