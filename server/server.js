const express = require("express")
const app = express()
const http = require("http")

const {Server} = require("socket.io")
const cors = require("cors")
const { join } = require("path")

app.use(cors())

const server = http.createServer(app)


const { networkInterfaces } = require('os');

const nets = networkInterfaces();
const results = Object.create(null); // Or just '{}', an empty object

for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
        // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
        // 'IPv4' is in Node <= 17, from 18 it's a number 4 or 6
        const familyV4Value = typeof net.family === 'string' ? 'IPv4' : 4
        if (net.family === familyV4Value && !net.internal) {
            if (!results[name]) {
                results[name] = [];
            }
            results[name].push(net.address);
        }
    }
}

const ip = results["en0"][0]

const io = new Server(server,{
  cors: {
    origin: ["http://localhost:3000", "http://"+ip+":3000"],
    methods: ["GET","POST"]
  }
})
const rows = 20

function createDeafultBoard(){
  let newBoard = []
        
  for (let i=0;i<rows;i++){
      let curRow = []
      for (let j=0;j<rows;j++){
        curRow.push({value: 0, isClickedLast:false})
      }
      newBoard.push(curRow)
  }
  return newBoard
}
let rooms = {}

let player1Selected =false
let player2Selected =false
io.on("connection", (socket) => {
  let thisSocket = socket
  
  console.log("User connected: "+socket.id) 
  socket.emit("playerSelectedStatus",{player1SelectedServer: player1Selected, player2SelectedServer:player2Selected})
  //set the number of rows

  socket.on("clickBoard", ({newBoard,playerClicked, clickedLast,room})=>{
    rooms[room].pastBoard.push(newBoard)
    rooms[room].curPlayerTurn= playerClicked==1 ? 2:1
    io.to(room).emit("receiveNewBoard",{newBoard: newBoard,nextPlayer: rooms[room].curPlayerTurn, clicked: clickedLast})
  }) 
  
  socket.on("getPlayerStatus",({room})=>{
    console.log(Object.keys(rooms))
    if(room in rooms){
      io.to(room).emit("playerSelectedStatus",{player1SelectedServer: rooms[room].player1Selected, player2SelectedServer:rooms[room].player2Selected})
    }
    
  })
  socket.on("win",()=>{
  })
  socket.on("joinRoom", ({roomName}) =>{
      //check if the room exist
      if(roomName in rooms){
        rooms[roomName].numberOfPlayers++;
        console.log("new player join room "+roomName)
        console.log("There are currently "+rooms[roomName].numberOfPlayers+ " players in the room")
      }
      else{
        rooms[roomName] = {
          numberOfPlayers: 1,
          player1Selected: false,
          player2Selected: false,
          curPlayerTurn:0,
          pastBoard: [createDeafultBoard()],
        }
        console.log(Object.keys(rooms))
        console.log(rooms)
        console.log("new player join room "+roomName)
      }
      socket.join(roomName)
  }
  )
  socket.on("leaveRoom",({roomName}) => {
    socket.leave(roomName)
    rooms[roomName].numberOfPlayers--;
    if(rooms[roomName].numberOfPlayers == 0){
      delete rooms[roomName]
    }
    io.to(roomName).emit("joinRoomResponse",{message:"A player has leave room "+roomName})
  })

  socket.on("undo",(data)=>{
    let pastBoard = rooms[data.room].pastBoard
    if (pastBoard.length==1){
      io.to(data.room).emit("logCurPlayer")
      console.log("current player turn " +rooms[data.room].curPlayerTurn)
      console.log("=1 and return")
      return
    }
    else{
    rooms[data.room].curPlayerTurn = rooms[data.room].curPlayerTurn==1 ? 2:1
    pastBoard.pop()
    console.log("undo emitted")
    console.log(data.room)
    io.to(data.room).emit("receiveUndo",{oldBoard: pastBoard[pastBoard.length-1],nextTurn: rooms[data.room].curPlayerTurn})
    console.log("length of pastBoard:"+pastBoard.length)
    } 
  })

  socket.on("newGame",({room})=>{
    rooms[room] = {
      numberOfPlayers: 1,
      
      player1Selected: false,
      player2Selected: false,
      curPlayerTurn:0,
      pastBoard: [createDeafultBoard()],
    }
    io.to(room).emit("receiveNewGame")
  })

  socket.on("disconnect",(data) => {
    console.log("socket: "+socket.id+" disconnected")
  })

  socket.on("playerSelected",(data)=>{
    if(data.playerSelected==1){
      if(data.room in rooms){
        rooms[data.room].player1Selected=true
        console.log("select player 1 okay")
        io.to(data.room).emit("receivePlayerSelected",1)
      }
      else{
        console.log("select player 1 went wrong")
      }
   
    }
    if(data.playerSelected==2){
      if(data.room in rooms){
        rooms[data.room].player2Selected=true
        io.to(data.room).emit("receivePlayerSelected",2)
      }
      else{
        console.log("select player 2 went wrong")
      }
    }
  }
  )

})

server.listen(3001, () => {
  console.log("Server is running")
})
