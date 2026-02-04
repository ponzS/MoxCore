import express, { type NextFunction, type Request, type Response } from 'express'
import { registerAiRoutes } from '../api/ai.js'

const app = express()
app.use(express.json({ limit: '2mb' }))
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  next()
})

const router = express.Router()
registerAiRoutes(router)
app.use('/api', router)

const port = Number(process.env.PORT || 5177)
app.listen(port, () => {
  console.log(`[core] ai server listening on :${port}`)
})
