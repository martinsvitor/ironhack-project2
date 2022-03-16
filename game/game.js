
const User = require('../models/User.model');
const wordsCollection = require('../data/words.json');

const wordsList = Object.keys(wordsCollection);
const allGames = {};
const usersInGames = {};

class Game {
    constructor() {
        this.gameId = Date.now().toString(36);
        this.players = [];
        this.roundTime = 120;
        this.secondsLeft = this.roundTime;
        this.rounds = 2;
        this.currentRound = 0;
        this.timerId = null;
        this.inProgress = false;
        this.drawingData = [[]];
        this.lineIndex = 0;
        this.currentWord = null;
        this.activeRound = false;
    }

    addPlayer(userId) {
        if(!usersInGames[userId]) {
            usersInGames[userId] = this.gameId;
            User.findById(userId)
                .then(user => {
                    this.players.push({
                        username: user.username,
                        userId,
                        points: 0,
                        isReady: false,
                        drawingRoundsCount: 0
                    });
                    setTimeout(() => {
                        global.io.to(this.gameId).emit('playerlist change', this.players);
                    }, 200);
                }); 
        };
    }

    removePlayer(userId) {
        this.players = this.players.filter(player => player.userId !== userId);
        delete usersInGames[userId];
        if(this.players.length <= 0) {
            delete allGames[this.gameId];
        } else {
            setTimeout(() => {
                global.io.to(this.gameId).emit('playerlist change', this.players);
                console.log('emit playerlist change');
                // console.log(this.players);
            }, 200);
        };
    }

    endGame() {
        this.inProgress = false;
        global.io.to(this.gameId).emit('end game', this.players);
    }

    getRandomWord() {
        const randomIndex = Math.floor(Math.random() * wordsList.length);
        return wordsList[randomIndex];
    }

    playerIsReady(socketId) {
        const player = this.players.find(player => player.socketId === socketId);
        // console.log(player);
        // console.log(socketId);
        player.isReady = true;
        if(this.players.length > 1 && this.players.every(player => player.isReady) && !this.activeRound) {
            this.startRound();
        };
    }

    startRound() {
        this.inProgress = true;
        this.activeRound = true;

        const drawingPlayer = this.players[0];
        drawingPlayer.drawingRoundsCount += 1;
        this.secondsLeft = this.roundTime;

        global.io.emit('tick', this.secondsLeft);

        this.timerId = setInterval(() => {
            this.secondsLeft -= 1;
            global.io.emit('tick', this.secondsLeft);
            if(this.secondsLeft <= 0) {
                this.endRound();
            };
        }, 1000);

        this.nextWord();

        this.currentRound += 1;

        global.io.to(this.gameId).emit('start round', drawingPlayer.userId);
    }

    endRound() {
        clearInterval(this.timerId);
        this.activeRound = false;
        this.players.push(this.players.shift());
        if(this.players[0].drawingRoundsCount > this.rounds) {
            this.endGame();
        };
        this.players.forEach(player => player.isReady = false);
        global.io.to(this.gameId).emit('end round');
    }

    nextWord() {
        this.drawingData = [[]];
        this.lineIndex = 0;
        this.currentWord = this.getRandomWord();
        global.io.to(this.gameId).emit('next word', this.currentWord, this.currentRound);
    }

    correctGuess(socketId) {
        const guessingPlayer = this.players.find(player => player.socketId === socketId);
        const drawingPlayer = this.players[0];

        guessingPlayer.points += 1;
        drawingPlayer.points += 1;

        global.io.to(this.gameId).emit('playerlist change', this.players);
        this.nextWord();
    }
};

module.exports = {
    allGames,
    usersInGames,
    Game
};