const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Tamanho do mundo = tamanho da imagem de fundo (em pixels)
const MUNDO_L = 896;
const MUNDO_A = 1200;

// Área onde dá para caminhar: da frente das lojas até a parte de baixo
const MIN_X = 30;
const MAX_X = MUNDO_L - 30;
const MIN_Y = 690;
const MAX_Y = MUNDO_A - 50;

// Todos os jogadores conectados
const jogadores = {};

io.on('connection', (socket) => {
  // Novo jogador nasce no meio da praça
  jogadores[socket.id] = {
    id: socket.id,
    nome: 'Visitante',
    cor: '#e74c3c',
    x: 448,
    y: 800,
    destinoX: 448,
    destinoY: 800
  };

  socket.emit('estadoInicial', { meuId: socket.id, jogadores });
  socket.broadcast.emit('jogadorEntrou', jogadores[socket.id]);

  socket.on('definirPerfil', (perfil) => {
    const j = jogadores[socket.id];
    if (!j) return;
    j.nome = String(perfil.nome || 'Visitante').slice(0, 14);
    j.cor = String(perfil.cor || '#e74c3c').slice(0, 7);
    io.emit('perfilAtualizado', { id: j.id, nome: j.nome, cor: j.cor });
  });

  socket.on('andarPara', (destino) => {
    const j = jogadores[socket.id];
    if (!j) return;
    j.destinoX = Math.max(MIN_X, Math.min(MAX_X, Number(destino.x) || j.x));
    j.destinoY = Math.max(MIN_Y, Math.min(MAX_Y, Number(destino.y) || j.y));
  });

  socket.on('disconnect', () => {
    delete jogadores[socket.id];
    io.emit('jogadorSaiu', socket.id);
  });
});

// O servidor move os jogadores 20 vezes por segundo
const VELOCIDADE = 5;
setInterval(() => {
  const posicoes = {};
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
    posicoes[id] = { x: j.x, y: j.y };
  }
  io.emit('posicoes', posicoes);
}, 50);

const PORTA = process.env.PORT || 3000;
server.listen(PORTA, () => {
  console.log('Guiana Brasileira rodando na porta ' + PORTA);
});
