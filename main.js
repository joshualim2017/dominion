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

gameStarted=false;
players = {};

io.sockets.on('connection', function(socket) {
	//if client gets a message on the socket named "message to server", then add the first two clients to the list
	socket.on('joinGame', function() { 
		var numPlayers = Object.keys(players).length;
		if (numPlayers < 2) {
			players[numPlayers] = socket.id;
			io.sockets.connected[socket.id].emit("joinGameAttempt", true);
			//go in here if the second player is about to join
			if (numPlayers == 1) {
				for (player in players) {
					var playerId = players[player];
					io.sockets.connected[playerId].emit("startGame");
				}
			}
		} else {
			io.sockets.connected[socket.id].emit("joinGameAttempt", false);
		}

		// testing to make sure it works - send to clientside to see that it actually changes
		io.sockets.emit("output", ["List of players/accepted sockets", players]); 

	});
	socket.on('test', function (data) {
		if (!gameStarted) {

		io.sockets.connected[socket.id].emit("game", createStartingHand());
		gameStarted = true;
		} 
	});
});

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