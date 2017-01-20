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
var playerHands = {}
var playerDecks = {};
var playerDiscardPile={};
var currPlayedCards = [];
var shop = {}; 
var shopCards = [];
var trash = [];
var numActions = 1;
var numBuys = 1;
var numTreasures = 0;
var currPhase = "actionPhase";
var currCardPhase = "";

var cardInfo = {
    'copper' : { cost: 0,
    		     value: 1,
                 type: "T"},
    'estate' : { cost: 2,
                 type: "V"},                        
    'duchy' : { cost: 5,
                 type: "V"},
    'province' : { cost: 8,
                 type: "V"},  
    'silver' : { cost: 3,
    			 value: 2,
                 type: "T"},
    'gold' : {   cost: 6,
             	 value: 3,
                 type: "T"},
    'village' : { cost: 3,
                 type: "A",
             	 turnEffect: {action: 2, card: 1}},
    'smithy' : {  cost: 4,
                 type: "A",
                 turnEffect: {card:3}},
    'market' : {  cost: 5,
                 type: "A",
                 turnEffect: {card:1, action: 1, treasure:1, buy:1}},
    'laboratory' : {  cost: 5,
                 type: "A",
                 turnEffect: {card:2, action:1}},
    'festival' : {  cost: 5,
                 type: "A",
                 turnEffect: {action:2, treasure:2, buy: 1}},
    'woodcutter' : {cost: 3,
                 type: "A",
             	turnEffect: {buy: 1, treasure:2}},
    'chapel' :  {cost: 2,
                 type: "A",
             	 special: "chapel",
             	 default: 4,
             	 current: 4},

}


//END GLOBAL VARIABLES



io.sockets.on('connection', function(socket) {
	//if client gets a message on the socket named "message to server", then add the first two clients to the list
	socket.on('joinGame', function() { 
		if (currNumPlayers < maxNumPlayers) {
			playerSocketIds[currNumPlayers] = socket.id;
			playerDecks[currNumPlayers] = [];
			playerHands[currNumPlayers] = [];
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

	socket.on('selectCard', function(data) {
		if (currPhase == "cardPhase") {
			resolveSpecialCase("card", data.selectedCard);
		}
		else {
			resolvePlayedCard(data.selectedCard);
		}
	});

	socket.on('buyCard', function(data) {
		if (canBuyCard(data.cardToBuy)) {
			buyCard(data.cardToBuy);
		}
	});

	socket.on('button', function(data) {
		if (currPhase == "cardPhase") {
			resolveSpecialCase("button", data.button);
		}
		else if (data.button === 0) {
			endTurn();
		}
	});
});



//update current player, CHECK GAME END CONDITIONS, notify all clients of current player
function endTurn() {
	discardHandAndPlayedCards();
	io.sockets.connected[playerSocketIds[currPlayer]].emit("endedTurn");
	drawCards(currPlayer, 5);
	updateCurrentPlayer();
	resetTurnInfo();
	//CHECK END CONDITIONS
	for (playerId in playerSocketIds) {
		var socketId = playerSocketIds[playerId];
		io.sockets.connected[socketId].emit("startTurn", {"name": "Player " + currPlayer, "numActions":numActions, 
			"numBuys":numBuys, "numTreasures":numTreasures, actionText:createActionText(currPlayer, "turn", "")});
	}
	io.sockets.connected[playerSocketIds[currPlayer]].emit("ableToBePurchasedCards", {"ableToBePurchasedCards": computeAbleToBePurchasedCards()});
	io.sockets.connected[playerSocketIds[currPlayer]].emit("playableCards", {"playableCards": computePlayableCards()});	
}
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
			"numActions":numActions, "numBuys":numBuys, "numTreasures":numTreasures, actionText:createActionText(currPlayer, "turn", "")});
	}	
	io.sockets.connected[playerSocketIds[currPlayer]].emit("ableToBePurchasedCards", {"ableToBePurchasedCards": computeAbleToBePurchasedCards()});
	io.sockets.connected[playerSocketIds[currPlayer]].emit("playableCards", {"playableCards": computePlayableCards()});		
}

