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
                 type: "V",
             	pointValue:1},                        
    'duchy' : { cost: 5,
                 type: "V",
             	pointValue:3},
    'province' : { cost: 8,
                 type: "V",
             	pointValue:6},  
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
             	 special: true,
             	 default: 4,
             	 current: 4,
             	 actionText: "Trash up to 4 cards."},
    'feast' :  {cost: 4,
         		type: "A",
     			special: true,
     			actionText: "Choose a card to gain."},
    'remodel' :  {cost: 4,
         		type: "A",
     			special: true,
     			trashedCost: undefined,
     			actionText: ["Choose a card to trash.", "Choose a card to gain."]},
    'mine' :  {cost: 5,
         		type: "A",
     			special: true,
     			trashedCost: undefined,
     			actionText: ["Choose a Treasure card to trash.", "Choose a Treasure card to gain."]},
    'moneylender' :  {cost: 4,
         		type: "A",
     			special: true,
     			actionText: "Choose a copper to trash."},
    'curse' :  {cost: 0,
         		type: "C",
             	pointValue:-1},
    'gardens' : {cost: 4,
    			 type: "V",
    			 pointValue: undefined},
    'cellar' :  {cost: 2,
                 type: "A",
				 turnEffect: {action: 1},
             	 special: true,
             	 numDiscarded: 0,
             	 actionText: "Discard as many cards as you want."},
    'workshop' :  {cost: 3,
         		type: "A",
     			special: true,
     			actionText: "Choose a card to gain."},
    'council_room' :  {cost: 5,
         		type: "A",
				turnEffect: {card: 4, buy: 1},
     			special: true},
    'witch' :  {cost: 5,
         		type: "A",
				turnEffect: {card: 2},
     			special: true},
    'chancellor' :  {cost: 3,
         		type: "A",
     			special: true,
     			turnEffect: {treasure: 2},
     			actionText: "Discard entire deck?"},

}


//END GLOBAL VARIABLES

