var express = require('express');
var router = express.Router();
let mongoose = require('mongoose');
let messageModel = require('../schemas/message');
let userController = require('../controllers/users');
let { CheckLogin } = require('../utils/authHandler');

router.get('/:userID', CheckLogin, async function (req, res, next) {
  try {
    let currentUser = req.user._id;
    let otherId = req.params.userID;
    if (!mongoose.Types.ObjectId.isValid(otherId)) {
      return res.status(400).send({ message: 'Invalid user ID' });
    }
    let messages = await messageModel
      .find({
        $or: [
          { from: currentUser, to: otherId },
          { from: otherId, to: currentUser }
        ]
      })
      .sort({ createdAt: 1 })
      .populate('from to', 'username email');
    res.send(messages);
  } catch (error) {
    res.status(400).send({ message: error.message });
  }
});

router.post('/', CheckLogin, async function (req, res, next) {
  try {
    let from = req.user._id;
    let { to, messageContent } = req.body;

    if (!to || !messageContent || !messageContent.type || !messageContent.text) {
      return res.status(400).send({ message: 'to and messageContent.type/text are required' });
    }
    if (!mongoose.Types.ObjectId.isValid(to)) {
      return res.status(400).send({ message: 'Invalid recipient user ID' });
    }

    let recipient = await userController.GetAnUserById(to);
    if (!recipient) {
      return res.status(400).send({ message: 'Recipient user does not exist' });
    }

    if (!['file', 'text'].includes(messageContent.type)) {
      return res.status(400).send({ message: 'messageContent.type must be file or text' });
    }

    let newMessage = new messageModel({
      from,
      to,
      messageContent
    });
    await newMessage.save();

    let saved = await messageModel
      .findById(newMessage._id)
      .populate('from to', 'username email');

    res.status(201).send(saved);
  } catch (error) {
    res.status(400).send({ message: error.message });
  }
});

router.get('/', CheckLogin, async function (req, res, next) {
  try {
    let currentUser = req.user._id.toString();
    let messages = await messageModel
      .find({
        $or: [{ from: currentUser }, { to: currentUser }]
      })
      .sort({ createdAt: -1 })
      .populate('from to', 'username email');

    let lastByOther = new Map();
    messages.forEach((msg) => {
      const fromId = msg.from ? (msg.from._id ? msg.from._id.toString() : msg.from.toString()) : null;
      const toId = msg.to ? (msg.to._id ? msg.to._id.toString() : msg.to.toString()) : null;
      let otherId = null;

      if (fromId === currentUser) {
        otherId = toId;
      } else {
        otherId = fromId;
      }

      if (!otherId) return;
      if (!lastByOther.has(otherId)) {
        lastByOther.set(otherId, msg);
      }
    });

    res.send(Array.from(lastByOther.values()));
  } catch (error) {
    res.status(400).send({ message: error.message });
  }
});

module.exports = router;
