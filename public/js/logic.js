

        $( document ).ready(function() {
        console.log( "document loaded" );
                    $("#joinGame").click(function(){
                joinGame();
            });  
            $(document).keypress(function (e) {
                if (e.which == 13) {
                    sendTest();
                }
            });

            $(document).on('click', '.card', selectCard);
            
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
                    addCard(cards[i]);
                }
            });

           socketio.on('startGame', function() {
                startGame();
           });

            function joinGame() {
                socketio.emit("joinGame");
            }
            function sendTest() {

                socketio.emit("test");
            }

            function resolveJoinGameAttempt(success) {
             if (success) {
                $("#joinGame").prop('innerHTML', "Joined"); 
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

            function addCard(card) {
                for (var i = 0; i < card.quantity; i++) {
                    $("#hand").append("<img src='" + card.src + "' class='" + card.classes + "'>")
                }
            }

            // for the clients that will begin the game, display the needed objects to start a game
            function startGame() {
                $("#endTurn").show();
            }
    });