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
var playerDecks = {};
var playerDiscardPile={};
var shop = {}; 
var shopCards = [];
var numActions = 1;
var numBuys = 1;
var numTreasures = 0;

var cardInfo = {
    'copper' : { cost: 0,
    		     value: 1,
                 type: "T"},
    'estate' : { cost: 2,
                 classes: 'card cardSize',
                 type: "V"},                        
    'duchy' : { cost: 5,
                 classes: 'card cardSize',
                 type: "V"},
    'province' : { cost: 8,
                 classes: 'card cardSize',
                 type: "V"},  
    'silver' : { cost: 3,
    			 value: 2,
                 type: "T"},
    'gold' : {   cost: 6,
             	 value: 3,
                 type: "T"},   
}

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

	});

	socket.on('playCard', function(data) {
		resolvePlayedCard(data.cardToPlay);
	});

	socket.on('buyCard', function(data) {
		if (canBuyCard(data.cardToBuy)) {
			buyCard(data.cardToBuy);
		}
	});

	//update current player, CHECK GAME END CONDITIONS, notify all clients of current player
	socket.on('endTurn', function(data) {
		playerDiscardPile[currPlayer] = playerDiscardPile[currPlayer].concat(data.cardsToDiscard);
		io.sockets.emit("output", ["Player's discard pile", playerDiscardPile[currPlayer]]); 
		drawCards(currPlayer, 5);
		updateCurrentPlayer();
		resetTurnInfo();
		//CHECK END CONDITIONS
		for (playerId in playerSocketIds) {
			var socketId = playerSocketIds[playerId];
			io.sockets.connected[socketId].emit("startTurn", {"name": "Player " + currPlayer, "numActions":numActions, 
				"numBuys":numBuys, "numTreasures":numTreasures});
		}
		io.sockets.connected[playerSocketIds[currPlayer]].emit("ableToBePurchasedCards", {"ableToBePurchasedCards": computeAbleToBePurchasedCards()});
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
		io.sockets.connected[socketId].emit("startGame", {"shop": shop});
		io.sockets.connected[socketId].emit("startTurn", {name: "Player " + currPlayer, 
			"numActions":numActions, "numBuys":numBuys, "numTreasures":numTreasures});
	}	
	io.sockets.connected[playerSocketIds[currPlayer]].emit("ableToBePurchasedCards", {"ableToBePurchasedCards": computeAbleToBePurchasedCards()});
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

//initialize default shop; changes 2 global variables - shop and shopCards, does not return anything
function initializeDefaultShop() {
	shop = {"copper": 40, "estate": 8, "duchy": 8, "province": 8, "silver": 40, "gold": 40};
	shopCards = Object.keys(shop);
}

//reset buys, actions, treasures
function resetTurnInfo() {
	numBuys = 1;
	numActions = 1;
	numTreasures = 0;
}

//resolves playing a card, sends current player list of able to be bought cards
function resolvePlayedCard(cardName) {
	var card = cardInfo[cardName];
	if (card.type === "T") {
		numTreasures += card.value;
		for (playerId in playerSocketIds) {
			var socketId = playerSocketIds[playerId];
			io.sockets.connected[socketId].emit("resolvePlayedCard", {"cardPlayed": cardName, "numTreasures": numTreasures});
		}
	}
	io.sockets.connected[playerSocketIds[currPlayer]].emit("ableToBePurchasedCards", {"ableToBePurchasedCards": computeAbleToBePurchasedCards()});
}

//returns a list of cards that can be purchased
function computeAbleToBePurchasedCards() {
	var ableToBePurchasedCards, currCard, i;
	ableToBePurchasedCards = [];
	if (numBuys > 0) {
		for (i = 0; i < shopCards.length; i++) {
			currCard = shopCards[i];
			//enough money AND card still available
			if (numTreasures >= cardInfo[currCard].cost && shop[currCard] > 0) {
				ableToBePurchasedCards.push(currCard);
			}
		}
	}
	return ableToBePurchasedCards;
}

//assume that the everything is legal
function buyCard(card) {
	numBuys -= 1;
	numTreasures -= cardInfo[card].cost;
	shop[card] -= 1;
	playerDiscardPile[currPlayer].push(card);
	for (playerId in playerSocketIds) {
		var socketId = playerSocketIds[playerId];
		io.sockets.connected[socketId].emit("resolveBuyCard", {"numBuys": numBuys, "numTreasures": numTreasures, "shop": shop});
	}
}

function canBuyCard(card) {
	return (numBuys > 0) && (shopCards.indexOf(card) > -1) && (numTreasures >= cardInfo[card].cost) && (shop[card] > 0) 
}