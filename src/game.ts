import Discord from 'discord.js'
import R from 'ramda'
import safeJsonStringify from 'safe-json-stringify'

function inspect(obj: object) {
  // console.log(JSON.stringify(obj, function( key, value) {
  //   if (key == 'parent') { 
  //     return value.id 
  //   }
  //   return value
  // }))
  console.log('/--inspecting:')
  console.log(safeJsonStringify(obj))
  console.log(':inspecting--/')
}

function getRandomInt(max: number) {
  return Math.floor(Math.random() * Math.floor(max));
}

type DiscordRoleID = string
class DiscordUser extends Discord.User { }

interface Role {
  name: string
  id: DiscordRoleID
  amount: number
}

const GameSettings: {roles: Role[]} = {
  roles: [
    {
      name: 'villager',
      id: '489520599819878400',
      amount: 3,
    },
    { 
      name: 'mafia',
      id: '489520538297958404',
      amount: 2,
    }, 
    {
      name: 'cop',
      id: '489520649887285248',
      amount: 1,
    },
    {
      name: 'doctor',
      id: '489520695357865986',
      amount: 1,
    }
  ]
}
     
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
      if (!(guildID in this.games)) {
        const lobbyChannel = message.channel
        this.games[guildID] = new Game(lobbyChannel)
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
        const user = message.author
        const playerID = user.id
        const playerName = user.username
        game.addPlayer(user, playerID, playerName)  
        break
      case 'status':
        game.status()  
        break
      case 'fill':
        let fakePlayers = [
        {
          id: '0',
          name: 'One',
        },
        {
          id: '1',
          name: 'Two',
        },
        {
          id: '2',
          name: 'Three',
        },
        {
          id: '3',
          name: 'Four',
        },
        {
          id: '4',
          name: 'Five',
        },
        {
          id: '5',
          name: 'Six',
        },
        ]
        fakePlayers.forEach(p => {
          const fakeUser = new DiscordUser(this.disc, { id: '<pretend>' })
          game.addPlayer(fakeUser, p.id, p.name)  
        })
        break
      case 'ins':
        inspect(game.players)
      }
    })
  }
}

interface Player {
  userRef: Discord.User
  id: string
  name: string
  role: string
}

// A game on one server
class Game {
  // bot prefix. configurable per server
  prefix: string
  // holds the players
  players: Player[]
  // how many players are required to start a game
  playerLimit: number
  // are we currently looking for players?
  isLookingForPlayers: boolean
  // is the game in progress?
  isGameStarted: boolean
  // various channels
  channels: { lobby: Discord.TextChannel | Discord.DMChannel | Discord.GroupDMChannel }

  constructor(lobby: Discord.TextChannel | Discord.DMChannel | Discord.GroupDMChannel) {
    this.prefix = '.'
    this.playerLimit = 7
    this.players = []
    this.isLookingForPlayers = false
    this.isGameStarted = false
    this.channels = {
      lobby: lobby
    }
  }

  startLookingForPlayers () {
    if (this.isGameStarted) {
      this.channels.lobby.send('A game is already in progress')
      return
    }
    if (this.isLookingForPlayers) {
      this.status()
      return
    }

    // start looking for players
    this.isLookingForPlayers = true
    this.players = []

    this.channels.lobby.send(`Starting new game: looking for ${this.playerLimit} players...`)
  }

  start() {
    this.isLookingForPlayers = false
    this.isGameStarted = true

    this.channels.lobby.send('Starting game...')
    // some sort of timer here

    // assign roles
    this.assignRoles()
  }

  setPlayerRole(player: Player, role: Role) {
    player.role = role.name
    
  }

  assignRoles() {
    let roles = R.clone(GameSettings.roles)

    for (let i = 0; i < this.playerLimit; i++) {
      // get random role
      const randomRoleIdx = getRandomInt(roles.length)
      let randomRole = roles[randomRoleIdx]

      // give role
      this.players[i].role = randomRole.name
      // decrement role amount
      randomRole.amount--

      if (randomRole.amount === 0) {
        roles.splice(randomRoleIdx, 1)
      }
    }

    inspect(this.players)
  }

  status() {
    if (this.isLookingForPlayers) {
      const statusText =
      `Currently looking for players
Have: [${this.players.map(p => p.name).toString()}]
Looking for ${this.playerLimit - this.players.length} more players`

      this.channels.lobby.send(statusText)
      return
    }
  }

  // _addFakePlayer = (msg: Discord.Message) => {
  //   // add the player to the list
  //   this.players.push({
  //     id: 'fake_id',
  //     name: 'FakeName',
  //   })

  //   // if we have all the players needed to start the game
  //   if (this.players.length === this.playerLimit) {
  //     // start the game
  //     this.start()
  //   }
  // }

  addPlayer(userRef: Discord.User, id: string, name: string, ) {
    if (this.isGameStarted) {
      this.channels.lobby.send('A game is already in progress')
      return
    }
    if (!this.isLookingForPlayers) {
      this.channels.lobby.send('No game currently scheduled')
      return
    }
    // player already joined queue
    if (this.players.find(player => player.id === id)) {
      this.channels.lobby.send(name+', you have already joined the queue!')
      return
    }

    // add the player to the list
    this.players.push({
      userRef: userRef,
      id: id,
      name: name,
      role: 'none',
    })
    this.channels.lobby.send(name+' joined the game')

    // if we have all the players needed to start the game
    if (this.players.length === this.playerLimit) {
      // start the game
      this.start()
    }
  }
}

export default GameManager