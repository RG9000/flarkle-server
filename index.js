const express = require('express');
const app = express();
const http = require('http');
const { SocketAddress } = require('net');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
io.eio.pingTimeout = 1000000;

app.get('/', (req, res) => {
   res.send("Node Server is running. Yay!!")
})

io.on('connection', async (socket) => {
  console.log(socket.id + ' has connected');
  var currentRoom = 'lobby';
  var dicesRolled = [];
  var numRolled = 6;
  var scoreForRoll = 0;
  var scoreForRound = 0;
  var totalScore = 0;

  socket.on('find game', async () => {
    socket.join("lobby");
    console.log(socket.id + ' wants a game');
    socket.emit("searching for game");
    var clientsInLobby = await io.in('lobby').fetchSockets();
    if (clientsInLobby.length > 1)
    {
      socket.leave('lobby');
      var otherClient = clientsInLobby[0];
      var roomName = clientsInLobby[0].id + "-room";
      currentRoom = roomName;
      socket.join(roomName);
      otherClient.leave('lobby');
      otherClient.join(roomName);
      console.log("connected " + socket.id + " with " + clientsInLobby[0].id);
      socket.emit("game found", otherClient.id);
      clientsInLobby[0].emit("connected to", socket.id);
    }
  });

  socket.on('ping', () => {
   //do nothing;
  });

  socket.on('connected to', () => {
    currentRoom = socket.id + "-room";
  });

  socket.on('disconnecting', async (reason) => {
    console.log(socket.id + " is disconnecting"); 
    if (currentRoom != 'lobby')
    {
      socket.to(currentRoom).emit("game cancelled");
    }
  });

  socket.on('opponent left', async (reason) => {
    socket.leave(currentRoom);
    socket.join("lobby");
  });
  
  socket.on('hold and pass', async (nums) => {
    let score = calculateScoreForRoll(nums, dicesRolled);
    if (score == 0)
    {
      socket.emit('invalid');
      return;
    }
    scoreForRound += score;
    totalScore += scoreForRound;
    numRolled = 6;
    scoreForRound = 0;
    if (totalScore >= 4000)
    {
      socket.emit('win');
      socket.to(currentRoom).emit('lose');
      return;
    }
    socket.emit('scored', {score: score, scoreForRound: scoreForRound, totalScore: totalScore});
    socket.to(currentRoom).emit("your turn");
  });

  socket.on('hold and continue', async (nums) => {
    let score = calculateScoreForRoll(nums, dicesRolled);
    if (score == 0)
    {
      socket.emit('invalid');
      return;
    }
    scoreForRound += score;
    socket.emit('scored', {score: score, scoreForRound: scoreForRound, totalScore: totalScore});
    numRolled -= nums.length;
    console.log("nums:" + nums.length);
    console.log("numRolled: " + numRolled);
    if (numRolled == 0)
    {
      numRolled = 6;
    }
    let dices = rollDice(numRolled);
    dicesRolled = dices;
    let isBusted = checkIsBusted(dicesRolled);
    if (isBusted)
    {
      scoreForRound = 0;
      socket.to(currentRoom).emit("your turn");
    }
    socket.emit('rolled', {dices: dices, isBusted: isBusted});
  });
  
  socket.on('roll', async (num) => {
    let dices = rollDice(num);
    numRolled = num;
    dicesRolled = dices;
    let isBusted = checkIsBusted(dicesRolled);
    if (isBusted)
    {
      scoreForRound = 0;
      socket.to(currentRoom).emit("your turn");
    }
    socket.emit('rolled', {dices: dices, isBusted: isBusted});
  });

  socket.on('disconnect', async () => {
    console.log(socket.id + " has disconnected");
  });
});

server.listen(3000, () => {
  console.log('listening on *:3000');
});