///////////////////////////
//START SOCKET LISTENERS//
//////////////////////////

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
		if (currPhase === "cardPhase") {
			resolveSpecialCase("buyButton", data.cardToBuy); 
		} else if (canBuyCard(data.cardToBuy)) {
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

///////////////////////////
//END SOCKET LISTENERS////
//////////////////////////

///////////////////////////
//START UTIL FUNCTIONS////
//////////////////////////
function canBuyCard(card) {
	return (numBuys > 0) && (shopCards.indexOf(card) > -1) && (numTreasures >= cardInfo[card].cost) && (shop[card] > 0) 
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
	for (i = 0; i < hand.length; i++) {
		 if (cardInfo[hand[i]].type === type) {
		 	treasureCards.push(hand[i]);
		 }
	}
	return treasureCards;
}

//given a playerId and card name, returns a list of CARDNAME cards in that player's hand
function getSpecficCardsInHand(playerId, cardName) {
	var hand, i, cards;
	cards = [];
	hand = playerHands[playerId];
	for (i = 0; i < hand.length; i++) {
		 if (hand[i] === cardName) {
		 	cards.push(hand[i]);
		 }
	}
	return cards;
}

//given a playerId and card name, returns whether or not the player has that card
function hasCardInHand(playerId, cardName) {
	var hand, i;
	hand = playerHands[playerId];
	for (i = 0; i < hand.length; i++) {
		if (hand[i] === cardName) {
			return true;
		}
	}
	return false;
}

//given a playerId, type, and/or card, returns a string of the desired actionText
function createActionText(playerId, type, card) {
	if (type === "playCard"){ 
		return "Player " + playerId + " played " + card + ".";
	}
	if (type === "gainCard") {
		return "Player " + playerId + " gained " + card + ".";
	}
	if (type === "turn") {
		return "Player " + playerId + "'s turn.";
	} 
	if (type === "win") {
		return "Player " + playerId + " wins!";
	}
}

//given a playerId, returns a list all of that player's cards
function getAllCards(playerId) {
	return playerHands[playerId].concat(playerDecks[playerId]).concat(playerDiscardPile[playerId]);
}

///////////////////////////
//END UTIL FUNCTIONS//////
//////////////////////////


//update current player, CHECK GAME END CONDITIONS, notify all clients of current player
function endTurn() {
	discardHandAndPlayedCards();
	io.sockets.connected[playerSocketIds[currPlayer]].emit("endedTurn");
	drawCards(currPlayer, 5);
	updateCurrentPlayer();
	resetTurnInfo();
	//CHECK END CONDITIONS
	if (isGameOver()) {
		for (playerId in playerSocketIds) {
			var socketId = playerSocketIds[playerId];
			io.sockets.connected[socketId].emit("actionTextAndButton", {actionText: createActionText(computeWinner(), "win", ""), button0: false, button1: false});
		}
		return;
	}
	for (playerId in playerSocketIds) {
		var socketId = playerSocketIds[playerId];
		io.sockets.connected[socketId].emit("startTurn", {"name": "Player " + currPlayer, "numActions":numActions, 
			"numBuys":numBuys, "numTreasures":numTreasures, actionText:createActionText(currPlayer, "turn", "")});
	}
	io.sockets.connected[playerSocketIds[currPlayer]].emit("ableToBePurchasedCards", {"ableToBePurchasedCards": computeAbleToBePurchasedCards()});
	io.sockets.connected[playerSocketIds[currPlayer]].emit("playableCards", {"playableCards": computePlayableCards()});

	io.sockets.connected[playerSocketIds[currPlayer]].emit("output", calculateVictoryPoints(currPlayer));
}

//checks end conditions
function isGameOver() {
	if (shop['province'] === 0) {
		return true;
	}
    var emptyPiles = 0;
	for (var i =0; i < shopCards.length; i++) {
		if (shop[shopCards[i]] === 0) {
			emptyPiles += 1;
		}
	}
	return emptyPiles >= 3;
	
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
	var deck = ['copper','copper','copper','copper','copper','copper','copper','estate','estate','estate', "chancellor"];
		// var deck = ['copper','village','workshop', 'witch'];
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
	shop = {"copper": 40, "estate": 8, "duchy": 8, "province": 8, "silver": 40, "gold": 40, "village":10, "remodel":10, "smithy":10, 
		"market":10, "laboratory": 10, "festival": 10, "chapel": 10, "moneylender":10, "mine":10, "curse": 10, "gardens": 8, "workshop":10};
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
				"numActions": numActions, "numBuys": numBuys, "actionText": createActionText(currPlayer, "playCard", cardName)});
		}

		if (card.special !== undefined) {
			applyAdvancedCardEffects(cardName);
		}
		else if (numActions === 0) {
			currPhase = "treasurePhase";
		}


	}
	if (card.type === "T") {
		numTreasures += card.value;
		for (playerId in playerSocketIds) {
			var socketId = playerSocketIds[playerId];
			io.sockets.connected[socketId].emit("resolvePlayedCard", {"cardPlayed": cardName, "numTreasures": numTreasures, "actionText": createActionText(currPlayer, "playCard", cardName)});
		}
	}
	io.sockets.connected[playerSocketIds[currPlayer]].emit("ableToBePurchasedCards", {"ableToBePurchasedCards": computeAbleToBePurchasedCards()});
	io.sockets.connected[playerSocketIds[currPlayer]].emit("hand", {"hand": playerHands[currPlayer]});
	io.sockets.connected[playerSocketIds[currPlayer]].emit("playableCards", {"playableCards": computePlayableCards()});
}

//returns a list of cards that can be purchased
function computeAbleToBePurchasedCards(dataObject) {
	var ableToBePurchasedCards, 
	ableToBePurchasedCards = [];
	//if it is in a cardPhase, default is that no cards can be purchased
	if (currPhase === "cardPhase") {

		if (currCardPhase === "feast") {
		
			ableToBePurchasedCards = getTypeShopCardsUpToAmt(5);
		
		} else if (currCardPhase === "workshop") {
			
			ableToBePurchasedCards = getTypeShopCardsUpToAmt(4);

		} else if (currCardPhase === "remodel") {
			
			if (typeof cardInfo["remodel"].trashedCost === "number") {
				ableToBePurchasedCards = getTypeShopCardsUpToAmt(cardInfo["remodel"].trashedCost + 2);
			} 
		} else if (currCardPhase === "mine") {
			
			if (typeof cardInfo["mine"].trashedCost === "number") {
				ableToBePurchasedCards = getTypeShopCardsUpToAmt(cardInfo["mine"].trashedCost + 3, "T");
			} 
		}


	} else if (numBuys > 0) {
		ableToBePurchasedCards = getTypeShopCardsUpToAmt(numTreasures);
	}
	return ableToBePurchasedCards;
}

