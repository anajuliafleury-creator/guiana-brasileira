const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Áreas onde dá para caminhar em cada lugar
const SALAS = {
  vila: {
    poligono: [[30, 690], [866, 690], [866, 1150], [30, 1150]],
    centro: [448, 900],
    spawn: [448, 800]
  },
  rosa: {
    poligono: [[300, 238], [595, 238], [725, 238], [725, 353], [880, 353], [880, 613], [440, 798], [140, 633], [150, 443], [170, 398]],
    centro: [480, 520],
    spawn: [655, 300]
  }
};

// Portas: ponto onde o jogador chega e para onde ele vai
const PORTAS = {
  vila: { rosa: { ponto: [195, 715], destino: { sala: 'rosa', x: 655, y: 300 } } },
  rosa: { sair: { ponto: [655, 258], destino: { sala: 'vila', x: 195, y: 725 } } }
};

function dentro(x, y, poly) {
  let d = false;
  for (let i = 0, k = poly.length - 1; i < poly.length; k = i++) {
    const [xi, yi] = poly[i];
    const [xk, yk] = poly[k];
    if ((yi > y) !== (yk > y) && x < ((xk - xi) * (y - yi)) / (yk - yi) + xi) d = !d;
  }
  return d;
}

// Se o clique foi fora da área, puxa o ponto para a borda de dentro
function ajustar(x, y, sala) {
  const s = SALAS[sala];
  if (dentro(x, y, s.poligono)) return [x, y];
  let ax = s.centro[0], ay = s.centro[1], bx = x, by = y;
  for (let i = 0; i < 20; i++) {
    const mx = (ax + bx) / 2, my = (ay + by) / 2;
    if (dentro(mx, my, s.poligono)) { ax = mx; ay = my; } else { bx = mx; by = my; }
  }
  return [ax, ay];
}

const jogadores = {};

function daSala(sala) {
  const lista = {};
  for (const id in jogadores) if (jogadores[id].sala === sala) lista[id] = jogadores[id];
  return lista;
}

function trocarSala(j, destino) {
  const s = io.sockets.sockets.get(j.id);
  if (!s) return;
  s.leave(j.sala);
  io.to(j.sala).emit('jogadorSaiu', j.id);
  j.sala = destino.sala;
  j.x = j.destinoX = destino.x;
  j.y = j.destinoY = destino.y;
  j.porta = null;
  s.join(j.sala);
  s.to(j.sala).emit('jogadorEntrou', j);
  s.emit('trocouSala', { sala: j.sala, jogadores: daSala(j.sala) });
}

io.on('connection', (socket) => {
  const j = {
    id: socket.id,
    nome: 'Visitante',
    cor: '#e74c3c',
    sala: 'vila',
    x: 448, y: 800,
    destinoX: 448, destinoY: 800,
    porta: null
  };
  jogadores[socket.id] = j;
  socket.join('vila');
  socket.emit('estadoInicial', { meuId: socket.id, sala: 'vila', jogadores: daSala('vila') });
  socket.to('vila').emit('jogadorEntrou', j);

  socket.on('definirPerfil', (perfil) => {
    j.nome = String(perfil.nome || 'Visitante').slice(0, 14);
    j.cor = String(perfil.cor || '#e74c3c').slice(0, 7);
    io.to(j.sala).emit('perfilAtualizado', { id: j.id, nome: j.nome, cor: j.cor });
  });

  socket.on('andarPara', (d) => {
    const porta = d.porta && PORTAS[j.sala][d.porta];
    if (porta) {
      j.destinoX = porta.ponto[0];
      j.destinoY = porta.ponto[1];
      j.porta = porta;
    } else {
      const [ax, ay] = ajustar(Number(d.x) || j.x, Number(d.y) || j.y, j.sala);
      j.destinoX = ax;
      j.destinoY = ay;
      j.porta = null;
    }
  });

  socket.on('disconnect', () => {
    delete jogadores[socket.id];
    io.to(j.sala).emit('jogadorSaiu', socket.id);
  });
});

// Move os jogadores 20 vezes por segundo
const VELOCIDADE = 5;
setInterval(() => {
  const porSala = {};
  for (const id in jogadores) {
    const j = jogadores[id];
    const dx = j.destinoX - j.x;
    const dy = j.destinoY - j.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > VELOCIDADE) {
      const nx = j.x + (dx / dist) * VELOCIDADE;
      const ny = j.y + (dy / dist) * VELOCIDADE;
      if (dentro(nx, ny, SALAS[j.sala].poligono)) {
        j.x = nx; j.y = ny;
      } else {
        j.destinoX = j.x; j.destinoY = j.y; j.porta = null;
      }
    } else {
      j.x = j.destinoX; j.y = j.destinoY;
      if (j.porta) { trocarSala(j, j.porta.destino); continue; }
    }
    if (!porSala[j.sala]) porSala[j.sala] = {};
    porSala[j.sala][id] = { x: j.x, y: j.y };
  }
  for (const sala in porSala) io.to(sala).emit('posicoes', porSala[sala]);
}, 50);

const PORTA = process.env.PORT || 3000;
server.listen(PORTA, () => {
  console.log('Guiana Brasileira rodando na porta ' + PORTA);
});