//pops of the first numCards of player's deck and send them to the player
function drawCards(playerId, numCards) {
	var socketId = playerSocketIds[playerId];
	for (var i = 0; i < numCards; i++) {
		if (playerDecks[playerId].length === 0) {
			if (playerDiscardPile[playerId].length ===0) {
				//exit for loop because cannot draw any more
				break;
			}
			playerDecks[playerId] = shuffleDeck(playerDiscardPile[playerId]);
			playerDiscardPile[playerId] = [];
		}
		playerHands[playerId].push(playerDecks[playerId].shift());
	}
	io.sockets.connected[socketId].emit("hand", {"hand": playerHands[playerId]});
}

function createStartingDeck() {
	var deck = ['copper','copper','copper','copper','copper','copper','copper','estate','estate','estate'];
		// var deck = ['copper','village','estate','estate','chapel'];
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
	shop = {"copper": 40, "estate": 8, "duchy": 8, "province": 8, "silver": 40, "gold": 40, "village":10, "woodcutter":10, "smithy":10, "market":10, "laboratory": 10, "festival": 10, "chapel": 10};
	shopCards = Object.keys(shop);
}

//reset buys, actions, treasures
function resetTurnInfo() {
	numBuys = 1;
	numActions = 1;
	numTreasures = 0;
	currPhase = "actionPhase";
}

//assumes card is legal. resolves playing a card, sends current player list of able to be bought cards
function resolvePlayedCard(cardName) {
	playerHands[currPlayer].splice(playerHands[currPlayer].indexOf(cardName), 1);
	currPlayedCards.push(cardName);
	var card = cardInfo[cardName];
	if (card.type === "A") {
		numActions -= 1;
		if (card.turnEffect !== undefined) {
			applyBasicCardEffects(card.turnEffect);
		}

		for (playerId in playerSocketIds) {
			var socketId = playerSocketIds[playerId];
			io.sockets.connected[socketId].emit("resolvePlayedCard", {"cardPlayed": cardName, "numTreasures": numTreasures, 
				"numActions": numActions, "numBuys": numBuys, actionText: createActionText(currPlayer, "playCard", cardName)});
		}

		if (card.special !== undefined) {
			applyAdvancedCardEffects(card.special);
		}
		else if (numActions == 0) {
			currPhase = "treasurePhase";
		}


	}
	if (card.type === "T") {
		numTreasures += card.value;
		for (playerId in playerSocketIds) {
			var socketId = playerSocketIds[playerId];
			io.sockets.connected[socketId].emit("resolvePlayedCard", {"cardPlayed": cardName, "numTreasures": numTreasures, actionText: createActionText(currPlayer, "playCard", cardName)});
		}
	}
	io.sockets.connected[playerSocketIds[currPlayer]].emit("ableToBePurchasedCards", {"ableToBePurchasedCards": computeAbleToBePurchasedCards()});
	io.sockets.connected[playerSocketIds[currPlayer]].emit("hand", {"hand": playerHands[currPlayer]});
	io.sockets.connected[playerSocketIds[currPlayer]].emit("playableCards", {"playableCards": computePlayableCards()});
}

//returns a list of cards that can be purchased
function computeAbleToBePurchasedCards() {
	var ableToBePurchasedCards, currCard, i;
	ableToBePurchasedCards = [];
	if (currPhase === "cardPhase") {
		return ableToBePurchasedCards;
	}
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
	currPhase = "buyPhase";
	numTreasures -= cardInfo[card].cost;
	shop[card] -= 1;
	playerDiscardPile[currPlayer].push(card);
	for (playerId in playerSocketIds) {
		var socketId = playerSocketIds[playerId];
		io.sockets.connected[socketId].emit("resolveBuyCard", {"numBuys": numBuys, "numTreasures": numTreasures, "shop": shop, 
																actionText: createActionText(currPlayer, "gainCard", card)});
	}
	io.sockets.connected[playerSocketIds[currPlayer]].emit("ableToBePurchasedCards", {"ableToBePurchasedCards": computeAbleToBePurchasedCards()});
	io.sockets.connected[playerSocketIds[currPlayer]].emit("playableCards", {"playableCards": computePlayableCards()});
}

function canBuyCard(card) {
	return (numBuys > 0) && (shopCards.indexOf(card) > -1) && (numTreasures >= cardInfo[card].cost) && (shop[card] > 0) 
}

function discardHandAndPlayedCards() {
	var cardsToDiscard = playerHands[currPlayer].concat(currPlayedCards);
	playerHands[currPlayer] = [];
	currPlayedCards = []
	playerDiscardPile[currPlayer] = playerDiscardPile[currPlayer].concat(cardsToDiscard);	
}

