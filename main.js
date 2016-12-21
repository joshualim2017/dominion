var express = require('express');
var http = require('http');
var fs = require('fs');
var app = express()
var server = http.Server(app);
var io = require('socket.io')(server);
app.use(express.static(__dirname + '/public'));
server.listen(1337);

app.get('/',function(req, res){
  res.sendFile(__dirname + '/client.html');
});


//START GLOBAL VARIABLES
currPlayer = 0;
gameStarted=false;
maxNumPlayers = 4;
currNumPlayers = 0
players = {};

//END GLOBAL VARIABLES



io.sockets.on('connection', function(socket) {
	//if client gets a message on the socket named "message to server", then add the first two clients to the list
	socket.on('joinGame', function() { 
		if (currNumPlayers < maxNumPlayers) {
			players[currNumPlayers] = socket.id;
			io.sockets.connected[socket.id].emit("joinGameAttempt", {success: true, name: "Player " + currNumPlayers});
			//go in here if the last player is about to join
			if (currNumPlayers == maxNumPlayers - 1) {
				for (player in players) {
					var playerId = players[player];
					io.sockets.connected[playerId].emit("startGame");
					io.sockets.connected[playerId].emit("startTurn", {name: "Player " + currPlayer});
				}
			}
			currNumPlayers += 1;
		} else {
			io.sockets.connected[socket.id].emit("joinGameAttempt", {success: false});
		}

		// testing to make sure it works - send to clientside to see that it actually changes
		io.sockets.emit("output", ["List of players/accepted sockets", players]); 

	});

	//update current player, CHECK GAME END CONDITIONS, notify all clients of current player
	socket.on('endTurn', function() {
		updateCurrentPlayer();
		//CHECK END CONDITIONS
		for (player in players) {
			var playerId = players[player];
			io.sockets.connected[playerId].emit("startTurn", {name: "Player " + currPlayer});
		}
	});

	socket.on('test', function (data) {
		if (!gameStarted) {

		io.sockets.connected[socket.id].emit("game", createStartingHand());
		gameStarted = true;
		} 
	});
});

//returns the number of next player
function updateCurrentPlayer() {
	currPlayer = (currPlayer + 1) % maxNumPlayers;
}

function createStartingHand() {
	var hand = [
	{
		name: 'copper',
		quantity: 7,
		src: '/cards/copper.jpg',
		classes: 'card cardSize'
	},
	{
		name: 'estate',
		quantity: 3,
		src: '/cards/estate.jpg',
		classes: 'card cardSize'
	}];
	return hand;
}

