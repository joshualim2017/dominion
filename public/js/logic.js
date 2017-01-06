

        $( document ).ready(function() {
        console.log( "document loaded" );
        var username;
        var hand = [];
        var playedCards = [];
        var shop = {};
        var cardInfo = {
            'copper' : { src: '/cards/copper.jpg',
                         classes: 'card cardSize',
                         type: "T"},
            'estate' : { src: '/cards/estate.jpg',
                         classes: 'card cardSize',
                         type: "V"},                        
            'duchy' : { src: '/cards/duchy.jpg',
                         classes: 'card cardSize',
                         type: "V"},
            'province' : { src: '/cards/province.jpg',
                         classes: 'card cardSize',
                         type: "V"},  
            'silver' : { src: '/cards/silver.jpg',
                         classes: 'card cardSize',
                         type: "T"},
            'gold' : { src: '/cards/gold.jpg',
                         classes: 'card cardSize',
                         type: "T"},   
        }

/**************************
*  START EVENT LISTENERS  *
***************************/
            //click join game button
            $("#joinGame").click(function(){
                joinGame();
            });  

            //click end turn button
            $("#endTurn").click(function() {
                endTurn();
            });

            //click a buy button
            $(document).on('click', '.ableToBuy', buyCard);
    
            $(document).on('click', '.card', playCard);

/**************************
*    END EVENT LISTENERS  *
***************************/
            
/**************************
*  START SOCKET LISTENERS  *
***************************/            
            var socketio = io.connect("127.0.0.1:1337");

            socketio.on("message_to_client", function(data) {
                document.getElementById("chatlog").innerHTML = ("<hr/>" + 
                    data['message'] + document.getElementById("chatlog").innerHTML);
                });
          
            //used for testing. output[0] is descriptive string, output[1] is what you want to output
           socketio.on("output", function(output) {
            console.log(output);
                });

           socketio.on('joinGameAttempt', function(success) {
            resolveJoinGameAttempt(success);
           });  
           

           socketio.on('game', function(cards) {
                for (var i = 0; i < cards.length; i++) {
                    displayHandCard(cardInfo[cards[i]]);
                }
            });

           socketio.on('startTurn', function(data) {
            displayTurnInfo(data.name, data.numActions, data.numBuys, data.numTreasures);
            if (data.name === username) {
                startTurn();
            } 
           });

           //display shop, display turn info, start player 1's turn
           socketio.on('startGame', function(data) {
                startGame();
                setUpShop(data.shop)
           });

           socketio.on('resolvePlayedCard', function(data) {
                //update UI for all players
                updateTurnInfo(data.numActions, data.numBuys, data.numTreasures, data.cardPlayed);
                //extra effect add in later for actions
           });

           socketio.on('resolveBuyCard', function(data) {
             updateTurnInfo(undefined, data.numBuys, data.numTreasures, undefined);
             $("#shopSection div").remove();
             setUpShop(data.shop);
           });

           socketio.on('ableToBePurchasedCards', function(data) {
                updateAbleToBePurchasedCards(data.ableToBePurchasedCards);
           });

           socketio.on('cardsToDraw', function(data) {
                var card;
                $.merge(hand, data.cards);
                for (var i =0; i < data.quantity; i++) {
                    card = data.cards[i];
                    displayHandCard(card);
                }
           });


/**************************
*  END SOCKET LISTENERS  *
***************************/
            function joinGame() {
                socketio.emit("joinGame");
            }

            function resolveJoinGameAttempt(data) { 
            if (data.success) {
                $("#joinGame").prop('innerHTML', "Joined"); 
                username = data.name;
                console.log("You are " + username);
            } else {
                $("#joinGame").prop('innerHTML', "Failed to Join"); 
            }
              $("#joinGame").prop('disabled', true);
            }

            function selectCard(event) {
                var currentCard = event.target;
                var currentSelected = $(".selected");
                for (var i=0; i < currentSelected.length; i++) {
                    currentSelected[i].classList.remove("selected");
                }
                currentCard.classList.add("selected");
            }

            //if LEGAL (highlighted) send card to server, remove from hand, dont' put in played cards area yet (will do it when server send it back)
            function playCard(event){
                var card, cardName, index;
                card = event.target;
                //check if highlighted
                if (card.classList.contains('yellow-border')) {
                    cardName = card.getAttribute("data-card");
                    //remove from UI
                    card.remove();
                    //Remove from hand array
                    index = hand.indexOf(cardName);
                    hand.splice(index, 1);
                    //put card into playedCards array
                    playedCards.push(cardName);
                    //send to server
                    socketio.emit("playCard", {cardToPlay: cardName});
                }
            }

            //input string name of card, will convert to card object using cardInfo
            function displayHandCard(cardStr) {
                var card = cardInfo[cardStr];
              $("#hand").append("<img src='" + card.src + "' data-card='" + cardStr + "'class='" + card.classes + " " +  card.type + "'>");
                
            }

            //displays the card in shop with the quantity
            function displayShopCard(cardStr, quantity) {
                var card = cardInfo[cardStr];

                 $("#shopSection").append(
                    "<div class='shopCard'>" +
                        "<img src='" + card.src + "' data-card='" + cardStr + "' class='" + card.classes + "'>" + 
                        "<p class='quantity'>" + 
                            quantity + 
                        "</p>" +
                        "<button class='ableToBuy' data-card='" + cardStr + "'>" +
                            "+" +
                        "</button>" +
                     "</div>");
            }

            //setup work for shop; input shop is an object with {shopCard : quantity}
            function setUpShop(shopFromServer){
                var cardsInShop, currentCard;
                shop = shopFromServer;
                //sort because order not guaranteed across clients
                cardsInShop = Object.keys(shopFromServer).sort();
                for (var i = 0; i < cardsInShop.length; i++) {
                    currentCard = cardsInShop[i];
                    displayShopCard(currentCard, shop[currentCard]);
                }
            }


            // for the clients that will begin the game, display the needed objects to start a game
            function startGame() {
                $(".turnInfo").show();
                $("#endTurn").show();
                $("#endTurn").prop('disabled', true);
            }

            //allow client to execute turn
            function startTurn(numActions, numBuys, numTreasures) {
                $("#endTurn").prop('disabled', false);
                //IGNORE ACTION CARDS FOR NOW
                if (hasTreasureCards()) {
                    $("#hand img.T").toggleClass("yellow-border");
                    //ToDO-  play treasures button
                }
            }

            function hasTreasureCards() {
                for (var i = 0; i < hand.length; i++) {
                    if (cardInfo[hand[i]].type === "T") {
                        return true;
                    }
                }
                return false;
            }
            //display whose turn it is and the actions,buys,treasures and remove the cards played from last turn
            function displayTurnInfo(currPlayer, numActions, numBuys, numTreasures) {
                //display "Player X's Turn" 
                $("#playedCards img").remove();
                $("#numTreasures").prop("innerHTML", numTreasures);
                $("#numBuys").prop("innerHTML", numBuys);
                $("#numActions").prop("innerHTML", numActions);
               console.log("Starting " + currPlayer + "'s turn.");
            }

            //end current player's turn: 1) send discarded cards to server, clear hand, clear hand cards in UI, disable endTurn button
            function endTurn() {
                socketio.emit("endTurn", {cardsToDiscard: hand.concat(playedCards)});
                playedCards = [];
                hand = [];
                $("#hand img").remove();
                $("#shopSection button").hide();
                $("#endTurn").prop('disabled', true);
            }

            //display card in playedCards section and update A/B/T
            function updateTurnInfo(numActions, numBuys, numTreasures, cardStr) {
                if (cardStr !== undefined) {
                    var card = cardInfo[cardStr];
                    $("#playedCards").append("<img src='" + card.src + "' data-card='" + cardStr + "'class='" + card.classes + " " +  card.type + "'>");
                }
                if (numActions !== undefined) {
                    $("#numActions").prop("innerHTML", numActions);
                } 
                if (numBuys !== undefined) {
                    $("#numBuys").prop("innerHTML", numBuys);
                }
                if (numTreasures !== undefined) {
                    $("#numTreasures").prop("innerHTML", numTreasures);
                }
            }

            function updateAbleToBePurchasedCards(ableToBePurchasedCards) {
                var buyButtons, i, j, currentCard, currentButton;
                buyButtons = $("#shopSection button");
                for (i=0; i<ableToBePurchasedCards.length; i++ ) {
                    currentCard = ableToBePurchasedCards[i]
                    for (j=0; j<buyButtons.length; j++) {
                        currentButton = buyButtons[j];
                        if (currentCard === currentButton.getAttribute("data-card")) {
                            $(currentButton).show();
                            break;
                        }
                    }
                }
            }

            function buyCard(event) {
                var cardToBuy = event.currentTarget.getAttribute("data-card");
                $("#shopSection button").hide();
                //later on verify on server side - CANNOT PLAY CARDS AFTER FIRST BUY
                $("#hand img").removeClass("yellow-border");
                socketio.emit("buyCard", {"cardToBuy": cardToBuy});
            }
    });
        