function getTypeShopCardsUpToAmt(amt, type) {
	var cards, currCard, i;
	cards = [];
	for (i = 0; i < shopCards.length; i++) {
		currCard = shopCards[i];
		//enough money AND card still available
		if (amt >= cardInfo[currCard].cost && shop[currCard] > 0 && (type === undefined || cardInfo[currCard].type === type)) {
			cards.push(currCard);
		}
	}
	return cards;
}

//assume that the everything is legal
function buyCard(card) {
	numBuys -= 1;
	currPhase = "buyPhase";
	numTreasures -= cardInfo[card].cost;
	gainCard(currPlayer, card);
	io.sockets.connected[playerSocketIds[currPlayer]].emit("ableToBePurchasedCards", {"ableToBePurchasedCards": computeAbleToBePurchasedCards()});
	io.sockets.connected[playerSocketIds[currPlayer]].emit("playableCards", {"playableCards": computePlayableCards()});
}

//assumes that this card can be gained
function gainCard(playerId, card) {
	shop[card] -= 1;
	playerDiscardPile[playerId].push(card);
	for (pId in playerSocketIds) {
		var socketId = playerSocketIds[pId];
		io.sockets.connected[socketId].emit("resolveBuyCard", {"numBuys": numBuys, "numTreasures": numTreasures, "shop": shop, 
																actionText: createActionText(playerId, "gainCard", card)});
	}
}

