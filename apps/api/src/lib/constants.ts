import { createMessageObjectSchema, HttpStatusPhrases } from './openapi.js'


export const notFoundSchema = createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND)