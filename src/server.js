const http = require('http');
const fs = require('fs');
const socketio = require('socket.io');

const PORT = process.env.PORT || process.env.NODE_PORT || 3000;

const index = fs.readFileSync(`${__dirname}/../client/client.html`);

const onRequest = (request, response) => {
  response.writeHead(200, {
    'Content-Type': 'text/html',
  });
  response.write(index);
  response.end();
};

const app = http.createServer(onRequest).listen(PORT);

console.log(`Listening on 127.0.0.1: ${PORT}`);

const io = socketio(app);

const users = {};

// to store chat log, so that new users can get updated on ongoing conversation
let chat = '';

const onJoined = (sock) => {
  const socket = sock;

  socket.on('join', (data) => {
    const joinMsg = {
      name: 'server',
      msg: `There are ${Object.keys(users).length} users online`,
    };
    // Returned to client for chat window telling how many that's currently on the serveR
    socket.emit('chatWindow', `Server: ${joinMsg.msg}`);
    socket.name = data.name;
    users[socket.name] = socket.name;

    socket.join('room1');
    /*
    if there is currently a conversation in the chat room,
    update the chat log of the client that has entered since the conversation started
    */
    if (chat.length > 0) {
      socket.emit('updateChat', chat);
    }
    socket.emit('msg', joinMsg);
    const response = {
      name: 'server',
      msg: `${data.name} has joined the room.`,
    };
    // tell all other clients that the client has joined the room
    socket.broadcast.emit('chatWindow', `Server: ${response.msg}`);
    socket.broadcast.to('room1').emit('msg', response);
    console.log(`${data.name} joined`);
    socket.emit('msg', { name: 'server', msg: 'You joined the room' });
    // message from server to client that the person has joined the room
    socket.emit('chatWindow', 'Server: You joined the room');
  });
};

const onMsg = (sock) => {
  const socket = sock;
  // gets message from client
  socket.on('msgToServer', (data) => {
    let msg = '';
    // if th message contains any of these commands
    // then broadcast the action instead of the command
    // action commands: /dance, /wave, /cry, /lol
    if (data.msg === '/dance') {
      io.sockets.in('room1').emit('msg', { name: socket.name, msg: `${socket.name} dances` });
      msg = (`${socket.name} dances`);
    } else if (data.msg === '/wave') {
      io.sockets.in('room1').emit('msg', { name: socket.name, msg: `${socket.name} waves` });
      msg = (`${socket.name} waves`);
    } else if (data.msg === '/cry') {
      io.sockets.in('room1').emit('msg', { name: socket.name, msg: `${socket.name} cries` });
      msg = (`${socket.name} cries`);
    } else if (data.msg === '/lol') {
      io.sockets.in('room1').emit('msg', { name: socket.name, msg: `${socket.name} is laughing out load` });
      msg = (`${socket.name} is laughing out load`);
      // if not a command, then just post the message as it is
    } else {
      io.sockets.in('room1').emit('msg', { name: socket.name, msg: data.msg });
      msg = (`${socket.name}: ${data.msg}`);
    }
    chat += (`${msg}\n`);
    io.sockets.emit('chatWindow', msg);
  });
};

const onNameChange = (sock) => {
  const socket = sock;
  socket.on('nameChange', (data) => {
    const message = `${socket.name} has changed the name to ${data.name}.`;
    socket.broadcast.to('room1').emit('msg', { name: 'server', msg: message });
    // tell the chat that the person has changed the name
    socket.broadcast.emit('chatWindow', `Server: ${message}`);
    chat += (`Server: ${msg}\n`);
    // personal client message from server
    socket.emit('chatWindow', `Server: You have changed the name to  ${data.name}`);
    // change the name of the socket, add to the list of users and delete the old sockt name
    let currName = socket.name;
    socket.name = data.name
    users[socket.name] = socket.name;
    delete users[currName];
    
  });
};

const onDisconnect = (sock) => {
  const socket = sock;
  socket.on('disconnect', (data) => {
    console.dir(data);
    const message = `${socket.name} has left the room.`;
    socket.broadcast.to('room1').emit('msg', { name: 'server', msg: message });
    // tell the chat when the client leaves the room
    socket.broadcast.emit('chatWindow', `Server: ${message}`);
    socket.leave('room1');
    delete users[socket.name];
  });
};

io.sockets.on('connection', (socket) => {
  console.log('started');

  onJoined(socket);
  onMsg(socket);
  onDisconnect(socket);
  onNameChange(socket);
});

console.log('Websocket server started');
