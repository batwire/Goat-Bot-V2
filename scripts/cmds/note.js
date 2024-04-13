const { getStreamsFromAttachment, checkAndTranslate } = global.utils;

module.exports = {
  config: {
    name: "note",
    aliases: ["notice"],
    version: "69",
    author: "SKY",
    countDown: 5,
    role: 2,
    shortDescription: "Send notice from admin to a specific group",
    longDescription: "Send notice from admin to a specific group",
    category: "owner",
    guide: "{pn} <group ID or name> <message>",
    envConfig: {
      delayPerGroup: 250,
    },
  },

  onStart: async function ({
    message,
    api,
    event,
    args,
    commandName,
    envCommands,
  }) {
    const { delayPerGroup } = envCommands[commandName];
    const groupIdentifier = args.shift(); // Extract group ID or name from arguments
    const noticeMessage = args.join(" ");

    if (groupIdentifier.toLowerCase() === 'all') {
      // Send notice to all groups
      const groups = await api.getThreadList(200, null, ["INBOX"]);
      let successCount = 0;
      let errorCount = 0;

      for (const group of groups) {
        try {
          await sendNoticeToGroup(group, noticeMessage, event, api, message);
          successCount++;
        } catch (error) {
          console.error(error);
          errorCount++;
        }
      }

      if (errorCount === 0) {
        message.reply(`✅ Successfully sent notice to all ${successCount} groups.`);
      } else {
        message.reply(`✅ Successfully sent notice to ${successCount} groups, but encountered errors while sending to ${errorCount} groups.`);
      }
      return;
    }

    if (!groupIdentifier) {
      return message.reply(
        "Please provide both the group ID or name and the message or attachment you want to send."
      );
    }

    const groups = await api.getThreadList(200, null, ["INBOX"]);

    const targetGroup = groups.find(
      (group) =>
        group.threadID === groupIdentifier || group.name === groupIdentifier
    );

    if (!targetGroup) {
      return message.reply(
        "The specified group ID or name is not valid or the bot is not a member of that group."
      );
    }

    // Get attachments from both the original message and the reply
    const allAttachments = [
      ...event.attachments,
      ...(event.messageReply?.attachments || []),
    ];

    let formSend;

    if (allAttachments.length || noticeMessage) {
      // If there are attachments or a text message, use them
      formSend = {};

      if (allAttachments.length) {
        // If there are attachments, use them
        formSend.attachment = await getStreamsFromAttachment(allAttachments);
      }

      if (noticeMessage) {
        // If there is also a text message, include it in the body
        formSend.body = `\n\n${noticeMessage}`;
      }
    } else {
      return message.reply(
        "Please provide a message or attachment to send."
      );
    }

    try {
      await api.sendMessage(formSend, targetGroup.threadID);
    } catch (error) {
      console.error(error);
      return message.reply(
        `❌ Error occurred while sending notice to the group "${targetGroup.name}".`
      );
    }

    message.reply(
      `✅ Successfully sent notice to "${groupIdentifier}" group.`
    );
  },
};

async function sendNoticeToGroup(group, noticeMessage, event, api, message) {
  const allAttachments = [
    ...event.attachments,
    ...(event.messageReply?.attachments || []),
  ];

  let formSend = {};

  if (allAttachments.length) {
    // If there are attachments, use them
    formSend.attachment = await getStreamsFromAttachment(allAttachments);
  }

  if (noticeMessage) {
    // If there is also a text message, include it in the body
    formSend.body = `\n\n${noticeMessage}`;
  }

  await api.sendMessage(formSend, group.threadID);
}
