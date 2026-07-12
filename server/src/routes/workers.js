const express = require('express');
const { getWorkers } = require('../controllers/workers');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware, getWorkers);

module.exports = router;
