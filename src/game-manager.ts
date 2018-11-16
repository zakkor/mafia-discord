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

  endGame(game: Game) {
    delete this.games[game.guild.id]
  }

  registerMessageHandler() {
    this.disc.on('message', message => {
      if (!message.guild) {
        return
      }

      let cont = R.clone(message.content)

      const guildID = message.guild.id
      const guild = message.guild
      if (!(guildID in this.games)) {
        let roles = []
        for (let roleCfg of gameConfigInstance.roles) {
          let role = new Role(guild, roleCfg) 
          roles.push(role)
        }
        this.games[guildID] = new Game(this, guild, roles)
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
      case 'help':
        const helpText =
`Rules:
At the start of the game, everyone is assigned a role:
- 3 villagers: the villager is sided with the town, and has no special actions during the night
- 2 mafia: they are sided with the mafia (duh), and during the night they can chat and vote for a person to be killed
- 1 doctor: the doctor is sided with the town, and during the night he can choose a person to save, preventing them being killed by mafia that night. They can choose themselves.
- 1 cop: the cop is sided with the town, and during the night he can choose a person to investigate. The next day they will receive a message letting them know if that person is innocent or not.

During the day, the town must discuss and try to figure out who is guilty and who is innocent.
During the day, everyone can vote for someone to lynch (kill). The person with the most votes will be killed, and the next night will begin
The mafia win when they outnumber the innocent people. The town wins when all mafia is killed.
Note that during the game you can whisper people (Discord DM). This is a legit game mechanic and is not considered cheating.

Commands:
\`.start\` - starts a new game
\`.join\` - join the queue for a new game
\`.leave\` - leave the queue
\`.status\` - see what's happening at any phase in the game
\`.vote\` - during the night, roles which have actions can use this command to perform their action
          - during the day, you use this command to vote for who to lynch
`
        game.sendMessage('lobby', helpText)
        break
      case 'start':
        game.startLookingForPlayers()  
        break
      case 'leave':
        game.removePlayer(message.member)  
        break
      case 'join':
        const user = message.member
        const playerID = user.user.id
        const playerName = user.user.username
        game.addPlayer(user, playerID, playerName)  
        break
      case 'givelobby':
        guild.members.forEach(async me => {
          try {
            await me.removeRoles(me.roles)
            await me.addRole(game.findRole('lobby').discordRole)
          } catch(e) {
            // don't care
          }
        })
        break
      case 'status':
        try {
          game.status(game.findRole((<Discord.TextChannel>message.channel).name))
        } catch(err) {
          console.log('status is fucked:', err)
        }
        break
      case 'vote':
        if (args.length === 0) {
          message.channel.send(`${message.author}, you must mention the user you want to vote for`)
        }
        this.handleVote(game, message, args[0])
        break
      // debug stuff
      // case 'fill':
      //   this.fillWithFakePlayers(game, guild)
      //   break
      // case 'ins':
      //   inspect(game.roles)
      //   break
      // case 'qs':
      //   game.startLookingForPlayers()  
      //   this.fillWithFakePlayers(game, guild)
      //   const myID = '164469337258721280'
      //   const myRef = guild.members.find(m => m.id === myID)
      //   game.addPlayer(myRef, myRef.user.id, myRef.user.username)  
      //   break
      // // force complete all votes
      // case 'qv':
      //   game.forceCompleteNightVotes()
      //   break
      // case 'qvd':
      //   game.forceCompleteDayVotes()
      //   break
      // case 'bulkdelete':
      //   message.channel.bulkDelete(100)
      //   break
      }
        
    })
  }

  handleVote(game: Game, message: Discord.Message, voteName: string) {
    game.handleVote(message.channel.id, message.author.id, voteName)
  }

  fillWithFakePlayers(game: Game, guild: Discord.Guild) {
    FakePlayers.forEach(p => {
      const fakeUser = new Discord.GuildMember(guild, { nickname: p.name, id: p.id, user: { id: p.id } })
      game.addPlayer(fakeUser, p.id, p.name)  
    })
  }
}
export default GameManager