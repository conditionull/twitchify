require('dotenv').config();
const express = require('express');
const app = express();

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = 'http://127.0.0.1:8000/callback';
const SCOPES = 'user-modify-playback-state';

app.get('/login', (req, res) => {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES
  });
  res.redirect('https://accounts.spotify.com/authorize?' + params);
});

app.get('/callback', async (req, res) => {
  const code = req.query.code;

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64')
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI
    })
  });

  const data = await response.json();

  const fs = require('fs');
  let env = fs.readFileSync('.env', 'utf8');
  env = env.replace(/SPOTIFY_ACCESS_TOKEN=.*/,  `SPOTIFY_ACCESS_TOKEN=${data.access_token}`);
  env = env.replace(/SPOTIFY_REFRESH_TOKEN=.*/, `SPOTIFY_REFRESH_TOKEN=${data.refresh_token}`);
  fs.writeFileSync('.env', env);

  res.send('tokens updated, you can close this');
  process.exit();
});

app.listen(8000, () => {
  console.log('Open this in your browser: http://127.0.0.1:8000/login');
});
