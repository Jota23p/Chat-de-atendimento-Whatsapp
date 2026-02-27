// src/routes/webhook.js
const express = require('express');
const router = express.Router();
const { receberWebhook } = require('../controllers/webhookController');

router.post('/whatsapp', receberWebhook);
router.get('/whatsapp', (req, res) => res.send('Webhook ativo ✅')); // verificação Evolution API

module.exports = router;
