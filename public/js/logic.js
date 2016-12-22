

        $( document ).ready(function() {
        console.log( "document loaded" );
        var username;
        var hand = [];
        var cardInfo = {
            'copper' : { src: '/cards/copper.jpg',
                         classes: 'card cardSize'},
            'estate' : { src: '/cards/estate.jpg',
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
                    displayCard(cardInfo[cards[i]]);
                }
            });

           socketio.on('startTurn', function(data) {
            if (data.name === username) {
                startTurn();
            } 
            console.log("Starting " + data.name + "'s turn.");
           });

           socketio.on('startGame', function() {
                startGame();
           });

           socketio.on('cardsToDraw', function(data) {
                var card;
                $.merge(hand, data.cards);
                for (var i =0; i < data.quantity; i++) {
                    card = data.cards[i];
                    displayCard(cardInfo[card]);
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

            function displayCard(card) {
              $("#hand").append("<img src='" + card.src + "' class='" + card.classes + "'>")
                
            }

            // for the clients that will begin the game, display the needed objects to start a game
            function startGame() {
                $("#endTurn").show();
                $("#endTurn").prop('disabled', true);
            }

            //allow client to execute turn
            function startTurn() {
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