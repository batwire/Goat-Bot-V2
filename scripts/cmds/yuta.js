const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const SpotifyWebApi = require("spotify-web-api-node");
const ytdl = require("ytdl-core");
const yts = require("yt-search");

const clientId = "fbeb209c7e564d70ace56409c2df1f61";
const clientSecret = "0589682db0e242d48e3a618ccd093707";

const spotifyApi = new SpotifyWebApi({
  clientId: clientId,
  clientSecret: clientSecret,
});

async function fetchRandomTrackFromPlaylist(accessToken, playlistId) {
  try {
    const tracks = await fetchPlaylistTracks(accessToken, playlistId);
    const unplayedTracks = tracks.filter(track => !module.exports.music.playedTracks.includes(track.name));

    if (unplayedTracks.length === 0) {
      module.exports.music.playedTracks = [];
    }

    const randomTrack = unplayedTracks[Math.floor(Math.random() * unplayedTracks.length)];
    return randomTrack;
  } catch (error) {
    console.error("Error fetching random track:", error);
    throw error;
  }
}

async function fetchPlaylistTracks(accessToken, playlistId) {
  try {
    spotifyApi.setAccessToken(accessToken);
    const response = await spotifyApi.getPlaylistTracks(playlistId, { limit: 50 });
    return response.body.items.map(item => ({
      name: item.track.name,
      artists: item.track.artists.map(artist => artist.name).join(', '),
      preview_url: item.track.preview_url,
      release_date: item.track.album.release_date,
      duration_ms: item.track.duration_ms,
    }));
  } catch (error) {
    console.error("Error fetching playlist tracks:", error);
    throw error;
  }
}

async function getAccessToken() {
  try {
    const data = await spotifyApi.clientCredentialsGrant();
    return data.body['access_token'];
  } catch (error) {
    console.error("Error fetching access token:", error);
    throw error;
  }
}

async function downloadAudioFromYouTube(videoUrl, fileName) {
  try {
    const audioFilePath = path.join(__dirname, "cache", fileName);
    const audioStream = ytdl(videoUrl, { filter: "audioonly" });
    const writer = fs.createWriteStream(audioFilePath);
    audioStream.pipe(writer);
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
    return audioFilePath;
  } catch (error) {
    console.error("Error downloading audio from YouTube:", error);
    throw error;
  }
}

function formatDuration(milliseconds) {
  const minutes = Math.floor(milliseconds / 60000);
  const seconds = ((milliseconds % 60000) / 1000).toFixed(0);
  return `${minutes}:${(seconds < 10 ? '0' : '')}${seconds}`;
}

module.exports = {
  sentMusic: {},
  music: {
    playlist: ["52bAtqS3WksgyjQKzkBJrj"],
    playedTracks: [],
  },
  config: {
    name: "yuta",
    version: "1.0",
    role: 0,
    author: "𝗦𝗞𝗬",
    cooldowns: 40,
    shortDescription: {
      en: "Fetches a random music track from a Spotify playlist and sends it",
    },
    longDescription: {
      en: "This command fetches a random music track from a Spotify playlist, searches for it on YouTube, downloads its audio format, and sends it as an attachment.",
    },
    category: "Music",
    guide: {
      en: "{prefix}yuta\n\nDescription: This command fetches a random music track from spoti.fi/4arnK8t this playlist.\n\nUsage: {prefix}yuta",
    },
    dependencies: {
      "axios": "",
      "spotify-web-api-node": "",
      "ytdl-core": "",
      "yt-search": ""
    }
  },
  onStart: async function ({ api, event }) {
    try {
      const loadingMessage = await api.sendMessage("Loading a random music track... 🎵", event.threadID);

      const accessToken = await getAccessToken();
      const playlistId = this.music.playlist[0];
      const randomTrack = await fetchRandomTrackFromPlaylist(accessToken, playlistId);

      const trackName = randomTrack.name;
      const artists = randomTrack.artists;
      const duration = formatDuration(randomTrack.duration_ms);
      const releaseDate = randomTrack.release_date;

      const searchResults = await yts(`${trackName} ${artists} audio`);
      const youtubeVideo = searchResults.videos.find(video => video.seconds > 30);

      if (!youtubeVideo) {
        throw new Error("No suitable YouTube video found for the track.");
      }

      const audioFileName = `${trackName.replace(/\s/g, '_')}.mp3`;
      const audioFilePath = await downloadAudioFromYouTube(youtubeVideo.url, audioFileName);

      const audioStream = fs.createReadStream(audioFilePath);
      api.sendMessage({ body: `🎧 Title: ${trackName}\n🎤 Artist: ${artists}\n⏳ Duration: ${duration}\n📅 Release Date: ${releaseDate}`, attachment: audioStream }, event.threadID, event.messageID);
      api.unsendMessage(loadingMessage.messageID);

      this.music.playedTracks.push(trackName);
    } catch (error) {
      console.error("Error:", error);
      api.sendMessage("An error occurred while processing the command.", event.threadID);
    }
  },
};
