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
var currPlayer = 0;
var gameStarted=false;
var maxNumPlayers = 2;
var currNumPlayers = 0
var playerSocketIds = {};
var playerDecks = {} 
var playerDiscardPile={}
var shop = {} 

//END GLOBAL VARIABLES



io.sockets.on('connection', function(socket) {
	//if client gets a message on the socket named "message to server", then add the first two clients to the list
	socket.on('joinGame', function() { 
		if (currNumPlayers < maxNumPlayers) {
			playerSocketIds[currNumPlayers] = socket.id;
			playerDecks[currNumPlayers] = [];
			playerDiscardPile[currNumPlayers] = [];
			io.sockets.connected[socket.id].emit("joinGameAttempt", {success: true, name: "Player " + currNumPlayers});
			//go in here if the last player is about to join
			if (currNumPlayers == maxNumPlayers - 1) {
				startGame();
			}
			currNumPlayers += 1;
		} else {
			io.sockets.connected[socket.id].emit("joinGameAttempt", {success: false});
		}

		// testing to make sure it works - send to clientside to see that it actually changes
		io.sockets.emit("output", ["List of players/accepted sockets", playerSocketIds]); 

	});


	//update current player, CHECK GAME END CONDITIONS, notify all clients of current player
	socket.on('endTurn', function(data) {
		playerDiscardPile[currPlayer] = playerDiscardPile[currPlayer].concat(data.cardsToDiscard);
		io.sockets.emit("output", ["Player's discard pile", playerDiscardPile[currPlayer]]); 
		drawCards(currPlayer, 5);
		updateCurrentPlayer();
		//CHECK END CONDITIONS
		for (playerId in playerSocketIds) {
			var socketId = playerSocketIds[playerId];
			io.sockets.connected[socketId].emit("startTurn", {name: "Player " + currPlayer});
		}
	});
});

//returns the number of next player
function updateCurrentPlayer() {
	currPlayer = (currPlayer + 1) % maxNumPlayers;
}

//do required actions to start game, create starting hands, send shop info  to clients, etc.
function startGame() {
	for (playerId in playerSocketIds) {
		var socketId = playerSocketIds[playerId];
		playerDecks[playerId] = createStartingDeck();
		drawCards(playerId,5);
		initializeDefaultShop();
		io.sockets.connected[socketId].emit("shop", {"shop": shop}),
		io.sockets.connected[socketId].emit("startGame");
		io.sockets.connected[socketId].emit("startTurn", {name: "Player " + currPlayer});
	}	
}

//pops of the first numCards of player's deck and send them to the player
function drawCards(playerId, numCards) {
	var cardsToDraw = [];
	var socketId = playerSocketIds[playerId];
	for (var i = 0; i < numCards; i++) {
		if (playerDecks[playerId].length == 0) {
			playerDecks[playerId] = shuffleDeck(playerDiscardPile[playerId]);
			playerDiscardPile[playerId] = [];
			//EDGE CASE if discard is empty, then stop. 
		}
		cardsToDraw.push(playerDecks[playerId].shift());
	}
	io.sockets.connected[socketId].emit("cardsToDraw", {quantity: cardsToDraw.length, cards: cardsToDraw});
}

function createStartingDeck() {
	var deck = ['copper','copper','copper','copper','copper','copper','copper','estate','estate','estate'];
	return shuffleDeck(deck);
}

//does not alter original arr, only makes copy
function shuffleDeck(arr) {
	var randomNum, arrIndex, copiedArr, shuffledDeck, originalLength;
	copiedArr = arr.copyWithin();
	shuffledDeck = [];
	originalLength = copiedArr.length;
	for (var i = 0; i < originalLength; i++) {
		randomNum = Math.random();
		//use current length, not original lenght
		arrIndex = Math.floor(randomNum * copiedArr.length);
		//pop the arrIndexth element out
		shuffledDeck = shuffledDeck.concat(copiedArr.splice(arrIndex, 1));
	}
	return shuffledDeck;
}

//initialize default shop; changes global variable, does not return anything
function initializeDefaultShop() {
	shop = {"copper": 40, "estate": 8, "duchy": 8, "province": 8, "silver": 40, "gold": 40};
}