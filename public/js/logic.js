

        $( document ).ready(function() {
        console.log( "document loaded" );
        var username;
        var hand = [];
        var shop = {};
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

    
            //select card - CURRENTLY NOT USED
            $(document).on('click', '.card', selectCard);

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
            console.log(output[0]);
            console.log(output[1]);
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
            if (data.name === username) {
                startTurn(data.numActions, data.numBuys, data.numTreasures);
            } 
            console.log("Starting " + data.name + "'s turn.");
           });

           //display shop, display turn info, start player 1's turn
           socketio.on('startGame', function(data) {
                startGame();
                setUpShop(data.shop)
           });

           socketio.on('shop', function(data) {
                var cardsInShop, currentCard;
                shop = data.shop;
                //sort because order not guaranteed across clients
                cardsInShop = Object.keys(data.shop).sort();
                for (var i = 0; i < cardsInShop.length; i++) {
                    currentCard = cardsInShop[i];
                    displayShopCard(currentCard, shop[currentCard]);
                }
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
            function sendTest() {

                socketio.emit("test");
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

            //input string name of card, will convert to card object using cardInfo
            function displayHandCard(cardStr) {
                var card = cardInfo[cardStr];
              $("#hand").append("<img src='" + card.src + "' class='" + card.classes + "'>")
                
            }

            //displays the card in shop with the quantity
            function displayShopCard(cardStr, quantity) {
                var card = cardInfo[cardStr];

                 $("#shopSection").append("<div class='shopCard'>" +
                    "<img src='" + card.src + "' class='" + card.classes + "'>" +
                    "<p class='quantity'>" + quantity + "</p>" +
                    "</div>")
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
                $("#numTreasures").prop("innerHTML", numTreasures);
                $("#numBuys").prop("innerHTML", numBuys);
                $("#numActions").prop("innerHTML", numActions);
                $("#endTurn").prop('disabled', false);
            }

            //end current player's turn: 1) send discarded cards to server, clear hand, clear hand cards in UI, disable endTurn button
            function endTurn() {
                socketio.emit("endTurn", {cardsToDiscard: hand});
                hand = [];
                $("#hand img").remove();
                $("#endTurn").prop('disabled', true);
            }
    });