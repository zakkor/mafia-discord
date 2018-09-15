import Discord from 'discord.js'
import GameManager from './game'
import SourceMap from 'source-map-support'
SourceMap.install()

process.on('unhandledRejection', console.log);

const client = new Discord.Client()
const BOT_TOKEN = 'NDg5MjA0OTM4MzU4OTE1MDky.DnnXXg.qDVy7_tv9cwfKJKEmdgzV5tRFRw'

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`)
  let game = new GameManager(client)
});

client.on('message', msg => {
  if (msg.content === 'ping') {
    msg.reply('Pong!')
  }
});

const TEST_SERVER_ID = '489106226244878338'

client.login(BOT_TOKEN).then(() => {
}).catch(err => {
  console.log('error:', err);
})