function checkIsBusted(dicesRolled)
{
  return !(dicesRolled.includes(1) ||
   dicesRolled.includes(5) ||
    dicesRolled.count(2) >= 3 ||
     dicesRolled.count(3) >= 3 ||
     dicesRolled.count(4) >= 3 ||
     dicesRolled.count(6) >= 3);
}

function calculateScoreForRoll(nums, dicesRolled)
{
  var dicesSelected = [];
  console.log(nums);
  console.log(dicesRolled);
  nums.forEach(element => {
    dicesSelected.push(dicesRolled[element-1]);
    console.log(dicesRolled[element-1]);
  });
  dicesSelected.sort(function(a,b){return a - b});
  var thisScore = 0;
  while (dicesSelected.length > 0) 
  {
    if (dicesSelected.join('') == "123456")
    {
      thisScore+=1500;
      dicesSelected = [];
      console.log("got full straight");
      continue;
    }
    else if(isLowPartialStraight(dicesSelected))
    {
      thisScore+=500;
      dicesSelected = sliceOutDice(dicesSelected, 1);
      dicesSelected = sliceOutDice(dicesSelected, 2);
      dicesSelected = sliceOutDice(dicesSelected, 3);
      dicesSelected = sliceOutDice(dicesSelected, 4);
      dicesSelected = sliceOutDice(dicesSelected, 5);
      console.log("got low partial straight");
      continue;
    }
    else if(isHighPartialStraight(dicesSelected))
    {
      thisScore+=750;
      dicesSelected = sliceOutDice(dicesSelected, 2);
      dicesSelected = sliceOutDice(dicesSelected, 3);
      dicesSelected = sliceOutDice(dicesSelected, 4);
      dicesSelected = sliceOutDice(dicesSelected, 5);
      dicesSelected = sliceOutDice(dicesSelected, 6);
      console.log("got high partial straight");
      continue;
    }
    //for each dice value
    for (let i = 1; i < 7; i++)
    {
      //for each 'of a kind'
      for (let j = 6; j >= 3; j--)
      {
        if(dicesSelected.count(i) == j)
        {
          //special case for 1
          if(i == 1)
          {
            thisScore += 1000 * Math.pow(2, j - 3);
          }
          else
          {
            thisScore += (i * 100) * Math.pow(2, j - 3);
          }
          for (let k = 0; k <= j; k++)
          {
            dicesSelected = sliceOutDice(dicesSelected, i);
          }
          console.log("got " + j + " " + i + "s");
          continue;
        }
      }
    }
    if (dicesSelected.includes(1))
    {
      dicesSelected = sliceOutDice(dicesSelected, 1);
      thisScore+=100;
      continue;
    }
    else if (dicesSelected.includes(5))
    {
      dicesSelected = sliceOutDice(dicesSelected, 5);
      thisScore+=50;
      continue;
    }
   if (thisScore == 0) 
   {
    return 0;
   }
  }
  return thisScore;
}

Object.defineProperties(Array.prototype, {
    count: {
        value: function(query) {
            /* 
               Counts number of occurrences of query in array, an integer >= 0 
               Uses the javascript == notion of equality.
            */
            var count = 0;
            for(let i=0; i<this.length; i++)
                if (this[i]==query)
                    count++;
            return count;
        }
    }
});

function sliceOutDice(dices, val)
{
      let ind1 = dices.indexOf(val);
      if (ind1 > -1)
      {
        dices.splice(ind1, 1)
      }
      return dices;
}

function isLowPartialStraight(dices)
{
  return (dices.includes(1) && dices.includes(2) && dices.includes(3) && dices.includes(4) && dices.includes(5));
}
function isHighPartialStraight(dices)
{
  return (dices.includes(2) && dices.includes(3) && dices.includes(4) && dices.includes(5) && dices.includes(6));
}

function rollDice(num)
{
  results = [];
  for (var i = 0; i < num; i++)
  {
    results.push(Math.floor(Math.random() * 5) + 1);
  }
  return results;
}