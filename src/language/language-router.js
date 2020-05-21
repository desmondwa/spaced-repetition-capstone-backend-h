const express = require('express')
const LanguageService = require('./language-service')
const { requireAuth } = require('../middleware/jwt-auth')

const languageRouter = express.Router()

languageRouter
  .use(requireAuth)
  .use(async (req, res, next) => {
    try {
      const language = await LanguageService.getUsersLanguage(
        req.app.get('db'),
        req.user.id,
      )

      if (!language)
        return res.status(404).json({
          error: `You don't have any languages`,
        })

      req.language = language
      next()
    } catch (error) {
      next(error)
    }
  })

languageRouter
  .get('/', async (req, res, next) => {
    try {
      const words = await LanguageService.getLanguageWords(
        req.app.get('db'),
        req.language.id,
      )

      res.json({
        language: req.language,
        words,
      })
      next()
    } catch (error) {
      next(error)
    }
  })

languageRouter
  .get('/head', async (req, res, next) => {
    let headWord = req.language.head;
    let totalScore = req.language.total_score;
    let nextWord;
    try {
      nextWord = await LanguageService.getNextWord(req.app.get("db"), headWord);
    } catch (error) {
      next(error);
    }
    res.status(200).json({
      nextWord: nextWord.original,
      totalScore: totalScore,
      wordCorrectCount: nextWord.correct_count,
      wordIncorrectCount: nextWord.incorrect_count,
    });
  })

languageRouter
.post('/guess', jsonBodyParser, async (req, res, next) => {
  try {
    const { guess } = req.body

    if (!guess)
      return res.status(400).json({
        error: `Missing 'guess' in request body`
      })

    const words = await LanguageService.getLanguageWords(
      req.app.get('db'),
      req.language.id,
    )

    const ll = LanguageService.populateLinkedList(
      req.language,
      words,
    )

    const node = ll.head
    const answer = node.value.translation

    let isCorrect
    if (guess === answer) {
      isCorrect = true

      ll.head.value.memory_value = Number(node.value.memory_value) * 2

      ll.head.value.correct_count = Number(ll.head.value.correct_count) + 1

      ll.total_score = Number(ll.total_score) + 1
    } else {
      isCorrect = false

      ll.head.value.memory_value = 1

      ll.head.value.incorrect_count = Number(ll.head.value.incorrect_count) + 1
    }

    ll.shiftHeadBy(ll.head.value.memory_value)

    await LanguageService.updateLinkedList(
      req.app.get('db'),
      ll,
    )

    res.json({
      nextWord: ll.head.value.original,
      wordCorrectCount: ll.head.value.correct_count,
      wordIncorrectCount: ll.head.value.incorrect_count,
      totalScore: ll.total_score,
      answer,
      isCorrect,
      guess
    })
  } catch (error) {
    next(error)
  }
})

module.exports = languageRouter
