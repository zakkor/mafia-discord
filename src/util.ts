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

export function shuffle<T>(array: Array<T>) {
  var currentIndex = array.length, temporaryValue, randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}