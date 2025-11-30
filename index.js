const express = require('express');
const cors = require('cors');
const multer = require('multer');
const ffmpegPath = require('ffmpeg-static');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const port = process.env.PORT || 3000;

// CORS — libera o front-end
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
    .outputOptions([
      '-c:v libx264',
      '-c:a aac',
      '-movflags +faststart'
    ])
    .toFormat('mp4')
    .on('end', () => {
      fs.readFile(outputPath, (err, data) => {
        if (err) {
          console.error('Erro lendo o arquivo MP4:', err);
          return res.status(500).json({ error: 'Erro ao ler vídeo convertido.' });
        }

        res.setHeader('Content-Type', 'video/mp4');
        res.send(data);

        fs.unlink(inputPath, () => {});
        fs.unlink(outputPath, () => {});
      });
    })
    .on('error', (err) => {
      console.error('Erro ao converter vídeo:', err);
      res.status(500).json({ error: 'Erro na conversão.' });

      fs.unlink(inputPath, () => {});
      if (fs.existsSync(outputPath)) fs.unlink(outputPath, () => {});
    })
    .save(outputPath);
});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
