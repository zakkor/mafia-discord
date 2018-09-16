import Discord from 'discord.js'
import { FakePlayers, MyselfID } from './mock'
import { getRandomInt } from './util'
import { Role, RoleType, Channel } from './role'

interface UnassignedPlayer {
  member: Discord.GuildMember
  id: string
  name: string
  role: Role | undefined
}
interface Player extends UnassignedPlayer {
  role: Role
}

export enum Phase {
  Pregame,
  Night,
  Day,
}

// A game on one server
export class Game {
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
      isCompleted: boolean
      votes: { [index:string]: number }
      alreadyVoted: { [index:string]: boolean }
    }
  }
  murderTarget: Player | null;

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
    this.murderTarget = null
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
      this.status(this.findRole('lobby'))
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

  async movePlayerToNightChannel(player: Player) {
    const discordRole = player.role.discordRole
    
    console.log('adding', player.role.name, 'to', player.name)
    await player.member.removeRoles(player.member.roles)
    await player.member.addRole(discordRole)
  }

  async movePlayerToDayChannel(player: Player) {
    this.roles.find(ro => ro.type === RoleType.Day)
    const discordRole = player.role.discordRole
    
    console.log('adding', player.role.name, 'to', player.name)
    await player.member.removeRoles(player.member.roles)
    await player.member.addRole(discordRole)
  }

  setPhase(phase: Phase) {
    this.sendMessage('lobby', `Setting phase: ${Phase[phase]}`)
    this.phase = phase

    // reset voting
    this.voting = {}
    for (let role of this.roles) {
      if (!role.canVote) {
        continue
      }

      this.voting[role.name] = {
        votes: {},
        alreadyVoted: {},
        isCompleted: false,
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
    if (phase === Phase.Night) {
      for (let player of this.players) {
        if (player.id.includes('<none>')) {
          continue
        }

        this.movePlayerToNightChannel(player)
      }
    } else if (phase === Phase.Day) {
      for (let player of this.players) {
        if (player.id.includes('<none>')) {
          continue
        }

        this.movePlayerToDayChannel(player)
      }
    }

    // print statuses
    for (let role of this.roles) {
      if (!role.canVote) {
        continue
      }
      this.status(role)
    }
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
      const roleToForce = RoleType.Doctor

      const myselfPlayer = this.unassignedPlayers.find(pl => pl.id === MyselfID)!
      if (myselfPlayer.id === MyselfID) {
        let forcedRole = assignableRoles.find(ro => ro.type === roleToForce)!
        let forcedRoleIdx = assignableRoles.findIndex(ro => ro.type === roleToForce)!

        myselfPlayer.role = forcedRole
        this.players.push({
          ...myselfPlayer,
          role: myselfPlayer.role
        })

        // decrement role amount
        forcedRole.leftToAssign--

        if (forcedRole.leftToAssign === 0) {
          assignableRoles.splice(forcedRoleIdx, 1)
        }
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
      randomRole.leftToAssign--

      if (randomRole.leftToAssign === 0) {
        assignableRoles.splice(randomRoleIdx, 1)
      }
    }
  }

  // at the start of each phase, set available vote options (per channel)
  // we just set this.voting[chanName].votes[playerID] = 0
  setVoteOptions(roleName: string) {
    const roleType = this.findRole(roleName).type

    // villagers and spectators can't vote
    if (roleType === RoleType.Villager
     || roleType === RoleType.None) {
      return
    }

    // doctor can vote for himself, others cannot
    if (roleType === RoleType.Doctor) {
      this.players.forEach(pl => {
        this.voting[roleName].votes[pl.id] = 0
      })
      return
    }

    const others = this.players.filter(pl => pl.role.type !== roleType)
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

  getCastVotes(role: Role): string {
    const roleName = role.name
    const votes = this.voting[roleName].votes

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

  getWinningVote(role: Role): Player {
    let roleVoting = this.voting[role.name]
    if (!roleVoting.isCompleted) {
      throw new Error('trying to get winning vote for incomplete vote')
    }

    // find max votes
    let maxVotes = -1
    let maxVotesPlayerID = ''
    for (let playerID in roleVoting) {
      let amount = roleVoting.votes[playerID]
      if (amount > maxVotes) {
        maxVotes = amount
        maxVotesPlayerID = playerID
      }
    }
    return this.findPlayer(maxVotesPlayerID)!
  }

  performVoteAction(role: Role) {
    let actionDestPlayer = this.getWinningVote(role)
    
    switch (role.type) {
      // mark someone for death
      case RoleType.Mafia:
        this.murderTarget = actionDestPlayer
        break;
      // prevent death 
      case RoleType.Doctor:
        if (this.murderTarget && actionDestPlayer.id === this.murderTarget.id)
        this.murderTarget = null
        break;
      case RoleType.Cop:
        throw new Error('unimplmented cop action')
        break;
      default:
        break;
    }
  }

  performAllVoteActions() {
    // doctor needs to act last, so type out order manually
    this.performVoteAction(this.findRole('mafia'))
    this.performVoteAction(this.findRole('cop'))
    this.performVoteAction(this.findRole('doctor'))

    let murdered = this.maybePerformMurder()
    this.setPhase(Phase.Day)
    if (murdered && this.murderTarget) {
      // TODO: if shouldRevealRole
      this.sendMessage('day', `${this.murderTarget.id} was murdered`)
    }
    this.murderTarget = null
  }

  // kill mafia vote target if doctor didn't save
  // returns if someone died or not
  maybePerformMurder(): boolean {
    if (this.murderTarget) {
      delete this.murderTarget
      return true
    }
    return false
  }

  getTotalVotesForRole(role: Role): number {
    let totalVotes = 0
    let votes = this.voting[role.name].votes
    for (let vote in votes) {
      const amount = votes[vote] 
      totalVotes += amount
    }
    return totalVotes
  }

  areAllVotesCompleted(): boolean {
    // find out total number of roles that can vote
    let totalCanVote = 0
    let totalCompleted = 0
    for (let role of this.roles) {
      if (!role.canVote) {
        continue
      }

      totalCanVote++

      if (this.voting[role.name].isCompleted) {
        totalCompleted++
      }
    }

    return totalCanVote === totalCompleted
  }

  status(role: Role) {
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
      switch (role.type) {
      case RoleType.Mafia:
      case RoleType.Cop:
      case RoleType.Doctor:
        throw new Error('someone posted in a night channel during the day')            
      }
      // lynch status
      break
    case Phase.Night:
      switch (role.type) {
      case RoleType.Mafia:
        let mafiaStatusText = `You are the mafia.\n\nVote on who to kill tonight by doing \`.vote <number>\`\n\nOptions are:\n`
        mafiaStatusText += this.getCastVotes(role) + '\n'

        role.channel.send(mafiaStatusText)
        break
      case RoleType.Cop:
        break
      case RoleType.Doctor:
        let doctorStatusText = `You are the doctor.\n\nVote for who to save tonight by doing \`.vote <name>\`\n\nOptions are:\n`
        doctorStatusText += this.getCastVotes(role) + '\n'

        role.channel.send(doctorStatusText)
        break
      case RoleType.Day:
        // do nothing
        break
      default:
        throw new Error('unrecognised role name '+role.name)
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