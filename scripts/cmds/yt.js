const fs = require("fs-extra");
const ytdl = require("@distube/ytdl-core");
const yts = require("yt-search");
const axios = require('axios');

module.exports = {
  config: {
    name: "yt",
    version: "2.0",
    role: 0,
    author: "SKY",
    cooldowns: 25,
    shortDescription: "Download music or video from YouTube.",
    longDescription: "",
    category: "media",
    dependencies: {
      "fs-extra": "",
      "ytdl-core": "",
      "yt-search": "",
      "axios": ""
    }
  },

  onStart: async function ({ api, event }) {},

  onChat: async function ({ event, api }) {
    const message = event.body.toLowerCase().trim();

    if (message.includes("youtube.com") || message.includes("youtu.be")) {
      const videoId = extractVideoId(message);
      if (videoId) {
        await downloadMedia(videoId, false, event, api);
        return;
      }
    }

    if (message.startsWith("yta ")) {
      const query = message.slice(4).trim();
      await downloadMedia(query, true, event, api);
    } else if (message.startsWith("ytv ")) {
      const query = message.slice(4).trim();
      await downloadMedia(query, false, event, api);
    } else if (message.startsWith("ytl ")) {
      const query = message.slice(4).trim();
      await downloadMediaWithLyrics(query, event, api);
    } else {
      // Handle unrecognized commands or messages here
    }
  }
};

async function downloadMedia(query, isAudio, event, api) {
  let loadingMessage;
  if (!query) {
    return api.sendMessage(`Please specify a ${isAudio ? "music" : "video"} name.`, event.threadID, event.messageID);
  }

  try {
    loadingMessage = await api.sendMessage(`Searching ${isAudio ? "music" : "video"} for "${query}". Please wait...`, event.threadID);

    const searchResults = await yts(query);
    if (!searchResults.videos.length) {
      api.sendMessage(`No ${isAudio ? "music" : "video"} found.`, event.threadID, event.messageID);
      return;
    }

    const media = searchResults.videos[0];
    const mediaUrl = media.url;

    const stream = ytdl(mediaUrl, { filter: isAudio ? "audioonly" : "videoandaudio" });

    const fileName = `${Date.now()}.${isAudio ? "mp3" : "mp4"}`;
    const filePath = `./cache/${fileName}`;

    await fs.ensureDir('./cache');

    stream.pipe(fs.createWriteStream(filePath));

    stream.on('end', () => {
      api.sendMessage({
        body: `🎧 Title: ${media.title}\n🎤 Artist: ${media.author.name}\n⏳ Duration: ${media.timestamp}\n📅 Release Date: ${media.ago}`,
        attachment: fs.createReadStream(filePath)
      }, event.threadID, event.messageID)
      .then(() => {
        fs.unlinkSync(filePath);
      })
      .catch(error => {
        console.error('[ERROR]', error);
        api.sendMessage('An error occurred while sending the media.', event.threadID, event.messageID)
        .finally(() => {
          fs.unlinkSync(filePath);
        });
      });
    });
  } catch (error) {
    console.error('[ERROR]', error);
    api.sendMessage('An error occurred while processing the command.', event.threadID, event.messageID);
  } finally {
    if (loadingMessage) {
      api.unsendMessage(loadingMessage.messageID);
    }
  }
}

async function downloadMediaWithLyrics(query, event, api) {
  let loadingMessage;
  if (!query) {
    return api.sendMessage("Please specify a song title.", event.threadID, event.messageID);
  }

  try {
    loadingMessage = await api.sendMessage(`Searching for "${query}". Please wait...`, event.threadID);

    const searchResults = await yts(query);
    if (!searchResults.videos.length) {
      api.sendMessage(`No videos found for "${query}".`, event.threadID, event.messageID);
      return;
    }

    const media = searchResults.videos[0];
    const mediaUrl = media.url;

    const stream = ytdl(mediaUrl, { filter: "audioonly" });

    const fileName = `${Date.now()}.mp3`;
    const filePath = `./cache/${fileName}`;

    await fs.ensureDir('./cache');

    stream.pipe(fs.createWriteStream(filePath));

    stream.on('end', async () => {
      const lyrics = await getLyrics(query);
      if (!lyrics) {
        api.sendMessage(`No lyrics found for "${query}".`, event.threadID, event.messageID);
        return;
      }

      const replyMessage = {
        body: `🎧 Title: ${media.title}\n🎤 Artist: ${media.author.name}\n⏳ Duration: ${media.timestamp}\n📅 Release Date: ${media.ago}\n\nLyrics for "${query}":\n${lyrics}`,
        attachment: fs.createReadStream(filePath),
      };

      api.sendMessage(replyMessage, event.threadID, event.messageID)
      .then(() => {
        fs.unlinkSync(filePath);
      })
      .catch(error => {
        console.error('[ERROR]', error);
        api.sendMessage('An error occurred while sending the media.', event.threadID, event.messageID)
        .finally(() => {
          fs.unlinkSync(filePath);
        });
      });
    });
  } catch (error) {
    console.error('[ERROR]', error);
    api.sendMessage('An error occurred while processing the command.', event.threadID, event.messageID);
  } finally {
    if (loadingMessage) {
      api.unsendMessage(loadingMessage.messageID);
    }
  }
}

async function getLyrics(song) {
  try {
    const response = await axios.get(`https://lyrist.vercel.app/api/${encodeURIComponent(song)}`);
    if (response.data && response.data.lyrics) {
      return response.data.lyrics;
    } else {
      return null;
    }
  } catch (error) {
    console.error('[LYRICS ERROR]', error);
    return null;
  }
}

function extractVideoId(url) {
  const match = url.match(/[?&]v=([^&]+)/);
  return match && match[1];
                                    }
