const express = require('express');
const cors = require('cors');
const multer = require('multer');
const ffmpegPath = require('ffmpeg-static');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const port = process.env.PORT || 3000;

// CORS — libera o front-end (depois tu pode trocar o '*' pelo domínio do teu site, se quiser)
app.use(cors({ origin: '*' }));

// Upload temporário
const upload = multer({ dest: 'uploads/' });

app.get('/', (req, res) => {
  res.send('API de conversão ativa 🚀');
});

app.post('/convert', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum vídeo enviado.' });
  }

  const inputPath = req.file.path;
  const outputPath = inputPath + '.mp4';

  ffmpeg(inputPath)
    // codecs de vídeo e áudio
    .videoCodec('libx264')
    .audioCodec('aac')
    // opções para deixar MAIS LEVE pro servidor (evitar SIGKILL)
    .outputOptions([
      '-preset veryfast',       // conversão mais rápida
      '-movflags +faststart',   // ajuda no playback web
      '-vf scale=720:-2',       // limita largura em ~720px (reduz resolução)
      '-maxrate 1500k',         // limita taxa de bits de vídeo
      '-bufsize 3000k'          // controla o buffer de bitrate
    ])
    .toFormat('mp4')
    .on('end', () => {
      fs.readFile(outputPath, (err, data) => {
        if (err) {
          console.error('Erro lendo o arquivo MP4:', err);
          return res.status(500).json({ error: 'Erro ao ler vídeo convertido.' });
        }

        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Disposition', 'attachment; filename=video.mp4');
        res.send(data);

        // Apaga arquivos temporários
        fs.unlink(inputPath, () => {});
        fs.unlink(outputPath, () => {});
      });
    })
    .on('error', (err) => {
      console.error('Erro ao converter vídeo:', err);
      res.status(500).json({ error: 'Erro na conversão.' });

      // Limpa arquivos temporários mesmo em caso de erro
      fs.unlink(inputPath, () => {});
      if (fs.existsSync(outputPath)) {
        fs.unlink(outputPath, () => {});
      }
    })
    .save(outputPath);
});

app.listen(port, () => {
  console.log(Servidor rodando na porta ${port});
});