function discardHandAndPlayedCards() {
	var cardsToDiscard = playerHands[currPlayer].concat(currPlayedCards);
	playerHands[currPlayer] = [];
	currPlayedCards = []
	playerDiscardPile[currPlayer] = playerDiscardPile[currPlayer].concat(cardsToDiscard);	
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
	if (currCardPhase === "chapel" || currCardPhase === "cellar") {
		return playerHands[currPlayer];
	} else if (currCardPhase === "feast" || currCardPhase === "workshop" || currCardPhase === "chancellor") {
		return [];
	} else if (currCardPhase === "remodel") {
		if (typeof cardInfo["remodel"].trashedCost === "number") {
			return [];
		} else {
			return playerHands[currPlayer];
		}
	} else if (currCardPhase === "mine") {
		if (typeof cardInfo["mine"].trashedCost === "number") {
			return [];
		} else {
			return getTypeCardsInHand(currPlayer, "T");
		}
	} else if (currCardPhase === "moneylender") {
		return getSpecficCardsInHand(currPlayer, "copper");
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
	var changePhase = true;
	if (cardName === "chapel") {
		if (playerHands[currPlayer].length === 0) {
			changePhase = false;
		} else {
			io.sockets.connected[playerSocketIds[currPlayer]].emit("actionTextAndButton", {actionText: cardInfo[cardName].actionText, button0: "Done Trashing" });
		}
	} else if (cardName === "feast" || cardName === "workshop") {
		io.sockets.connected[playerSocketIds[currPlayer]].emit("actionTextAndButton", {actionText: cardInfo[cardName].actionText, button0: false});
	} else if (cardName === "remodel") {
		if (playerHands[currPlayer].length === 0) {
			changePhase = false;
		} else {
			io.sockets.connected[playerSocketIds[currPlayer]].emit("actionTextAndButton", {actionText: cardInfo[cardName].actionText[0], button0: false});		
		}
	} else if (cardName	=== "mine") {
		if (getTypeCardsInHand(currPlayer, "T").length === 0) {
			changePhase = false;
		} else {
			io.sockets.connected[playerSocketIds[currPlayer]].emit("actionTextAndButton", {actionText: cardInfo[cardName].actionText[0], button0: false});		
		}
	} else if (cardName === "moneylender") {
		if (!hasCardInHand(currPlayer, "copper")) {
			changePhase = false;
		} else {
			io.sockets.connected[playerSocketIds[currPlayer]].emit("actionTextAndButton", {actionText: cardInfo[cardName].actionText, button0: false});		
		}
	} else if (cardName === "cellar") {
		if (playerHands[currPlayer].length === 0) {
			changePhase = false;
		} else {
			io.sockets.connected[playerSocketIds[currPlayer]].emit("actionTextAndButton", {actionText: cardInfo[cardName].actionText, button0: "Done Discarding" });
		}
	}  else if (cardName === "council_room") {
		changePhase = false;
		for (var i=0; i <currNumPlayers; i++) {
			if (i != currPlayer) {
				drawCards(i, 1);
			}
		}
	} else if (cardName === "witch") {
		changePhase = false;
		for (var i=0; i <currNumPlayers; i++) {
			if ((i != currPlayer) && (shop['curse'] > 0)) {
				gainCard(i, "curse");
			}
		}
	} else if (cardName === "chancellor") {
		
	io.sockets.connected[playerSocketIds[currPlayer]].emit("output", [playerDiscardPile[currPlayer], playerDecks[currPlayer]]);
		io.sockets.connected[playerSocketIds[currPlayer]].emit("actionTextAndButton", {actionText: cardInfo[cardName].actionText, button0: "Yes", button1: "No"});
	}

	if (changePhase) {
		currPhase = "cardPhase";
		currCardPhase = cardName;

	} else if (numActions === 0) {
		currPhase = "treasurePhase";
	}	
}


//inputType: button or card. inputName: 0 or 1 for button, cardname for card
function resolveSpecialCase(inputType, inputName) {
	//store extra information in here
	if (currCardPhase === "chapel") {
		if (inputType === "card") {
			playerHands[currPlayer].splice(playerHands[currPlayer].indexOf(inputName), 1);
			trash.push(inputName);
			cardInfo[currCardPhase].current = cardInfo[currCardPhase].current - 1;
		}
		if ((inputType === "button" && inputName === 0) || (cardInfo[currCardPhase].current === 0) || (playerHands[currPlayer].length === 0)) {
			cardInfo[currCardPhase].current = cardInfo[currCardPhase].default;
			removeCardPhase();
			io.sockets.connected[playerSocketIds[currPlayer]].emit("actionTextAndButton", {"actionText": createActionText(currPlayer, "turn", undefined), "button0": "End Turn" });
		}
		
	} else if (currCardPhase === "feast") {
		if (inputType === "buyButton") {
			shop[inputName] -= 1;
			playerDiscardPile[currPlayer].push(inputName);
			//remove feast from currPlayedCards
			currPlayedCards.pop()
			trash.push(currCardPhase);
			removeCardPhase();
			for (playerId in playerSocketIds) {
				var socketId = playerSocketIds[playerId];
				io.sockets.connected[socketId].emit("actionTextAndButton", {"actionText": createActionText(currPlayer, "gainCard", inputName), "button0": true});
				io.sockets.connected[socketId].emit("updateShop", {"shop": shop});
				io.sockets.connected[socketId].emit("removeLastCardInPlayedCardsZone");
			}
		}
	} else if (currCardPhase === "remodel") {
		if (inputType === "card") {
			playerHands[currPlayer].splice(playerHands[currPlayer].indexOf(inputName), 1);
			trash.push(inputName);
			cardInfo[currCardPhase].trashedCost = cardInfo[inputName].cost; 
			io.sockets.connected[playerSocketIds[currPlayer]].emit("actionTextAndButton", {"actionText": cardInfo[currCardPhase].actionText[1]});
		}
		if (inputType === "buyButton") {
			shop[inputName] -= 1;
			playerDiscardPile[currPlayer].push(inputName);
			cardInfo[currCardPhase].trashedCost = undefined; 	
			removeCardPhase();
			for (playerId in playerSocketIds) {
				var socketId = playerSocketIds[playerId];
				io.sockets.connected[socketId].emit("actionTextAndButton", {"actionText": createActionText(currPlayer, "gainCard", inputName), "button0": true});
				io.sockets.connected[socketId].emit("updateShop", {"shop": shop});
			}
		}
	} else if (currCardPhase === "mine") {
		if (inputType === "card") {
			playerHands[currPlayer].splice(playerHands[currPlayer].indexOf(inputName), 1);
			trash.push(inputName);
			cardInfo[currCardPhase].trashedCost = cardInfo[inputName].cost; 
			io.sockets.connected[playerSocketIds[currPlayer]].emit("actionTextAndButton", {"actionText": cardInfo[currCardPhase].actionText[1]});
		}
		if (inputType === "buyButton") {
			shop[inputName] -= 1;
			playerHands[currPlayer].push(inputName);
			cardInfo[currCardPhase].trashedCost = undefined; 	
			removeCardPhase();
			for (playerId in playerSocketIds) {
				var socketId = playerSocketIds[playerId];
				io.sockets.connected[socketId].emit("actionTextAndButton", {"actionText": createActionText(currPlayer, "gainCard", inputName), "button0": true});
				io.sockets.connected[socketId].emit("updateShop", {"shop": shop});
			}
		}
	} else if (currCardPhase === "moneylender") {
		if (inputType === "card") {
			playerHands[currPlayer].splice(playerHands[currPlayer].indexOf(inputName), 1);
			trash.push(inputName);
			numTreasures += 3;
			removeCardPhase();
			for (playerId in playerSocketIds) {
				var socketId = playerSocketIds[playerId];
				io.sockets.connected[socketId].emit("updateTurnInfo", {"numTreasures" : numTreasures});
				io.sockets.connected[socketId].emit("actionTextAndButton", {"button0": true});
			}
		}
	} else if (currCardPhase === "cellar") {
		if (inputType === "card") {
			playerHands[currPlayer].splice(playerHands[currPlayer].indexOf(inputName), 1);
			playerDiscardPile[currPlayer].push(inputName);
			cardInfo[currCardPhase].numDiscarded += 1;
		}
		if ((inputType === "button" && inputName === 0) || (playerHands[currPlayer].length === 0)) {
			drawCards(currPlayer, cardInfo[currCardPhase].numDiscarded);
			cardInfo[currCardPhase].numDiscarded = 0;
			removeCardPhase();
			io.sockets.connected[playerSocketIds[currPlayer]].emit("actionTextAndButton", {"actionText": createActionText(currPlayer, "turn", undefined), "button0": "End Turn" });
		}
	} else if (currCardPhase === "workshop") {
		if (inputType === "buyButton") {
			shop[inputName] -= 1;
			playerDiscardPile[currPlayer].push(inputName);
			removeCardPhase();
			for (playerId in playerSocketIds) {
				var socketId = playerSocketIds[playerId];
				io.sockets.connected[socketId].emit("actionTextAndButton", {"actionText": createActionText(currPlayer, "gainCard", inputName), "button0": true});
				io.sockets.connected[socketId].emit("updateShop", {"shop": shop});
			}
		}
	} else if (currCardPhase === "chancellor") {
		if (inputType === "button") {
			if (inputName === 0) {
				playerDiscardPile[currPlayer] = playerDiscardPile[currPlayer].concat(playerDecks[currPlayer]);
				playerDecks[currPlayer] = [];
			} 
			removeCardPhase();
			io.sockets.connected[playerSocketIds[currPlayer]].emit("actionTextAndButton", {"actionText": createActionText(currPlayer, "turn", undefined), "button0": "End Turn", "button1": false });
		}
	}

	io.sockets.connected[playerSocketIds[currPlayer]].emit("output", [playerDiscardPile[currPlayer], playerDecks[currPlayer]]);
	io.sockets.connected[playerSocketIds[currPlayer]].emit("ableToBePurchasedCards", {"ableToBePurchasedCards": computeAbleToBePurchasedCards()});
	io.sockets.connected[playerSocketIds[currPlayer]].emit("hand", {"hand": playerHands[currPlayer]});
	io.sockets.connected[playerSocketIds[currPlayer]].emit("playableCards", {"playableCards": computePlayableCards()});
}

function removeCardPhase() {
	currCardPhase = "";
	if (numActions > 0) {
		currPhase = "actionPhase";
	} else {
		currPhase = "treasurePhase";
	}
}

function calculateVictoryPoints(playerId) {
	var allCards, i, currCard, victoryPoints;
	victoryPoints = 0;
	allCards = getAllCards(playerId);

	for (i = 0; i < allCards.length; i++) {
		currCard = allCards[i];
		if (cardInfo[currCard].type === "V" || cardInfo[currCard].pointValue != undefined) {
			if (currCard === "gardens") {
				victoryPoints += computeGardensValue(playerId);
			} else {
				victoryPoints += cardInfo[currCard].pointValue;
			}
		}
	}
	return victoryPoints;
}


function computeGardensValue(playerId) {
	return Math.floor(getAllCards(playerId).length / 10);
}
 
function computeWinner() {
	var scores, i;
	scores = [];
	for (i = 0; i < currNumPlayers; i++) {
		scores.push(calculateVictoryPoints(i));
	}
	return scores.indexOf(Math.max.apply(null,scores));
}