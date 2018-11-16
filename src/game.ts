import Discord from 'discord.js'
// import { FakePlayers, MyselfID } from './mock'
import { getRandomInt, inspect, shuffle } from './util'
import { Role, RoleType, Channel } from './role'
import GameManager from './game-manager'

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
  manager: GameManager

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
  murderTarget: Player | null
  investigation: { target: Player | null, isInnocent: boolean }
  nightTimeSeconds: number = 90
  dayTimeSeconds: number = 180

  constructor(manager: GameManager, guild: Discord.Guild, roles: Role[]) {
    this.manager = manager
    this.guild = guild
    this.roles = roles
    this.channelCache = {}
    // move to init
    let totalPlayers = 0
    for (let role of this.roles) {
      if (role.limit != -1 && role.isNightRole) {
        totalPlayers += role.limit
      }
    }
    this.playerLimit = totalPlayers
    this.unassignedPlayers = []
    this.players = []
    this.phase = Phase.Pregame
    this.isLookingForPlayers = false
    this.isGameStarted = false
    this.voting = {}
    this.murderTarget = null
    this.investigation = {
      target: null,
      isInnocent: false,
    }
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
    return (<Discord.TextChannel>this.guild.channels.find(ch => ch.id === channelID)!)
  }

  async sendMessage(roleName: string, contents: string) {
    const role = this.findRole(roleName)
    await role.channel.send(contents)
  }

  addVote(player: Player, voteName: string) {
    let whichRole = null
    if (this.phase === Phase.Night) {
      whichRole = player.role
    } else {
      whichRole = this.roles.find(ro => ro.type === RoleType.Day)!
    }

    let roleVoting = this.voting[whichRole.name]
    // find vote destination player by name
    let voteMember = this.findPlayerByName(voteName)
    
    if (!voteMember) {
      whichRole.channel.send(`${player.member}, could not find a player named ${voteName}`)
      return
    }
    if (roleVoting.alreadyVoted[player.id]) {
      whichRole.channel.send(`${player.member}, you have already voted`)
      return
    }

    const voteID = voteMember.id
    if (!(voteID in roleVoting.votes)) {
      whichRole.channel.send(`${player.member}, you cannot vote for ${voteMember}`)
      return
    }

    // increment how many votes this player has
    roleVoting.votes[voteID]++
    // set author already voted true
    roleVoting.alreadyVoted[player.id] = true

    whichRole.channel.send(`${player.member} has voted for ${voteMember}`)

    // check if vote completed for this role
    // if night, get total votes for player's role
    // if day, get total votes for day role
    const totalVotes = this.getTotalVotesForRole(whichRole)
    const roleCount = this.getRoleCount(whichRole)
    console.log('totalVotes:', totalVotes)
    console.log('roleCount:', roleCount)
    
    
    
    if (totalVotes === roleCount) {
      roleVoting.isCompleted = true
      whichRole.channel.send(`Vote completed in channel ${whichRole.channel}`)
    }
  
    // TODO: to delete this
    // check if all roles completed their votes
    // if (this.areAllVotesCompleted()) {
    //   this.sendMessage('lobby', 'All votes completed, performing action')
    //   // this
    //   this.performAllVoteActions()
    // }
  }

  getRoleCount(role: Role): number {
    // day means all (alive) players
    if (role.type === RoleType.Day) {
      return this.players.length
    }
    return this.players.filter(pl => pl.role.type === role.type).length
  }

  handleVote(channelID: string, authorID: string, voteName: string) {
    // find in this player and check if his role can vote
    let player = this.findPlayer(authorID)
    if (!player) {
      return
    }
    switch (this.phase) {
      case Phase.Pregame:
        this.sendMessage('lobby', 'No game is in progress')
        break;
      case Phase.Night:
        // player cannot vote
        if (!player.role.canVoteNight) {
          return
        }

        this.addVote(player, voteName)
        break;
      // lynch
      case Phase.Day:
        this.addVote(player, voteName)
        break;
      default:
        break;
    }
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

  // forceCompleteDayVotes() {
  //   // find first villager
  //   let targetName = ''
  //   for (let player of this.players) {
  //     if (player.role.type === RoleType.Villager) {
  //       targetName = player.name
  //       break
  //     }
  //   }

  //   for (let player of this.players) {
  //     // TODO: debug stuff
  //     // don't force vote for myself
  //     // if (player.id === MyselfID) {
  //     //   continue
  //     // }
      
  //     this.handleVote(player.role.channel.id, player.id, targetName)
  //   }
  // }

  // forceCompleteNightVotes(): any {
  //   // find first villager
  //   let targetName = ''
  //   for (let player of this.players) {
  //     if (player.role.type === RoleType.Villager) {
  //       targetName = player.name
  //       break
  //     }
  //   }

  //   for (let player of this.players) {
  //     if (!player.role.canVoteNight) {
  //       continue
  //     }
  //     // TODO: debug stuff
  //     // don't force vote for myself
  //     // if (player.id === MyselfID) {
  //     //   continue
  //     // }
  //     // doctor bot targets himself
  //     if (player.role.type === RoleType.Doctor) {
  //       this.handleVote(player.role.channel.id, player.id, player.name)
  //       continue
  //     }
      
  //     this.handleVote(player.role.channel.id, player.id, targetName)
  //   }
  // }

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
    
    await player.member.removeRoles(player.member.roles)
    await player.member.addRole(discordRole)
  }

  async movePlayerToDayChannel(player: Player) {
    let dayRole = this.roles.find(ro => ro.type === RoleType.Day)!
    const discordRole = dayRole.discordRole
    
    await player.member.removeRoles(player.member.roles)
    await player.member.addRole(discordRole)
  }

  async setPhase(phase: Phase) {
    this.sendMessage('lobby', `Setting phase: ${Phase[phase]}`)
    this.phase = phase

    this.checkIfGameover()

    // reset voting
    this.voting = {}
    for (let role of this.roles) {
      if (phase === Phase.Night) {
        if (!role.canVoteNight) {
          continue
        }
      }
      if (phase === Phase.Day) {
        if (!role.canVoteDay) {
          continue
        }
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
      // role.channel.bulkDelete(100)

      if (this.phase === Phase.Night && role.canVoteNight
       || this.phase === Phase.Day && role.canVoteDay) {
        this.setVoteOptions(role.name)
      }
    }

    // move each player to the channel that belongs to his assigned role
    if (phase === Phase.Night) {
      for (let player of this.players) {
        await this.movePlayerToNightChannel(player)
      }
      for (let role of this.roles) {
        if (role.canVoteNight) {
          this.status(role)
        }
      }
    } else if (phase === Phase.Day) {
      for (let player of this.players) {
        await this.movePlayerToDayChannel(player)
      }
      this.status(this.findRole('day'))
    }

    // start timer that ends phase
    setTimeout(this.performAllVoteActions, this.getPhaseDuration())
  }

  getPhaseDuration(): number {
    switch (this.phase) {
    case Phase.Night:
      return this.nightTimeSeconds
    case Phase.Day:
      return this.dayTimeSeconds
    default:
      throw new Error('getPhase was called at an incorrect time')
    }
  }

  // randomly assigns a GAME role to all the players in the game
  // this does not assign the discord users the actual discord roles, which
  // happens when a phase is set.
  // moves unassigned players to the assigned player list
  randomlyAssignRoles() {
    // const DebugForce = false

    let assignableRoles = [...this.roles.filter(ro => ro.isNightRole)!]
    

    // TODO: debug remove
    // force role on myself
    // if (DebugForce) {
    //   const roleToForce = RoleType.Cop

    //   const myselfPlayer = this.unassignedPlayers.find(pl => pl.id === MyselfID)!
      // if (myselfPlayer.id === MyselfID) {
      //   let forcedRole = assignableRoles.find(ro => ro.type === roleToForce)!
      //   let forcedRoleIdx = assignableRoles.findIndex(ro => ro.type === roleToForce)!

      //   myselfPlayer.role = forcedRole
      //   this.players.push({
      //     ...myselfPlayer,
      //     role: myselfPlayer.role
      //   })

      //   // decrement role amount
      //   forcedRole.leftToAssign--

      //   if (forcedRole.leftToAssign === 0) {
      //     assignableRoles.splice(forcedRoleIdx, 1)
      //   }
      // }
    // }

    for (let i = 0; i < this.playerLimit; i++) {
      let uap = this.unassignedPlayers[i]
      // we're forcing outselves into a role, don't add again
      // if (DebugForce) {
      //   if (uap.id === MyselfID) {
      //     continue
      //   }
      // }

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

    // during the day, everyone can vote for everyone
    if (roleType === RoleType.Day) {
      this.players.forEach(pl => {
        this.voting[roleName].votes[pl.id] = 0
      })
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
    // let fakePlayer = FakePlayers.find(fp => fp.name === name)!
    // if (fakePlayer) {
    //   return FakePlayers.find(fp => fp.id === fakePlayer.id)
    // }

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
      const voting = this.voting[player.role.name]
      if (voting) {
        if (voting.alreadyVoted[player.id]) {
          text += ` [voted] `
        }
      }
      if (numVotes && numVotes > 0) {
        text += `- ${numVotes} votes`
      }
      text += '\n'

      castVotes += text
    }
    return castVotes
  }

  getWinningVote(role: Role): Player {
    let roleVoting = this.voting[role.name]
    // if (!roleVoting.isCompleted) {
    //   throw new Error('trying to get winning vote for incomplete vote')
    // }

    // find max votes
    let maxVotes = -1
    let maxVotesPlayerID = ''

    // move votes into array
    let votesArr = []
    for (let playerID in roleVoting.votes) {
      let amount = roleVoting.votes[playerID]
      votesArr.push({
        playerID: playerID,
        amount: amount,
      })
    }
    // get random max vote
    votesArr = shuffle(votesArr)

    for (let vote of votesArr) {
      if (vote.amount > maxVotes) {
        maxVotes = vote.amount
        maxVotesPlayerID = vote.playerID
      }
    }
    
    return this.findPlayer(maxVotesPlayerID)!
  }

  prepareVoteAction(role: Role) {
    let actionDestPlayer = this.getWinningVote(role)
    
    switch (role.type) {
      // mark someone for death
      case RoleType.Day:
      case RoleType.Mafia:
        this.murderTarget = actionDestPlayer
        break;
      // prevent death 
      case RoleType.Doctor:
        if (this.murderTarget && actionDestPlayer.id === this.murderTarget.id)
        this.murderTarget = null
        break;
      case RoleType.Cop:
        const isTargetInnocent = actionDestPlayer.role.isInnocent
        
        this.investigation.target = actionDestPlayer
        this.investigation.isInnocent = isTargetInnocent
        break
      default:
        break
    }
  }

  performLynching() {
    if (!this.murderTarget) {
      throw new Error('didnt have lynch target')
    }

    this.killPlayer()
  }

  async performAllNightActions() {
    // doctor needs to act last, so type out order manually
    this.prepareVoteAction(this.findRole('mafia'))
    this.prepareVoteAction(this.findRole('cop'))
    this.prepareVoteAction(this.findRole('doctor'))

    let murdered = this.maybePerformMurder()

    for (let role of this.roles) {
      if (!role.canVoteNight) {
        continue
      }

      await role.channel.send('All votes complete. Day begins in 5 seconds')
    }

    setTimeout(async () => {
      this.setPhase(Phase.Day)

      // murder results
      if (murdered && this.murderTarget) {
        // TODO: if shouldRevealRole
        this.sendMessage('day', `${this.murderTarget.member}, the ${this.murderTarget.role.name} was murdered`)
      }
      if (!murdered) {
        this.sendMessage('day', `Nobody was murdered last night`)
      }
      this.murderTarget = null

      // DM investigation results to cop
      let copPlayer = this.players.find(pl => pl.role.type === RoleType.Cop)!
      let dm = await copPlayer.member.createDM()
      const investigationResult =
  `Your investigation reveals that ${this.investigation.target!.name} is ${this.investigation.isInnocent ? 'innocent' : 'guilty'}`
      await dm.send(investigationResult)
      this.investigation = { target: null, isInnocent: false }
    }, 5000)
  }

  async performAllDayActions() {
    this.prepareVoteAction(this.findRole('day'))
    this.performLynching()


    // lynch results
    if (this.murderTarget) {
      await this.sendMessage('day', `${this.murderTarget.member}, the ${this.murderTarget.role.name} was murdered\nNight begins in 5 seconds`)
    }

    this.murderTarget = null

    setTimeout(() => {
      this.setPhase(Phase.Night)
    }, 5000)
  }

  performAllVoteActions = async () => {
    if (this.phase === Phase.Night) {
      await this.performAllNightActions()
    } else {
      this.performAllDayActions()
    }
  }

  checkIfGameover() {
    const mafiaCount = this.players.filter(pl => pl.role.isInnocent === false).length
    const innoCount = this.players.filter(pl => pl.role.isInnocent === true).length

    let endGame = async () => {
      await this.guild.members.forEach(async mbmr => {
        await mbmr.removeRoles(mbmr.roles)
      }) 
      this.manager.endGame(this)
    }

    if (mafiaCount === 0) {
      this.sendMessage('lobby', 'The village has won!')
      endGame()
      return
    } else if (mafiaCount >= innoCount) {
      this.sendMessage('lobby', 'The mafia has won!')
      endGame()
      return
    }
  }

  async killPlayer() {
    let playerIdx = this.players.findIndex(pl => {
      return pl.id === this.murderTarget!.id
    })!
    let player = this.players[playerIdx]
    await player.member.removeRoles(player.member.roles)
    player.member.addRole(this.findRole('lobby').discordRole)
    // remove target from player array
    this.players.splice(playerIdx, 1)
  }

  // kill mafia vote target if doctor didn't save
  // returns if someone died or not
  maybePerformMurder(): boolean {
    if (this.murderTarget) {
      this.killPlayer()
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
      if (this.phase === Phase.Night && !role.canVoteNight) {
        continue
      }
      if (this.phase === Phase.Day && !role.canVoteDay) {
        continue
      }
      // if there is noone alive in this role
      if (!this.players.find(pl => pl.role.type === role.type)) {
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
      let dayStatusText = `It is daytime.\n\nVote for who to lynch today by doing \`.vote <name>\`\n\nOptions are:\n`
      dayStatusText += this.getCastVotes(role) + '\n'

      role.channel.send(dayStatusText)
      break
    case Phase.Night:
      switch (role.type) {
      case RoleType.Mafia:
        let mafiaStatusText = `You are the mafia.\n\nVote on who to kill tonight by doing \`.vote <name>\`\n\nOptions are:\n`
        mafiaStatusText += this.getCastVotes(role) + '\n'

        role.channel.send(mafiaStatusText)
        break
      case RoleType.Doctor:
        let doctorStatusText = `You are the doctor.\n\nVote for who to save tonight by doing \`.vote <name>\`\n\nOptions are:\n`
        doctorStatusText += this.getCastVotes(role) + '\n'

        role.channel.send(doctorStatusText)
        break
      case RoleType.Cop:
        let copStatusText = `You are the cop.\n\nVote for who to investigate tonight by doing \`.vote <name>\`\n\nOptions are:\n`
        copStatusText += this.getCastVotes(role) + '\n'

        role.channel.send(copStatusText)
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

  removePlayer(member: Discord.GuildMember) {
    let playerIdx = this.unassignedPlayers.findIndex(player => player.id === member.id)
    if (playerIdx != -1) {
      this.unassignedPlayers.splice(playerIdx, 1)
      this.sendMessage('lobby', 'You have left the queue')
      return
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