//given a playerId, returns whether or not that player's hand has TYPE cards
function hasTypeCards(playerId, type) {
	var hand = playerHands[playerId];
    for (var i = 0; i < hand.length; i++) {
        if (cardInfo[hand[i]].type === type) {
            return true;
        }
    }
    return false;
}

//given a playerId, returns a list of TYPE cards in that player's hand
function getTypeCardsInHand(playerId, type) {
	var hand, i, treasureCards;
	treasureCards = [];
	hand = playerHands[playerId];

		io.sockets.connected[playerSocketIds[currPlayer]].emit("output", [hand, playerId + "'s hand"]);
	for (i = 0; i < hand.length; i++) {
		 if (cardInfo[hand[i]].type === type) {
		 	treasureCards.push(hand[i]);
		 }
	}
	return treasureCards;
}

function computePlayableCards() {
	//if action phase is over
	var playableCards = [];
	if (currPhase === "cardPhase") {
		return computePlayableCardSpecialPhase();
	}
	if (currPhase === "actionPhase") {
		if (hasTypeCards(currPlayer, "A") == false) {
			currPhase = "treasurePhase";
		} else {
			playableCards = getTypeCardsInHand(currPlayer, "A");
		}
	}
	if (currPhase === "treasurePhase") {
		playableCards = getTypeCardsInHand(currPlayer, "T");
	}
	return playableCards;
}

function computePlayableCardSpecialPhase() {
	if (currCardPhase === "chapel") {
		return playerHands[currPlayer];
	}
}

function applyBasicCardEffects(turnEffect) {
	if (turnEffect.treasure !== undefined) {
		numTreasures += turnEffect.treasure;
	}
	if (turnEffect.buy !== undefined) {
		numBuys += turnEffect.buy;
	}
	if (turnEffect.action !== undefined) {
		numActions += turnEffect.action;
	}
	if (turnEffect.card !== undefined) {
		drawCards(currPlayer, turnEffect.card);
	}	
}

function applyAdvancedCardEffects(cardName) {
	currPhase = "cardPhase";
	currCardPhase = cardName;
	if (cardName === "chapel") {
		io.sockets.connected[playerSocketIds[currPlayer]].emit("actionTextAndButton", {actionText: createActionText(currPlayer, "prompt", cardName), button0: "Done Trashing" });
		//action text & Done Trashing
	}
}

function createActionText(playerId, type, card) {
	if (type === "prompt") {
		if (card === "chapel") {
			return "Trash up to 4 cards.";
		}
	}
	if (type === "playCard"){ 
		return "Player " + playerId + " played " + card + ".";
	}
	if (type === "gainCard") {
		return "Player " + playerId + " gained " + card + ".";
	}
	if (type === "turn") {
		return "Player " + playerId + "'s turn.";
	}
}

//inputType: button or card. inputName: 0 or 1 for button, cardname for card
function resolveSpecialCase(inputType, inputName) {
	if (currCardPhase === "chapel") {
		if (inputType === "card") {
			playerHands[currPlayer].splice(playerHands[currPlayer].indexOf(inputName), 1);
			trash.push(inputName);
			cardInfo[currCardPhase].current = cardInfo[currCardPhase].current - 1;
		}
		if ((inputType === "button" && inputName === 0) || (cardInfo[currCardPhase].current === 0)){
			cardInfo[currCardPhase].current = cardInfo[currCardPhase].default;
			removeCardPhase();
			io.sockets.connected[playerSocketIds[currPlayer]].emit("actionTextAndButton", {actionText: createActionText(currPlayer, "turn", undefined), button0: "End Turn" });
		}
		
	}
	io.sockets.connected[playerSocketIds[currPlayer]].emit("ableToBePurchasedCards", {"ableToBePurchasedCards": computeAbleToBePurchasedCards()});
	io.sockets.connected[playerSocketIds[currPlayer]].emit("hand", {"hand": playerHands[currPlayer]});
	io.sockets.connected[playerSocketIds[currPlayer]].emit("playableCards", {"playableCards": computePlayableCards()});
		io.sockets.connected[playerSocketIds[currPlayer]].emit("output", trash);
}

function removeCardPhase() {
	currCardPhase = "";
	if (numActions > 0) {
		currPhase = "actionPhase";
	} else {
		currPhase = "treasurePhase";
	}
}