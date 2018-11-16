import Discord from 'discord.js'
import GameManager from './game-manager'
import SourceMap from 'source-map-support'
SourceMap.install()

process.on('unhandledRejection', console.log);

const client = new Discord.Client()
const BOT_TOKEN = 'NDg5MjA0OTM4MzU4OTE1MDky.DoGCeQ.WmJNqs40nKjG0j7yaVqeSaaLItk'

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`)
  let game = new GameManager(client)
});

client.login(BOT_TOKEN).then(() => {
}).catch(err => {
  console.log('error:', err);
})