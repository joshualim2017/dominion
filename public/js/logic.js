

        $( document ).ready(function() {
        console.log( "document loaded" );
        var username;
        var cardInfo = {
            'copper' : { src: '/cards/copper.jpg',
                         classes: 'card cardSize'},
            'estate' : { src: '/cards/estate.jpg',
                         classes: 'card cardSize'},                        
            'duchy' : { src: '/cards/duchy.jpg',
                         classes: 'card cardSize'},
            'province' : { src: '/cards/province.jpg',
                         classes: 'card cardSize'},  
            'silver' : { src: '/cards/silver.jpg',
                         classes: 'card cardSize'},
            'gold' : { src: '/cards/gold.jpg',
                         classes: 'card cardSize'},   
             'smithy' : { src: '/cards/smithy.jpg',
                         classes: 'card cardSize'},  
             'woodcutter' : { src: '/cards/woodcutter.jpg',
                         classes: 'card cardSize'},   
             'village' : { src: '/cards/village.jpg',
                         classes: 'card cardSize'},  
             'market' : { src: '/cards/market.jpg',
                         classes: 'card cardSize'},  
             'laboratory' : { src: '/cards/laboratory.jpg',
                         classes: 'card cardSize'},  
             'festival' : { src: '/cards/festival.jpg',
                         classes: 'card cardSize'}, 
             'chapel' : { src: '/cards/chapel.jpg',
                         classes: 'card cardSize'},
             'feast' : { src: '/cards/feast.jpg',
                         classes: 'card cardSize'},  
             'remodel' : { src: '/cards/remodel.jpg',
                         classes: 'card cardSize'},   
             'moneylender' : { src: '/cards/moneylender.jpg',
                         classes: 'card cardSize'},
             'cellar' : { src: '/cards/cellar.jpg',
                         classes: 'card cardSize'},
             'workshop' : { src: '/cards/workshop.jpg',
                         classes: 'card cardSize'},
             'mine' : { src: '/cards/mine.jpg',
                         classes: 'card cardSize'},
            'curse' : { src: '/cards/curse.jpg',
                         classes: 'card cardSize'},
            'council_room' : { src: '/cards/council_room.jpg',
                         classes: 'card cardSize'},


        }

/**************************
*  START EVENT LISTENERS  *
***************************/
            //click join game button
            $("#joinGame").click(function(){
                joinGame();
            });  

            //click end turn button
            $("#button0").click(function() {
                socketio.emit("button", {button: 0});
            });

            //click a buy button
            $(document).on('click', '.ableToBuy', buyCard);
    
            $(document).on('click', '.card', selectCard);

/**************************
*    END EVENT LISTENERS  *
***************************/
            
/**************************
*  START SOCKET LISTENERS  *
***************************/            
            var socketio = io.connect("127.0.0.1:1337");

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
            displayTurnInfo(data.name, data.numActions, data.numBuys, data.numTreasures, data.actionText);
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
                updateTurnInfo(data.numActions, data.numBuys, data.numTreasures, data.cardPlayed, data.actionText);
                //extra effect add in later for actions
           });

           socketio.on('resolveBuyCard', function(data) {
             updateTurnInfo(undefined, data.numBuys, data.numTreasures, undefined, data.actionText);
             setUpShop(data.shop);
           });

           socketio.on('updateTurnInfo', function(data) {
                updateTurnInfo(data.numActions, data.numBuys, data.numTreasures, data.cardPlayed, data.actionText);
           });           

           socketio.on('ableToBePurchasedCards', function(data) {
                updateAbleToBePurchasedCards(data.ableToBePurchasedCards);
           });

           socketio.on('playableCards', function(data) {
                updatePlayableCards(data.playableCards);
           });


           socketio.on('actionTextAndButton', function(data) {
                updateTurnInfo(undefined, undefined, undefined, undefined, data.actionText);
                updateButtons(data.button0, data.button1);
                
           });

           socketio.on('updateShop', function(data) {
                setUpShop(data.shop);
           });


           socketio.on('hand', function(data) {
                var card;
                $("#hand div").remove();
                for (var i =0; i <data.hand.length; i++) {
                    card = data.hand[i];
                    displayHandCard(card);
                }
           });

        //for feast
            socketio.on('removeLastCardInPlayedCardsZone', function() {
                $("#playedCards div").last().remove()
           });

           socketio.on('endedTurn', function() {
            endTurn();
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

            //if LEGAL (highlighted) send card to server, remove from hand, dont' put in played cards area yet (will do it when server send it back)
            function selectCard(event){
                var card, cardName, index;
                card = event.target;
                //check if highlighted
                if (card.classList.contains('yellow-border')) {
                    cardName = card.getAttribute("data-card");
                    //send to server
                    socketio.emit("selectCard", {selectedCard: cardName});
                }
            }

            //input string name of card, will convert to card object using cardInfo
            function displayHandCard(cardStr) {
                var card = cardInfo[cardStr];
              $("#hand").append("<div class='card-wrapper'>" +
                                 "<img src='" + card.src + "' data-card='" + cardStr + "'class='" + card.classes + "'>" + 
                                "</div>");
                
            }

            //displays the card in shop with the quantity
            function displayShopCard(cardStr, quantity) {
                var card = cardInfo[cardStr];

                 $("#shopSection").append(
                    "<div class='card-wrapper'>" +
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
                //clear all cards in shop first
                $("#shopSection div").remove();
                //sort because order not guaranteed across clients
                cardsInShop = Object.keys(shopFromServer).sort();
                for (var i = 0; i < cardsInShop.length; i++) {
                    currentCard = cardsInShop[i];
                    displayShopCard(currentCard, shopFromServer[currentCard]);
                }
            }


            // for the clients that will begin the game, display the needed objects to start a game
            function startGame() {
                $(".turnInfo").show();
                $("#button0").show();
                $("#button0").prop('disabled', true);
            }

            //allow client to execute turn
            function startTurn(numActions, numBuys, numTreasures) {
                $("#button0").prop('disabled', false);
                //IGNORE ACTION CARDS FOR NOW
            }


            //display whose turn it is and the actions,buys,treasures and remove the cards played from last turn
            function displayTurnInfo(currPlayer, numActions, numBuys, numTreasures, actionText) {              
                $("#playedCards div").remove();
                $("#actionText").prop("innerHTML", actionText);
                $("#numTreasures").prop("innerHTML", numTreasures);
                $("#numBuys").prop("innerHTML", numBuys);
                $("#numActions").prop("innerHTML", numActions);
            }

            //end current player's turn: 1) send discarded cards to server, clear hand, clear hand cards in UI, disable endTurn button
            function endTurn() {
                $("#hand div").remove();
                $("#shopSection button").hide();
                $("#button0").prop('disabled', true);
            }

            //display card in playedCards section and update A/B/T
            function updateTurnInfo(numActions, numBuys, numTreasures, cardStr, actionText) {
                if (cardStr !== undefined) {
                    var card = cardInfo[cardStr];
                    $("#playedCards").append("<div class='card-wrapper'>" + 
                                                "<img src='" + card.src + "' data-card='" + cardStr + "'class='" + card.classes + "'>" + 
                                              "</div>");
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
                if (actionText !== undefined) {
                    $("#actionText").prop("innerHTML", actionText);
                }
            }

            function updateAbleToBePurchasedCards(ableToBePurchasedCards) {
                var buyButtons, i, j, currentCard, currentButton;
                //clear everything first
                $("#shopSection button").hide();
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

            function updatePlayableCards(playableCards) {
                var handCards, i, j, currentPlayableCard, currentHandCard;
                handCards = $("#hand img");
                for (i=0; i<playableCards.length; i++){
                    currentPlayableCard = playableCards[i]
                    for (j=0; j<handCards.length;j++) {
                        currentHandCard = handCards[j];
                        if (currentPlayableCard === currentHandCard.getAttribute("data-card")) {
                            $(currentHandCard).addClass("yellow-border");
                            //don't break because the cards aren't unique
                        }
                    }  
                }
            }

            function updateButtons(button0, button1) {
                if (typeof button0 === "boolean") {
                    button0 ? $("#button0").show() : $("#button0").hide();  
                } else if (typeof button0 === "string") {
                    $("#button0").show();
                    $("#button0").prop("innerHTML", button0);
                    $("#button0").prop('disabled', false);
                }

                if (typeof button1 === "boolean") {
                    button1 ? $("#button1").show() : $("#button1").hide();  
                } else if (button1 !== undefined) {
                    $("#button1").show();
                    $("#button1").prop("innerHTML", button1);
                    $("#button1").prop('disabled', false);
                }
            }
    });
        