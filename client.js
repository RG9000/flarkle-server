const { io } = require("socket.io-client");
const prompt = require('prompt-sync')({sigint: true});
const socket = io("ws://localhost:3000");

// ask to join a game 
socket.emit("find game");

// receive a message from the server
socket.on("searching for game", () => {
  console.log("looking for a game for you...");
});

socket.on("game found", (msg) => {
  console.log(msg);
  console.log("your opponent goes first");
});

socket.on("scored", (score) => {
  console.log("You scored " + score.score);
  console.log("Total score for round is " + score.scoreForRound);
  console.log("Total score for game " + score.totalScore);
})

socket.on("rolled", (rolls) => {
  console.log("You rolled: " + rolls.dices.map((e, i) => " "+(i+1)+":" + e + " "));
  if (rolls.isBusted)
  {
    console.log("You busted!");
    console.log("Opponent's turn!");
    return;
  }
  console.log("enter the dices you wish to keep as a space seperated list.");
  console.log("for example, to keep the first, fifth and sixth dice enter 1 5 6");
  play();
});

socket.on("invalid", () => {
  console.log("Play invalid! try again.");
  play();
});

function play()
{
  let dicesToKeep = prompt("> ");
  let dicesToKeepInts = dicesToKeep.split(" ");
  console.log("keeping dices " + dicesToKeepInts);
  let holdOrPass = prompt("Hold and pass (p) or continue (c)? ");
  if (holdOrPass == "c")
  {
    socket.emit("hold and continue", dicesToKeepInts);
  }
  else
  {
    socket.emit("hold and pass", dicesToKeepInts);
  }

}

socket.on("your turn", () => {
  console.log("Your turn!");
  let _ = prompt("Press enter to roll");
  socket.emit("roll", 6);
});

socket.on("win", () => {
  console.log("You won!!");
});

socket.on("lose", () => {
  console.log("You lost!!");
});

socket.on("connected to", (msg) => {
  console.log(msg);
  console.log("you go first");
  socket.emit("connected to");
  let _ = prompt("Press enter to roll");
  socket.emit("roll", 6);
});

socket.on("game cancelled", () => {
  console.log("your opponent left!");
  console.log("kicking you back to the lobby");
  socket.emit("opponent left");
  socket.emit("find game");
});

setInterval(function() {
   socket.emit("ping");
 }, 1000);



