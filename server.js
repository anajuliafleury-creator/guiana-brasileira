const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Tamanho do mundo (em pixels)
const MUNDO_L = 1200;
const MUNDO_A = 800;

// Todos os jogadores conectados
const jogadores = {};

io.on('connection', (socket) => {
  // Novo jogador nasce na praça central
  jogadores[socket.id] = {
    id: socket.id,
    nome: 'Visitante',
    cor: '#e74c3c',
    x: 600,
    y: 420,
    destinoX: 600,
    destinoY: 420
  };

  // Manda para o novo jogador a lista de todos
  socket.emit('estadoInicial', { meuId: socket.id, jogadores });

  // Avisa os outros que alguém chegou
  socket.broadcast.emit('jogadorEntrou', jogadores[socket.id]);

  // Jogador escolheu nome e cor
  socket.on('definirPerfil', (perfil) => {
    const j = jogadores[socket.id];
    if (!j) return;
    j.nome = String(perfil.nome || 'Visitante').slice(0, 14);
    j.cor = String(perfil.cor || '#e74c3c').slice(0, 7);
    io.emit('perfilAtualizado', { id: j.id, nome: j.nome, cor: j.cor });
  });

  // Jogador clicou em algum lugar para andar
  socket.on('andarPara', (destino) => {
    const j = jogadores[socket.id];
    if (!j) return;
    j.destinoX = Math.max(20, Math.min(MUNDO_L - 20, Number(destino.x) || j.x));
    j.destinoY = Math.max(20, Math.min(MUNDO_A - 20, Number(destino.y) || j.y));
    io.emit('jogadorAndando', {
      id: j.id,
      x: j.x,
      y: j.y,
      destinoX: j.destinoX,
      destinoY: j.destinoY
    });
  });

  socket.on('disconnect', () => {
    delete jogadores[socket.id];
    io.emit('jogadorSaiu', socket.id);
  });
});

// O servidor move os jogadores 20 vezes por segundo
const VELOCIDADE = 3;
setInterval(() => {
  for (const id in jogadores) {
    const j = jogadores[id];
    const dx = j.destinoX - j.x;
    const dy = j.destinoY - j.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > VELOCIDADE) {
      j.x += (dx / dist) * VELOCIDADE;
      j.y += (dy / dist) * VELOCIDADE;
    } else {
      j.x = j.destinoX;
      j.y = j.destinoY;
    }
  }
  const posicoes = {};
  for (const id in jogadores) {
    posicoes[id] = { x: jogadores[id].x, y: jogadores[id].y };
  }
  io.emit('posicoes', posicoes);
}, 50);

const PORTA = process.env.PORT || 3000;
server.listen(PORTA, () => {
  console.log('Guiana Brasileira rodando na porta ' + PORTA);
});
