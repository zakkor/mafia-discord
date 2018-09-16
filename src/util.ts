export function inspect(obj: object) {
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

export function getRandomInt(max: number) {
  return Math.floor(Math.random() * Math.floor(max));
}