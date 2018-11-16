// describe('get winning votes for role', () => {
//   test('it fucks', () => {

//   })

// })

//   getWinningVote(role: Role): Player {
//     let roleVoting = this.voting[role.name]
//     if (!roleVoting.isCompleted) {
//       throw new Error('trying to get winning vote for incomplete vote')
//     }

//     // find max votes
//     let maxVotes = -1
//     let maxVotesPlayerID = ''

//     // move votes into array
//     let votesArr = []
//     for (let playerID in roleVoting.votes) {
//       let amount = roleVoting.votes[playerID]
//       votesArr.push({
//         playerID: playerID,
//         amount: amount,
//       })
//     }
//     // get random max vote
//     votesArr = shuffle(votesArr)

//     for (let vote of votesArr) {
//       if (vote.amount > maxVotes) {
//         maxVotes = vote.amount
//         maxVotesPlayerID = vote.playerID
//       }
//     }
    
//     return this.findPlayer(maxVotesPlayerID)!
//   }