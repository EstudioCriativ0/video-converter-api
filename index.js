const express = require('express');
const cors = require('cors');
const multer = require('multer');
const ffmpegPath = require('ffmpeg-static');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const os = require('os');
const path = require('path');

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const port = process.env.PORT || 3000;

// 🔒 CHAVE SECRETA – só quem tiver essa chave consegue usar a API
const SECURITY_KEY = 'EC-MOLDURA-2025-V1';

// CORS liberado
app.use(cors({ origin: '*' }));

// ====== PASTA TEMPORÁRIA SEGURA ======
const uploadDir = path.join(os.tmpdir(), 'uploads');

// Garante que a pasta existe
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('Pasta de upload criada em:', uploadDir);
}

// Multer usando a pasta temporária
const upload = multer({ dest: uploadDir });

// Rota de teste
app.get('/', (req, res) => {
  res.send('API rodando! 🚀');
});

// ====== ROTA DE CONVERSÃO ======
app.post('/convert', upload.single('video'), (req, res) => {
  // 🔒 VERIFICA A CHAVE SECRETA
  const key = req.query.key;
  if (key !== SECURITY_KEY) {
    console.log('Tentativa de acesso sem chave ou chave inválida:', key);
    return res.status(403).json({ error: 'Acesso não autorizado.' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum vídeo enviado.' });
  }

  // 'ios' ou 'android' vindo do front: ?device=ios / ?device=android
  const device = req.query.device;
  const isIos = device === 'ios';

  console.log('Dispositivo informado:', device);

  const inputPath = req.file.path;
  const outputPath = path.join(uploadDir, `${req.file.filename}-convertido.mp4`);

  console.log('Iniciando conversão...');
  console.log('Arquivo de entrada:', inputPath);
  console.log('Arquivo de saída:', outputPath);

  // Opções específicas para iOS (mais qualidade)
  const iosOptions = [
    '-preset veryfast',
    '-movflags +faststart',
    '-vf scale=720:-2,fps=30', // boa definição, 30 fps
    '-pix_fmt yuv420p',
    '-profile:v high',
    '-level 4.0',
    '-crf 24' // qualidade alta, arquivo um pouco maior
  ];

  // Opções específicas para Android (mais leve, mas estável)
  const androidOptions = [
    '-preset veryfast',
    '-movflags +faststart',
    '-vf scale=480:-2,fps=24', // um pouco menor e 24 fps pra aliviar
    '-pix_fmt yuv420p',
    '-profile:v baseline',
    '-level 3.0',
    '-crf 30' // bem mais comprimido, menos peso pro Android
  ];

  const chosenOptions = isIos ? iosOptions : androidOptions;

  ffmpeg(inputPath)
    .videoCodec('libx264')
    .audioCodec('aac')
    .outputOptions(chosenOptions)
    .toFormat('mp4')
    .on('end', () => {
      console.log('Conversão concluída com sucesso.');

      // Envia o arquivo por stream
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', 'attachment; filename=video.mp4');

      const stream = fs.createReadStream(outputPath);

      stream.on('error', (err) => {
        console.error('Erro ao ler arquivo MP4:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Erro ao ler vídeo convertido.' });
        }
        // Limpa arquivos mesmo com erro
        fs.unlink(inputPath, () => {});
        fs.unlink(outputPath, () => {});
      });

      // Quando terminar de enviar, apaga os arquivos temporários
      stream.on('close', () => {
        fs.unlink(inputPath, () => {});
        fs.unlink(outputPath, () => {});
      });

      stream.pipe(res);
    })
    .on('error', (err) => {
      console.error('Erro ao converter vídeo:', err);

      if (!res.headersSent) {
        res.status(500).json({ error: 'Erro na conversão.' });
      }

      // Limpa arquivos temporários
      fs.unlink(inputPath, () => {});
      if (fs.existsSync(outputPath)) {
        fs.unlink(outputPath, () => {});
      }
    })
    .save(outputPath);
});

// Sobe o servidor
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});

