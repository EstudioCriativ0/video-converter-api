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
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum vídeo enviado.' });
  }

  const inputPath = req.file.path;
  const outputPath = path.join(uploadDir, `${req.file.filename}-convertido.mp4`);

  console.log('Iniciando conversão...');
  console.log('Arquivo de entrada:', inputPath);
  console.log('Arquivo de saída:', outputPath);

  ffmpeg(inputPath)
    .videoCodec('libx264')
    .audioCodec('aac')
    .outputOptions([
      '-preset veryfast',
      '-movflags +faststart',

      // 🔽 Deixa o vídeo mais leve e compatível com Android
      '-vf scale=540:-2,fps=24', // largura ~540px, altura proporcional, 24 fps
      '-pix_fmt yuv420p',        // formato de cor mais compatível
      '-profile:v baseline',     // perfil de compatibilidade ampla
      '-level 3.0',              // nível seguro pra maioria dos Androids
      '-crf 28'                  // qualidade/bitrate mais leve (quanto maior, mais leve)
    ])
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

