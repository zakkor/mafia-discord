import Discord from 'discord.js'
import { FakePlayers, MyselfID } from './mock'
import R from 'ramda'

function inspect(obj: object) {
  console.log(JSON.stringify(obj, function(key, value) {
    switch (key) {
    case 'guild':
      return '[DiscordGuild '+value.id+']'
    case 'channel':
      return '[DiscordChannel '+value.id+']'
    case 'discordRole':
      return '[DiscordRole '+value.id+']'
    }
    return value
  }, 2))
}

function getChanName(chan: Discord.Channel): string {
  return (<Discord.TextChannel>chan).name
}

function getRandomInt(max: number) {
  return Math.floor(Math.random() * Math.floor(max));
}

enum RoleType {
  None,
  Villager,
  Mafia,
  Cop,
  Doctor
}

type Channel = Discord.TextChannel | Discord.DMChannel | Discord.GroupDMChannel

interface RoleConfig {
  id: string
  type: RoleType
  isGameRole: boolean
  channelID: string
  limit: number
}

class Role {
  guild: Discord.Guild
  discordRole: Discord.Role
  name: string
  isGameRole: boolean
  canVote: boolean // if this role can vote (doesn't mean that it can vote if it has already voted)
  channel: Channel
  type: RoleType
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
    this.limit = cfg.limit

    this.canVote = true
    switch (this.type) {
    case RoleType.None:
    case RoleType.Villager:
      this.canVote = false
      break;
    }
  }
}

interface GameConfig {
  roles: RoleConfig[]
}

const GameConfig: GameConfig = {
  roles: [
    {
      id: '490567542398648320',
      type: RoleType.None,
      channelID: '489106226244878340',
      isGameRole: false, // will not be randomly assigned to players at the start
      limit: -1
    },
    {
      id: '490609185524809729',
      type: RoleType.None,
      channelID: '489727884634619904',
      isGameRole: false,
      limit: -1
    },
    {
      id: '489106307832610836',
      type: RoleType.Villager,
      channelID: '489727930679689216',
      isGameRole: true,
      limit: 3
    },
    {
      id: '489106278237601792',
      type: RoleType.Mafia,
      channelID: '489727867005960194',
      isGameRole: true,
      limit: 2
    },
    {
      id: '489520383511363606',
      type: RoleType.Cop,
      channelID: '489727972274601994',
      isGameRole: true,
      limit: 1
    },
    {
      id: '489520463546941452',
      type: RoleType.Doctor,
      channelID: '489727998640259095',
      isGameRole: true,
      limit: 1
    },
  ]
}

// const GameSettings: {
//   channels: {[index:string]: string}
//   roles: PartialRole[],
// } = {
//   channels: {
//     lobby: '',
//     villager: '489727930679689216',
//     mafia: '489727867005960194',
//     cop: '489727972274601994',
//     doctor: '489727998640259095',
//     day: '489727884634619904',
//   },
//   roles: [
//     {
//       name: 'Lobby',
//       channel: 'lobby',
//       type: RoleType.None,
//       id: '',
//       limit: 0,
//     },
//     {
//       name: 'Villager',
//       channel: 'villager',
//       type: RoleType.Villager,
//       id: '489106307832610836',
//       limit: 3,
//     },
//     { 
//       name: 'Mafia',
//       channel: 'mafia',
//       type: RoleType.Mafia,
//       id: '489106278237601792',
//       limit: 2,
//     }, 
//     {
//       name: 'Cop',
//       channel: 'cop',
//       type: RoleType.Cop,
//       id: '489520383511363606',
//       limit: 1,
//     },
//     {
//       name: 'Doctor',
//       channel: 'doctor',
//       type: RoleType.Doctor,
//       id: '489520463546941452',
//       limit: 1,
//     }
//   ]
// }
     
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
        // initialize channels and roles from config
        // let channels: Channels = {}

        let roles = []
        for (let roleCfg of GameConfig.roles) {
          let role = new Role(guild, roleCfg) 
          roles.push(role)
        }
        // for (let chanCfg of GameConfig) {
        //   // find discord channel by id
        //   let channelRef = guild.channels.find(ch => ch.id === chanCfg.id)!
        //   let roleRef = guild.roles.find(ro => ro.id === chanCfg.role.id)
        //   // console.log('channel.name:', channel.name)

        //   const role = <Role>{

        //   }
          
        //   const role = <Role>GameSettings.roles.find(ro => {
        //     console.log('ro.channel:', ro.channel)
        //     console.log('channel.name:', channel.name)
            
            
        //     return ro.channel === channel.name
        //   })!
        //   role.roleRef = guild.roles.find(discRole => discRole.id === role.id)!
           
        //   channels[channelName] = {
        //     ref: <Discord.TextChannel>channel,
        //     role: role,
        //   } 
        // }

        // Object.keys(GameSettings.channels).forEach(channelName => {
        //   // console.log('channelName:', channelName)
          
        //   let channelID = GameSettings.channels[channelName]
        //   let channel = guild.channels.find(ch => ch.id === channelID)
        //   // console.log('channel.name:', channel.name)
          
        //   const role = <Role>GameSettings.roles.find(ro => {
        //     console.log('ro.channel:', ro.channel)
        //     console.log('channel.name:', channel.name)
            
            
        //     return ro.channel === channel.name
        //   })!
        //   role.roleRef = guild.roles.find(discRole => discRole.id === role.id)!
           
        //   channels[channelName] = {
        //     ref: <Discord.TextChannel>channel,
        //     role: role,
        //   } 
        // })
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
        game.status((<Discord.TextChannel>message.channel).name)  
        game.players[0]
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
        if (!player.role.canVote) {
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
          player.role.channel.send(`${author}, you have already voted for ${voteMember.id}`)
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

interface UnassignedPlayer {
  member: Discord.GuildMember
  id: string
  name: string
  role: Role | undefined
}
interface Player extends UnassignedPlayer {
  role: Role
}

enum Phase {
  Pregame,
  Night,
  Day,
}

interface Channels {
  [index:string]: { ref: Channel, role: Role } // channel belongs to a role
}

// A game on one server
class Game {
  guild: Discord.Guild
  // bot prefix. configurable per server
  prefix: string = '.'
  // how many players are required to start a game
  playerLimit: number
  // are we currently looking for players?
  isLookingForPlayers: boolean
  // is the game in progress?
  isGameStarted: boolean
  // various channels
  roles: Role[]
  // used for caching
  private channelCache: {[index:string]: Channel}
  // holds players until they are assigned a role
  unassignedPlayers: UnassignedPlayer[]
  // holds the players
  players: Player[]
  // what phase the game is in
  phase: Phase
  // holds voting stuff
  voting: {
    [index: string]: {
      votes: { [index:string]: number }
      alreadyVoted: { [index:string]: boolean }
    }
  }

  constructor(guild: Discord.Guild, roles: Role[]) {
    this.guild = guild
    this.roles = roles
    this.channelCache = {}
    // move to init
    this.playerLimit = 7
    this.unassignedPlayers = []
    this.players = []
    this.phase = Phase.Pregame
    this.isLookingForPlayers = false
    this.isGameStarted = false
    this.voting = {}
  }

  findRole(name: string): Role {
    // case insensitive
    return this.roles.find(ro => ro.name.toLowerCase() === name.toLowerCase())!
  }

  findChannel(roleName: string) {
    let channel = (this.findRole(roleName)!).channel
    return channel
  }

  findChannelByID(channelID: string) {
    return this.guild.channels.find(ch => ch.id === channelID)!
  }

  sendMessage(roleName: string, contents: string) {
    const role = this.findRole(roleName)
    role.channel.send(contents)
  }

  startLookingForPlayers() {
    if (this.isGameStarted) {
      this.sendMessage('lobby', 'A game is already in progress')
      return
    }
    if (this.isLookingForPlayers) {
      this.status('Lobby')
      return
    }

    // start looking for players
    this.isLookingForPlayers = true
    this.unassignedPlayers = []
    this.players = []

    this.sendMessage('lobby', `Starting new game: looking for ${this.playerLimit} players...`)
  }

  start() {
    this.isLookingForPlayers = false
    this.isGameStarted = true

    this.sendMessage('lobby', 'Starting game...')
    // some sort of timer here

    // assign roles
    this.randomlyAssignRoles()

    this.setPhase(Phase.Night)
  }


  async movePlayerToRoleChannel(player: Player) {
    const discordRole = player.role.discordRole
    
    console.log('adding', player.role.name, 'to', player.name)
    await player.member.removeRoles(player.member.roles)
    await player.member.addRole(discordRole)
  }

  setPhase(phase: Phase) {
    this.sendMessage('lobby', `Setting phase: ${Phase[phase]}`)
    this.phase = phase

    this.voting = {}
    for (let role of this.roles) {
      if (!role.canVote) {
        continue
      }

      this.voting[role.name] = {
        votes: {},
        alreadyVoted: {},
      }
    }

    // delete 100 messages from all channels except lobby
    for (let role of this.roles) {
      if (role.type === RoleType.None) {
        continue
      }

      // TODO: maybe make async
      role.channel.bulkDelete(100)

      if (role.canVote) {
        this.setVoteOptions(role.name)
      }
    }

    // move each player to the channel that belongs to his assigned role
    this.players.forEach(player => {
      if (!player.id.includes('<none>')) {
        this.movePlayerToRoleChannel(player)
      }
    })

    // handle mafia actions
    this.status('mafia')
  }

  // randomly assigns a GAME role to all the players in the game
  // this does not assign the discord users the actual discord roles, which
  // happens when a phase is set.
  // moves unassigned players to the assigned player list
  randomlyAssignRoles() {
    const DebugForce = true

    let assignableRoles = [...this.roles.filter(ro => ro.isGameRole)!]
    

    // TODO: debug remove
    // force role on myself
    if (DebugForce) {
      const myselfPlayer = this.unassignedPlayers.find(pl => pl.id === MyselfID)!
      if (myselfPlayer.id === MyselfID) {
        let forcedRole = assignableRoles.find(ro => ro.type === RoleType.Mafia)!
        let forcedRoleIdx = assignableRoles.findIndex(ro => ro.type === RoleType.Mafia)!

        myselfPlayer.role = forcedRole
        this.players.push({
          ...myselfPlayer,
          role: myselfPlayer.role
        })

        // decrement role amount
        forcedRole.limit--
      }
    }

    for (let i = 0; i < this.playerLimit; i++) {
      let uap = this.unassignedPlayers[i]
      // we're forcing outselves into a role, don't add again
      if (DebugForce) {
        if (uap.id === MyselfID) {
          continue
        }
      }

      // get random role
      const randomRoleIdx = getRandomInt(assignableRoles.length)
      let randomRole = assignableRoles[randomRoleIdx]

      uap.role = randomRole
      this.players.push({
        ...uap,
        role: uap.role
      })

      // decrement role amount
      randomRole.limit--

      if (randomRole.limit === 0) {
        assignableRoles.splice(randomRoleIdx, 1)
      }
    }
  }

  // at the start of each phase, set available vote options (per channel)
  // we just set this.voting[chanName].votes[playerID] = 0
  setVoteOptions(roleName: string) {
    const channelRoleType = this.findRole(roleName).type

    // villagers and spectators can't vote
    if (channelRoleType === RoleType.Villager
     || channelRoleType === RoleType.None) {
      return
    }

    const others = this.players.filter(pl => pl.role.type !== channelRoleType)
    others.forEach(pl => {
      this.voting[roleName].votes[pl.id] = 0
    })
  }

  findPlayerByName(name: string) {
    let fakePlayer = FakePlayers.find(fp => fp.name === name)!
    if (fakePlayer) {
      return FakePlayers.find(fp => fp.id === fakePlayer.id)
    }

    return this.guild.members
      .find(m => m.user.username.toLowerCase() === name.toLowerCase())
  }

  findPlayer(id: string): Player | undefined {
    return this.players.find(pl => pl.id === id)
  }

  getCastVotes(channel: Channel): string {
    const channelName = getChanName(channel)
    const votes = this.voting[channelName].votes
    console.log('votes:', votes)

    let castVotes = ''
    for (let playerID in votes) {
      const numVotes = votes[playerID]
      const player = this.findPlayer(playerID)!

      let text = `- ${player.name}`
      if (numVotes && numVotes > 0) {
        text += `: ${numVotes} votes`
      }
      text += '\n'

      castVotes += text
    }
    return castVotes
  }

  status(channelName: string) {
    const channel = this.findChannel(channelName)

    if (this.isLookingForPlayers) {
      const statusText =
      `Currently looking for players
Have: [${this.unassignedPlayers.map(p => p.name).toString()}]
Looking for ${this.playerLimit - this.unassignedPlayers.length} more players`

      this.sendMessage('lobby', statusText)
      return
    }

    switch (this.phase) {
    case Phase.Day:
      // lynch status
      break
    case Phase.Night:
      switch (channelName) {
      case 'mafia':
        let mafiaStatusText = `You are the mafia.\n\nVote on who to kill tonight by doing \`.vote <number>\`\n\nOptions are:\n`
        mafiaStatusText += this.getCastVotes(channel) + '\n'

        channel.send(mafiaStatusText)
        break
      case 'cop':
        break
      case 'doctor':
        break
      default:
        console.log('error: unrecognised channel name', channelName)
        break
      }
      break
    }
  }

  addPlayer(member: Discord.GuildMember, id: string, name: string, ) {
    if (this.isGameStarted) {
      this.sendMessage('lobby', 'A game is already in progress')
      return
    }
    if (!this.isLookingForPlayers) {
      this.sendMessage('lobby', 'No game currently scheduled')
      return
    }
    // player already joined queue
    if (this.unassignedPlayers.find(player => player.id === id)) {
      this.sendMessage('lobby', name+', you have already joined the queue!')
      return
    }

    // add the player to the list
    this.unassignedPlayers.push({
      member: member,
      id: id,
      name: name,
      role: undefined,
    })
    this.sendMessage('lobby', name+' joined the game')

    // if we have all the players needed to start the game
    if (this.unassignedPlayers.length === this.playerLimit) {
      // start the game
      this.start()
    }
  }
}

export default GameManager