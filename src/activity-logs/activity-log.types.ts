export interface ApiActivityLog {
  id: string
  timestamp: string
  method: string
  path: string
  statusCode: number
  responseTimeMs: number
  actorType: 'admin' | 'user' | 'anonymous'
  actorId?: string
  actorLabel: string
  ip?: string
  userAgent?: string
}
